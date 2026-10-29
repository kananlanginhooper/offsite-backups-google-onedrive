"""Settings for the pushers, read from the repo's one .env (or the process env, which wins).

Everything specific to one library lives there: database, remotes, accounts, folders, the
inventory table's name. Batch definitions (which source folders or projects make up a run) live in
the JSON file named by PUSH_BATCHES_FILE, kept out of git. See .env.example and batches.example.json.
"""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.split(" #", 1)[0].strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


_load_dotenv(Path(os.environ.get("ENV_FILE", REPO / ".env")))


def get(key: str, default: str | None = None) -> str:
    value = os.environ.get(key, default)
    if value is None or value == "":
        raise SystemExit(f"missing setting {key} (see .env.example)")
    return value


def get_list(key: str, default: str | None = None) -> list[str]:
    return [v for v in get(key, default).replace(",", " ").split() if v]


def connect():
    """The catalogue database (MySQL). An option file (RECOVERY_DB_CNF) or host/user/password."""
    import pymysql

    common = dict(database=get("RECOVERY_DB_NAME", "recovery"), charset="utf8mb4", autocommit=True)
    cnf = os.environ.get("RECOVERY_DB_CNF")
    if cnf:
        return pymysql.connect(read_default_file=os.path.expanduser(cnf), **common)
    return pymysql.connect(host=get("RECOVERY_DB_HOST"), port=int(get("RECOVERY_DB_PORT", "3306")),
                           user=get("RECOVERY_DB_USER"), password=get("RECOVERY_DB_PASSWORD"), **common)


class Provider:
    """One offsite target: rclone remote, account label for offsite_copy, base folder on the remote."""

    def __init__(self, name: str):
        prefix = name.upper()
        self.name = name
        self.remote = get(f"{prefix}_REMOTE").rstrip(":") + ":"
        self.account = get(f"{prefix}_ACCOUNT")
        self.base = get(f"{prefix}_BASE")


# Shared by both pushers.
DB_NAME = get("RECOVERY_DB_NAME", "recovery")
INVENTORY = get("PUSH_INVENTORY_TABLE")            # source-file inventory: hash, dest_path, src_root, rel_path, kind
INTAKE_ROOTS = tuple(get_list("PUSH_INTAKE_ROOTS"))  # only files under these local roots are pushed
DEPRIORITIZED_PREFIX = os.environ.get("PUSH_DEPRIORITIZED_PREFIX", "")  # copy picked last when a hash has several
OWNER = get("PUSH_OWNER_TAG")                       # the decided_by value that marks the owner's own decisions
TAKEOUT_PATTERNS = get_list("PUSH_TAKEOUT_PART_PATTERNS")  # takeout_parts.part LIKE patterns
TAKEOUT_PARTS = int(get("PUSH_TAKEOUT_PARTS"))
VIDEO_KINDS = ("mp4", "mov", "avi", "mkv", "wmv", "m4v", "mts")


if __name__ == "__main__":
    # Shell scripts read settings through here: eval "$(python3 config.py KEY ...)"
    import shlex
    import sys

    for key in sys.argv[1:]:
        print(f"export {key}={shlex.quote(os.environ.get(key, ''))}")
