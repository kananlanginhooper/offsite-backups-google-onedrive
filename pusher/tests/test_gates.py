"""The safety gates, end to end with fakes: a private or flagged file is never handed to rclone.

Run from the repo root:  python pusher/tests/test_gates.py -v
"""
import os
import sys
import tempfile
import unittest
from unittest import mock

TMP = tempfile.mkdtemp(prefix="pusher-test-")
ROOT = os.path.join(TMP, "intake") + os.sep
os.environ.update({
    "ENV_FILE": os.path.join(TMP, "no.env"),  # never read a real .env
    "RECOVERY_DB_CNF": "unused.cnf",
    "RECOVERY_DB_NAME": "catalogue",
    "PUSH_INVENTORY_TABLE": "inventory",
    "PUSH_INTAKE_ROOTS": ROOT,
    "PUSH_OWNER_TAG": "owner",
    "PUSH_TAKEOUT_PART_PATTERNS": "part-%",
    "PUSH_TAKEOUT_PARTS": "2",
    "GDRIVE_REMOTE": "gd", "GDRIVE_ACCOUNT": "acct", "GDRIVE_BASE": "base",
    "ONEDRIVE_REMOTE": "od", "ONEDRIVE_ACCOUNT": "acct", "ONEDRIVE_BASE": "base",
})
os.environ.pop("PUSH_ALLOW_UNINDEXED_TAKEOUT", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gdrive_push  # noqa: E402
import onedrive_push  # noqa: E402
from fakes import FakeDb, FakeRclone, fake_pymysql, write_file  # noqa: E402

# name -> (setup rows, may go offsite on Google Drive?)
CASES = {
    "clear":            ([("sensitive_flag", dict(status="clear"))], True),
    "fine":             ([("sensitive_flag", dict(status="fine"))], True),
    "no_scan":          ([], False),
    "scan_private":     ([("sensitive_flag", dict(status="private"))], False),
    "scan_flagged":     ([("sensitive_flag", dict(status="flagged"))], False),
    "owner_private":    ([("sensitive_flag", dict(status="private", decided_by="owner"))], False),
    "excluded":         ([("sensitive_flag", dict(status="clear")),
                          ("offsite_exclusion", dict(reason="other", status="blocked"))], False),
    "text_private":     ([("sensitive_flag", dict(status="clear")),
                          ("text_sensitivity_flag", dict(source="screenshot_ocr", status="private"))], False),
    "text_flagged":     ([("sensitive_flag", dict(status="clear")),
                          ("text_sensitivity_flag", dict(source="screenshot_ocr", status="flagged"))], False),
    "sensitive_cat":    ([("sensitive_flag", dict(status="clear")),
                          ("content_category", dict(category="secret-cat"))], False),
    "already_offsite":  ([("sensitive_flag", dict(status="clear")),
                          ("offsite_copy", dict(provider="gdrive", verified_by="rclone_check"))], False),
    "in_takeout":       ([("sensitive_flag", dict(status="clear")),
                          ("takeout_extract", dict(action="new"))], False),
}


def build_db(cases, kind="pdf", tier=1, **db_kw):
    db = FakeDb(**db_kw)
    db.add("takeout_parts", part="part-1", status="done")
    db.add("takeout_parts", part="part-2", status="done")
    db.add("sensitive_category", category="secret-cat")
    for name, (rows, _) in cases.items():
        h = name.ljust(64, "0")
        rel = f"docs/{name}.{kind}"
        db.add("inventory", hash=h, dest_path=write_file(ROOT, rel, name), src_root="src", rel_path=rel, kind=kind)
        db.add("importance", hash=h, tier=tier)
        for table, row in rows:
            db.add(table, hash=h, **row)
    return db


def run(module, db, *argv):
    rclone = FakeRclone()
    with mock.patch.dict(sys.modules, {"pymysql": fake_pymysql(db)}), \
         mock.patch.object(module.subprocess, "run", rclone.run), \
         mock.patch.object(sys, "argv", [module.__name__, *argv]):
        module.main()
    return rclone


def names(paths):
    return sorted(os.path.basename(p).rsplit(".", 1)[0] for p in paths)


class GoogleDriveGates(unittest.TestCase):
    def test_only_clear_files_are_queued_and_recorded(self):
        db = build_db(CASES)
        rclone = run(gdrive_push, db, "--tier", "1", "--batch", "t")
        allowed = sorted(n for n, (_, ok) in CASES.items() if ok)
        self.assertEqual(names(rclone.copied), allowed)
        self.assertEqual(sorted(h.rstrip("0") for h, _ in db.recorded), allowed)

    def test_owner_private_decision_becomes_an_exclusion(self):
        db = build_db(CASES)
        run(gdrive_push, db, "--tier", "1", "--batch", "t")
        rows = db.rows("SELECT hash, decided_by FROM offsite_exclusion WHERE status = 'blocked' AND reason = 'other'")
        self.assertIn(("owner_private".ljust(64, "0"), "owner"), rows)

    def test_video_needs_a_clear_production_scan(self):
        cases = {
            "video_unscanned": ([("sensitive_flag", dict(status="clear"))], False),
            "video_clear": ([("sensitive_flag", dict(status="clear")), ("pro_production_scan", dict(status="clear"))], True),
            "video_candidate": ([("sensitive_flag", dict(status="clear")),
                                 ("pro_production_scan", dict(status="candidate"))], False),
        }
        rclone = run(gdrive_push, build_db(cases, kind="mp4"), "--tier", "1", "--batch", "t")
        self.assertEqual(names(rclone.copied), ["video_clear"])

    def test_incomplete_takeout_index_uploads_nothing(self):
        db = build_db(CASES)
        db.sql.execute("UPDATE takeout_parts SET status = 'running' WHERE part = 'part-2'")
        rclone = run(gdrive_push, db, "--tier", "1", "--batch", "t")
        self.assertEqual(rclone.calls, [])
        self.assertEqual(db.recorded, [])

    def test_missing_privacy_scan_table_uploads_nothing(self):
        rclone = run(gdrive_push, build_db(CASES, missing_tables={"sensitive_flag"}), "--tier", "1", "--batch", "t")
        self.assertEqual(rclone.calls, [])

    def test_dry_run_hands_nothing_to_rclone(self):
        db = build_db(CASES)
        rclone = run(gdrive_push, db, "--tier", "1", "--batch", "t", "--dry-run")
        self.assertEqual(rclone.calls, [])
        self.assertEqual(db.recorded, [])


class OneDriveGates(unittest.TestCase):
    def test_only_clear_files_are_queued(self):
        cases = {k: v for k, v in CASES.items() if k not in ("already_offsite", "in_takeout")}
        cases["on_google_only"] = ([("sensitive_flag", dict(status="clear")),
                                    ("offsite_copy", dict(provider="gdrive", verified_by="rclone_check"))], True)
        rclone = run(onedrive_push, build_db(cases), "--batch", "t")
        self.assertEqual(names(rclone.copied), sorted(n for n, (_, ok) in cases.items() if ok))

    def test_refuses_other_tiers(self):
        with self.assertRaises(SystemExit):
            run(onedrive_push, build_db(CASES), "--tier", "2", "--batch", "t")

    def test_video_only_when_owner_tagged(self):
        clear = [("sensitive_flag", dict(status="clear")), ("pro_production_scan", dict(status="clear"))]
        db = build_db({"video_untagged": (clear, False), "video_tagged": (clear, True),
                       "video_tagged_private": ([("sensitive_flag", dict(status="private")),
                                                 ("pro_production_scan", dict(status="clear"))], False)},
                      kind="mp4")
        db.sql.execute("UPDATE importance SET decided_by = 'owner' WHERE hash LIKE 'video_tagged%'")
        rclone = run(onedrive_push, db, "--batch", "t")
        self.assertEqual(names(rclone.copied), ["video_tagged"])


if __name__ == "__main__":
    unittest.main()
