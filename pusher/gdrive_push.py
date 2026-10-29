"""Push catalogued files to Google Drive, one copy per hash, MD5-verified.

Ported from the live push job; same selection and gates. A run picks files by --tier, by
--project, or by a named batch (source roots and kinds) from PUSH_BATCHES_FILE. The files move
through the standalone gdrive-rclone CLI (GoogleDriveRclone repo), which verifies each by MD5.
"""
import argparse
import json
import os

import common
import config
from common import log


def load_batch(name: str) -> dict:
    with open(config.get("PUSH_BATCHES_FILE"), encoding="utf-8") as f:
        batches = json.load(f)
    if name not in batches:
        raise SystemExit(f"no batch {name!r} in PUSH_BATCHES_FILE")
    return batches[name]


def block_owner_decisions(cur) -> None:
    """Turn the owner's own 'private' and 'pro production' decisions into exclusions first."""
    owner = config.OWNER
    cur.execute("INSERT IGNORE INTO offsite_exclusion (hash, reason, status, keep_on_laptop, rule, sample_path, decided_by)"
                f" SELECT sf.hash, 'other', 'blocked', 1, '{owner} marked private on review page', sf.source_path, %s"
                " FROM sensitive_flag sf WHERE sf.status = 'private' AND sf.decided_by = %s", (owner, owner))
    cur.execute("INSERT IGNORE INTO offsite_exclusion (hash, reason, status, keep_on_laptop, rule, sample_path, decided_by)"
                f" SELECT pp.hash, 'pro_production', 'blocked', 1, '[screen capture] {owner} confirmed logo-scan candidate',"
                " pp.source_path, %s FROM pro_production_scan pp"
                " WHERE pp.decided_by = %s AND pp.status = 'candidate'", (owner, owner))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", type=int)
    ap.add_argument("--project")
    ap.add_argument("--batch-def", help="name of a batch in PUSH_BATCHES_FILE (source roots, kinds)")
    ap.add_argument("--batch", required=True, help="label recorded on each offsite_copy row")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    provider = config.Provider("gdrive")
    inv = config.INVENTORY
    cur = config.connect().cursor()
    if not common.table_exists(cur, "sensitive_flag"):
        log("sensitive_flag table missing: allow-list rule means nothing may upload")
        return
    if not a.dry_run:
        block_owner_decisions(cur)
    if not common.preflight(cur):
        return

    not_offsite = ("NOT EXISTS (SELECT 1 FROM offsite_copy o WHERE o.hash = i.hash AND o.verified_by <> 'none')"
                   " AND NOT EXISTS (SELECT 1 FROM offsite_exclusion x WHERE x.hash = i.hash)"
                   " AND EXISTS (SELECT 1 FROM sensitive_flag sf WHERE sf.hash = i.hash AND sf.status IN ('clear','fine'))"
                   + common.text_sensitivity_gate(cur) + common.sensitive_category_gate(cur) +
                   " AND NOT EXISTS (SELECT 1 FROM takeout_extract te WHERE te.hash = i.hash AND te.action IN ('new','dup'))"
                   f" AND (i.kind NOT IN ({common.video_kinds_sql()}) OR EXISTS (SELECT 1 FROM"
                   " pro_production_scan pp WHERE pp.hash = i.hash AND pp.status = 'clear'))")
    in_project = ("EXISTS (SELECT 1 FROM project_folder p WHERE p.src_root = i.src_root"
                  " AND i.rel_path LIKE CONCAT(p.rel_prefix, '%%'){})")
    order, oargs = common.order_by(), common.order_args()

    if a.project:
        cur.execute(f"SELECT i.hash, i.dest_path FROM {inv} i WHERE i.hash IS NOT NULL AND "
                    + in_project.format(" AND p.project = %s") + f" AND {not_offsite}" + order, (a.project, *oargs))
    elif a.tier is not None:
        cur.execute(f"SELECT i.hash, i.dest_path FROM importance imp JOIN {inv} i ON i.hash = imp.hash"
                    f" WHERE imp.tier = %s AND {not_offsite}" + order, (a.tier, *oargs))
    else:
        b = load_batch(a.batch_def or a.batch)
        roots, except_roots = b.get("src_roots", []), b.get("all_roots_except", [])
        kinds, inc = b.get("exclude_kinds", []), b.get("include_kinds", [])
        cur.execute(
            f"SELECT i.hash, i.dest_path FROM {inv} i WHERE i.hash IS NOT NULL"
            + (f" AND i.src_root IN ({','.join(['%s'] * len(roots))})" if roots else "")
            + "".join(" AND i.src_root NOT LIKE %s" for _ in except_roots)
            + (f" AND i.kind NOT IN ({','.join(['%s'] * len(kinds))})" if kinds else "")
            + (f" AND i.kind IN ({','.join(['%s'] * len(inc))})" if inc else "")
            + f" AND {not_offsite} AND NOT " + in_project.format("") + order,
            (*roots, *except_roots, *kinds, *inc, *oargs))

    label = f"tier {a.tier}" if a.tier is not None else f"batch {a.batch}"
    files = common.pick_files(cur.fetchall(), label)
    rc = common.push_with_cli(cur, provider, files, a.batch, a.dry_run,
                              ["--bwlimit", os.environ.get("PUSH_BWLIMIT", "40M")])
    if rc == 7:
        log("rclone fatal error (daily upload limit?); stopping this run")


if __name__ == "__main__":
    main()
