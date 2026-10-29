"""Gates and helpers shared by the Google Drive and OneDrive pushers.

SAFETY: the gate SQL here is copied as-is from the live push jobs. A file goes offsite only if its
privacy scan is clear, it isn't excluded, its screenshot text wasn't flagged private, and its
category isn't on the sensitive list. Change a gate only with the owner's direct say-so.
"""
import collections
import json
import os
import subprocess
import tempfile
import time

import config


def log(msg: str) -> None:
    print(f"{time.strftime('%F %T')} {msg}", flush=True)


def table_exists(cur, name: str) -> bool:
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s"
                " AND table_name = %s", (config.DB_NAME, name))
    return bool(cur.fetchone()[0])


def sensitive_category_gate(cur) -> str:
    """A hash whose content_category is on the sensitive_category list never goes offsite.
    Guarded: no-op until both tables exist."""
    if not (table_exists(cur, "content_category") and table_exists(cur, "sensitive_category")):
        return ""
    return (" AND NOT EXISTS (SELECT 1 FROM content_category cc JOIN sensitive_category sc"
            " ON sc.category = cc.category WHERE cc.hash = i.hash)")


def text_sensitivity_gate(cur) -> str:
    """Screenshot OCR text scanned flagged/private keeps the file offline. Only 'screenshot_ocr'
    rows carry a file hash. Guarded: the table may not exist on an older catalogue."""
    if not table_exists(cur, "text_sensitivity_flag"):
        return ""
    return (" AND NOT EXISTS (SELECT 1 FROM text_sensitivity_flag t WHERE t.source = 'screenshot_ocr'"
            " AND t.hash = i.hash AND t.status IN ('flagged','private'))")


def preflight(cur) -> bool:
    """The two stop rules: no privacy-scan table means nothing may upload, and an incomplete
    Takeout index means nothing may upload yet (it would re-upload what Google already has)."""
    if not table_exists(cur, "sensitive_flag"):
        log("sensitive_flag table missing: allow-list rule means nothing may upload")
        return False
    likes = " OR ".join("part LIKE %s" for _ in config.TAKEOUT_PATTERNS)
    cur.execute(f"SELECT SUM(status = 'done'), SUM(status <> 'done') FROM takeout_parts WHERE {likes}",
                config.TAKEOUT_PATTERNS)
    done, not_done = [int(x or 0) for x in cur.fetchone()]
    if (done < config.TAKEOUT_PARTS or not_done) and not os.environ.get("PUSH_ALLOW_UNINDEXED_TAKEOUT"):
        log(f"Takeout index incomplete ({done}/{config.TAKEOUT_PARTS} parts done, {not_done} not done):"
            " no-reupload rule means nothing may upload yet")
        return False
    return True


def video_kinds_sql() -> str:
    return ",".join(f"'{k}'" for k in config.VIDEO_KINDS)


def order_by() -> str:
    """One row per hash wins: copies under the deprioritized prefix sort last."""
    if config.DEPRIORITIZED_PREFIX:
        return " ORDER BY i.hash, i.dest_path LIKE %s, i.dest_path"
    return " ORDER BY i.hash, i.dest_path"


def order_args() -> tuple:
    return (config.DEPRIORITIZED_PREFIX + "%",) if config.DEPRIORITIZED_PREFIX else ()


def pick_files(rows, label: str):
    """Pick one readable intake copy per hash. Returns [(hash, root, rel_path), ...]."""
    pick = {}
    for h, dest in rows:
        if h not in pick and dest and os.path.isfile(dest) and dest.startswith(config.INTAKE_ROOTS):
            pick[h] = dest
    skipped = len({h for h, _ in rows}) - len(pick)
    log(f"{label}: {skipped} hashes skipped (no readable intake copy)")
    log(f"{label}: {len(pick)} hashes, {sum(os.path.getsize(p) for p in pick.values()) / 1e9:.1f} GB to push")
    picked = []
    for h, dest in pick.items():
        root = next(r for r in config.INTAKE_ROOTS if dest.startswith(r))
        picked.append((h, root, dest[len(root):]))
    return picked


def push_with_cli(cur, provider, files, batch: str, dry_run: bool, extra=()) -> int:
    """Hand the picked files to the provider's standalone CLI (gdrive-rclone / onedrive-rclone),
    then record every copy its manifest reports as verified. The CLI chunks, copies, verifies by
    the provider's own hash, and refuses a file whose content no longer matches its catalog hash.
    Returns the CLI's exit code (7 = provider cap, run again later)."""
    cmd = [*provider.cli, "push", "--remote", provider.remote, "--dest", provider.base, *extra]
    log(" ".join(cmd) + f" ({len(files)} files)")
    if dry_run or not files:
        return 0
    by_path = {}
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", suffix=".jsonl") as lst:
        for h, root, rel in files:
            lst.write(json.dumps({"local_path": root + rel, "remote_path": rel, "sha256": h}) + "\n")
            by_path[root + rel] = (h, root, rel)
    manifest = lst.name + ".manifest"
    try:
        rc = subprocess.run([*cmd, "--list", lst.name, "--manifest", manifest]).returncode
        counts = collections.Counter()
        if os.path.exists(manifest):
            with open(manifest, encoding="utf-8") as f:
                for line in f:
                    row = json.loads(line)
                    counts[row["status"]] += 1
                    if row["status"] in ("copied", "skipped"):
                        h, root, rel = by_path[row["local_path"]]
                        remote_md5 = row["remote_hash"] if row["hash_type"] == "md5" else None
                        record_copy(cur, provider, h, rel, root, remote_md5, "rclone_check", batch)
                    elif row["status"] != "quota_stopped":
                        log(f"NOT VERIFIED {row['local_path']}: {row['status']} {row.get('detail', '')}")
        log(f"{provider.name}: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) + f"; cli exit {rc}")
        return rc
    finally:
        for p in (lst.name, manifest):
            if os.path.exists(p):
                os.unlink(p)


def record_copy(cur, provider, h: str, rel: str, root: str, remote_md5, verified_by: str, batch: str):
    """Write one verified copy to offsite_copy (the source of truth for what is offsite)."""
    rp = f"{provider.base}/{rel}"
    cur.execute(
        "INSERT INTO offsite_copy (hash, provider, account, remote_path, remote_path_md5, remote_md5, size,"
        " placed_by, verified_by, verified_at, source_path, batch)"
        " VALUES (%s,%s,%s,%s,UNHEX(MD5(%s)),%s,%s,'rclone_push',%s,NOW(),%s,%s)"
        " ON DUPLICATE KEY UPDATE hash=VALUES(hash), remote_md5=COALESCE(VALUES(remote_md5), remote_md5),"
        " verified_at=VALUES(verified_at), batch=VALUES(batch)",
        (h, provider.name, provider.account, rp, rp, remote_md5, os.path.getsize(root + rel), root + rel,
         verified_by, batch))
