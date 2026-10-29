"""Prove the ported pushers send the same SQL as the live push jobs.

Runs each live script and its port against the same recording fake database (every table exists,
the Takeout index is complete, and no files come back), with the same arguments. It collects every
statement each one sends, fills in the parameters, and compares them statement by statement.
No database, network or files are touched.

  python pusher/tools/gate_diff.py --live <folder with screenshot-ocr/ and onedrive-push/>
                                   --env <file of live settings> [--out docs/gate-diff.md]

The live settings file is private (gitignored). The report masks every value it sets, so the
report itself names no library-specific detail.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
import tempfile
import types
from contextlib import redirect_stdout
from io import StringIO
from unittest import mock

PUSHER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Recorder:
    """A pymysql stand-in that records statements. Every table exists; Takeout is complete."""

    def __init__(self, parts):
        self.statements = []
        self.parts = parts
        self.result = []

    def connect(self, **_kw):
        return self

    def cursor(self):
        return self

    def execute(self, sql, args=None):
        self.statements.append(normalize(sql, args))
        if "information_schema" in sql:
            self.result = [(1,)]
        elif "FROM takeout_parts" in sql:
            self.result = [(self.parts, 0)]
        else:
            self.result = []

    def fetchone(self):
        return self.result[0]

    def fetchall(self):
        return self.result


def normalize(sql, args):
    """Fill in parameters the way pymysql does, then collapse whitespace. A literal '%%' only
    becomes '%' when parameters are given; both mean the same LIKE wildcard, so compare as '%'."""
    if args is not None:
        it = iter(args)
        sql = re.sub(r"%s", lambda _m: "'" + str(next(it)).replace("'", "''") + "'", sql)
    return " ".join(sql.replace("%%", "%").split())


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def capture(module, argv, parts):
    rec = Recorder(parts)
    fake = types.SimpleNamespace(connect=rec.connect)
    # the live scripts bind pymysql at import; the port imports it inside config.connect()
    with mock.patch.dict(sys.modules, {"pymysql": fake}), mock.patch.object(module, "pymysql", fake, create=True), \
         mock.patch.object(sys, "argv", ["x", *argv]), redirect_stdout(StringIO()):
        try:
            module.main()
        except SystemExit:
            pass
    return rec.statements


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", required=True)
    ap.add_argument("--env", required=True)
    ap.add_argument("--out")
    a = ap.parse_args()

    os.environ["ENV_FILE"] = os.path.abspath(a.env)
    sys.path.insert(0, PUSHER)
    import config  # noqa: E402  (reads the live settings file)
    port_g = load(os.path.join(PUSHER, "gdrive_push.py"), "port_gdrive")
    port_o = load(os.path.join(PUSHER, "onedrive_push.py"), "port_onedrive")
    live_g = load(os.path.join(a.live, "screenshot-ocr", "offsite_push.py"), "live_gdrive")
    live_o = load(os.path.join(a.live, "onedrive-push", "onedrive_push.py"), "live_onedrive")

    batches = {
        "roots": {"src_roots": ["ROOT-A", "ROOT-B"], "exclude_kinds": ["jpeg", "mp4"]},
        "video": {"include_kinds": ["mp4", "mov"], "all_roots_except": ["%SKIP%"]},
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(batches, f)
    os.environ["PUSH_BATCHES_FILE"] = f.name

    scenarios = [
        ("Google Drive, by tier", live_g, ["--tier", "1", "--batch", "t"], port_g, ["--tier", "1", "--batch", "t"]),
        ("Google Drive, by project", live_g, ["--project", "PROJECT", "--batch", "t"],
         port_g, ["--project", "PROJECT", "--batch", "t"]),
        ("Google Drive, by source roots", live_g,
         ["--src-root", "ROOT-A", "--src-root", "ROOT-B", "--exclude-kinds", "jpeg,mp4", "--batch", "t"],
         port_g, ["--batch-def", "roots", "--batch", "t"]),
        ("Google Drive, video batch", live_g,
         ["--include-kinds", "mp4,mov", "--all-roots-except", "%SKIP%", "--batch", "t"],
         port_g, ["--batch-def", "video", "--batch", "t"]),
        ("OneDrive, tier 1", live_o, ["--batch", "t"], port_o, ["--batch", "t"]),
        ("OneDrive, tier 1 with video allowed", live_o, ["--allow-video-tier1", "--batch", "t"],
         port_o, ["--allow-video-tier1", "--batch", "t"]),
        ("OneDrive, other tier refused", live_o, ["--tier", "2", "--batch", "t"], port_o, ["--tier", "2", "--batch", "t"]),
    ]

    masks = [(config.INVENTORY, "<PUSH_INVENTORY_TABLE>")]
    masks += [(p, f"<PUSH_TAKEOUT_PART_PATTERNS[{i}]>") for i, p in enumerate(config.TAKEOUT_PATTERNS)]
    if config.DEPRIORITIZED_PREFIX:
        masks.append((config.DEPRIORITIZED_PREFIX, "<PUSH_DEPRIORITIZED_PREFIX>"))
    masks.append((config.OWNER, "<PUSH_OWNER_TAG>"))

    def mask(s):
        for value, name in masks:
            s = s.replace(value, name)
        return s

    lines = ["# Gate SQL: live push jobs vs pusher/", "",
             "Generated by `pusher/tools/gate_diff.py`. The live scripts and the ported pushers run against the same",
             "recording fake database with the same arguments. Every statement each one sends is compared after the",
             "parameters are filled in. Library-specific values are masked as `<SETTING>`. No data is read.", "",
             "Status: **MATCH** = the identical statement is sent at the same step by both. **PORT ONLY** = the port",
             "sends an extra statement, explained below the table.", ""]
    total_bad = 0
    for title, live_mod, live_argv, port_mod, port_argv in scenarios:
        live = capture(live_mod, live_argv, config.TAKEOUT_PARTS)
        port = capture(port_mod, port_argv, config.TAKEOUT_PARTS)
        lines += [f"## {title}", "", "| # | Status | Statement |", "|---|---|---|"]
        i = j = 0
        n = 0
        while i < len(live) or j < len(port):
            n += 1
            if i < len(live) and j < len(port) and live[i] == port[j]:
                status, stmt = "MATCH", port[j]
                i += 1
                j += 1
            elif j < len(port) and port[j] not in live[i:]:
                status, stmt = "PORT ONLY", port[j]
                j += 1
            else:
                status, stmt = "**LIVE ONLY: MISSING IN PORT**", live[i]
                total_bad += 1
                i += 1
            lines.append(f"| {n} | {status} | `{mask(stmt)}` |")
        lines.append("")

    lines += ["## Notes", "",
              "- **PORT ONLY `information_schema ... sensitive_flag`** (Google Drive): the port runs its shared preflight",
              "  after turning the owner's decisions into exclusions, so it checks that the privacy-scan table exists",
              "  a second time. It's a read with no effect.",
              "- A literal `%%` in a statement without parameters reaches MySQL as `%%`, and with parameters as `%`.",
              "  Both are the same LIKE wildcard, so the comparison treats them as `%`.",
              "- Recording a verified copy (`INSERT INTO offsite_copy`) only happens when files come back, so it isn't",
              "  in these runs. The port writes the same columns. It keeps an existing `remote_md5` when OneDrive",
              "  sends none, and the live OneDrive job never updated that column either.", "",
              f"**Result: {'every live statement is sent by the port' if not total_bad else f'{total_bad} live statement(s) missing in the port'}.**", ""]
    report = "\n".join(lines)
    if a.out:
        with open(a.out, "w", encoding="utf-8", newline="\n") as f:
            f.write(report)
    print(f"{'OK' if not total_bad else 'MISMATCH'}: {total_bad} live statement(s) missing in the port")
    sys.exit(1 if total_bad else 0)


if __name__ == "__main__":
    main()
