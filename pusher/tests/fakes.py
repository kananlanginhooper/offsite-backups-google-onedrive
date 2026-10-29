"""Test doubles for the pushers: a MySQL-flavored cursor over in-memory SQLite, and a fake rclone.

The pushers' SQL runs for real against SQLite, so the tests exercise the actual gate statements.
Only the MySQL-specific bits are translated (placeholders, INSERT IGNORE, CONCAT, information_schema).
No network, no real paths, no real data.
"""
import hashlib
import json
import os
import re
import sqlite3
import types

SCHEMA = """
CREATE TABLE inventory (hash TEXT, dest_path TEXT, src_root TEXT, rel_path TEXT, kind TEXT);
CREATE TABLE importance (hash TEXT PRIMARY KEY, tier INT, decided_by TEXT DEFAULT 'rule');
CREATE TABLE sensitive_flag (hash TEXT, status TEXT, decided_by TEXT DEFAULT 'rule', source_path TEXT);
CREATE TABLE text_sensitivity_flag (source TEXT, hash TEXT, status TEXT);
CREATE TABLE pro_production_scan (hash TEXT, status TEXT, decided_by TEXT DEFAULT 'rule', source_path TEXT);
CREATE TABLE offsite_copy (hash TEXT, provider TEXT, verified_by TEXT);
CREATE TABLE offsite_exclusion (hash TEXT PRIMARY KEY, reason TEXT, status TEXT, keep_on_laptop INT,
                                rule TEXT, sample_path TEXT, decided_by TEXT);
CREATE TABLE content_category (hash TEXT, category TEXT);
CREATE TABLE sensitive_category (category TEXT PRIMARY KEY);
CREATE TABLE takeout_parts (part TEXT, status TEXT);
CREATE TABLE takeout_extract (hash TEXT, action TEXT);
CREATE TABLE project_folder (src_root TEXT, rel_prefix TEXT, project TEXT);
"""


class FakeDb:
    """One SQLite database plus a log of the offsite_copy rows the pusher recorded."""

    def __init__(self, missing_tables=()):
        self.sql = sqlite3.connect(":memory:")
        self.sql.executescript(SCHEMA)
        self.sql.create_function("CONCAT", -1, lambda *a: "".join("" if x is None else str(x) for x in a))
        self.missing = set(missing_tables)
        self.recorded = []  # (hash, provider)

    def cursor(self):
        return FakeCursor(self)

    def add(self, table, **row):
        cols = ", ".join(row)
        self.sql.execute(f"INSERT INTO {table} ({cols}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))

    def rows(self, query, *args):
        return self.sql.execute(query, args).fetchall()


class FakeCursor:
    def __init__(self, db):
        self.db = db
        self.result = []

    def execute(self, sql, args=None):
        if "information_schema.tables" in sql:
            name = (args or [None])[-1] or re.search(r"table_name = '(\w+)'", sql).group(1)
            self.result = [(0 if name in self.db.missing else 1,)]
            return
        if sql.lstrip().startswith("INSERT INTO offsite_copy"):
            # pusher recorded a verified copy: (hash, provider|account, ...) - keep hash + provider
            provider = re.search(r"VALUES \(%s,'?(\w+|%s)'?", sql).group(1)
            provider = args[1] if provider == "%s" else provider
            self.db.recorded.append((args[0], provider))
            self.result = []
            return
        if args is not None:
            sql = sql.replace("%s", "?").replace("%%", "%")
        sql = sql.replace("INSERT IGNORE", "INSERT OR IGNORE")
        self.result = self.db.sql.execute(sql, tuple(args or ())).fetchall()

    def fetchone(self):
        return self.result[0] if self.result else None

    def fetchall(self):
        return self.result


class FakeRclone:
    """Stands in for subprocess.run calling the provider CLI (gdrive-rclone / onedrive-rclone):
    'copies' every listed file by remembering it, and reports each as copied in the manifest."""

    def __init__(self):
        self.copied = []   # local paths handed to the CLI
        self.listed = []   # the list rows as sent (local_path, remote_path, sha256)
        self.calls = []

    def run(self, cmd, **_kw):
        self.calls.append(cmd)
        with open(cmd[cmd.index("--list") + 1], encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        self.listed += rows
        with open(cmd[cmd.index("--manifest") + 1], "a", encoding="utf-8") as f:
            for r in rows:
                self.copied.append(r["local_path"])
                f.write(json.dumps({"local_path": r["local_path"], "remote_path": r["remote_path"],
                                    "remote_hash": _md5(r["local_path"]), "hash_type": "md5",
                                    "status": "copied"}) + "\n")
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")


def _md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def fake_pymysql(db):
    return types.SimpleNamespace(connect=lambda **_kw: db)


def write_file(root, rel, text):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return root + rel
