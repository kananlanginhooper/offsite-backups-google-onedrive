"""Test doubles for the pushers: a MySQL-flavored cursor over in-memory SQLite, and a fake rclone.

The pushers' SQL runs for real against SQLite, so the tests exercise the actual gate statements.
Only the MySQL-specific bits are translated (placeholders, INSERT IGNORE, CONCAT, information_schema).
No network, no real paths, no real data.
"""
import hashlib
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
    """Stands in for subprocess.run: 'copies' by remembering, verifies against the local files."""

    def __init__(self):
        self.copied = []   # relative paths handed to rclone copy
        self.calls = []

    def run(self, cmd, **_kw):
        self.calls.append(cmd[:2])
        lst = cmd[cmd.index("--files-from-raw") + 1]
        with open(lst, encoding="utf-8") as f:
            rels = [line for line in f.read().splitlines() if line]
        out = ""
        if cmd[1] == "copy":
            self.copied += rels
            self._root = cmd[2]
        elif cmd[1] == "md5sum":
            out = "".join(f"{_md5(self._root + r)}  {r}\n" for r in rels)
        elif cmd[1] == "check":
            with open(cmd[cmd.index("--combined") + 1], "w", encoding="utf-8") as f:
                f.writelines(f"= {r}\n" for r in rels)
        return types.SimpleNamespace(returncode=0, stdout=out, stderr="")


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
