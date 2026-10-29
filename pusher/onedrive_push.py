"""Push the irreplaceable set (importance tier 1) to OneDrive, one copy per hash.

Ported from the live push job; same gates as the Google pusher, plus:
  - defaults to --tier 1 and refuses any other tier without --force-tier (OneDrive holds only the
    irreplaceable subset, so a slipped flag must not fill it with everything);
  - leaves video out unless the owner tagged it high-value (importance tier 1 with
    decided_by = PUSH_OWNER_TAG; automatic tiering never sets that). --allow-video-tier1 overrides;
  - the files move through the standalone onedrive-rclone CLI (OneDriveRclone repo), which
    verifies each by QuickXorHash, OneDrive's own hash, computed by rclone on both sides.
"""
import argparse
import os
import sys

import common
import config
from common import log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", type=int, default=1)
    ap.add_argument("--force-tier", action="store_true", help="allow a tier other than 1")
    ap.add_argument("--allow-video-tier1", action="store_true", help="include video kinds")
    ap.add_argument("--batch", required=True, help="label recorded on each offsite_copy row")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.tier != 1 and not a.force_tier:
        log(f"refusing tier {a.tier}: OneDrive is the irreplaceable set (tier 1) only. Pass --force-tier to override.")
        sys.exit(2)

    provider = config.Provider("onedrive")
    cur = config.connect().cursor()
    if not common.preflight(cur):
        return

    video = common.video_kinds_sql()
    not_offsite = ("NOT EXISTS (SELECT 1 FROM offsite_copy o WHERE o.hash = i.hash AND o.provider = 'onedrive' AND o.verified_by <> 'none')"
                   " AND NOT EXISTS (SELECT 1 FROM offsite_exclusion x WHERE x.hash = i.hash)"
                   " AND EXISTS (SELECT 1 FROM sensitive_flag sf WHERE sf.hash = i.hash AND sf.status IN ('clear','fine'))"
                   + common.text_sensitivity_gate(cur) + common.sensitive_category_gate(cur) +
                   f" AND (i.kind NOT IN ({video}) OR EXISTS (SELECT 1 FROM"
                   " pro_production_scan pp WHERE pp.hash = i.hash AND pp.status = 'clear'))")
    args: list = []
    if not a.allow_video_tier1:
        not_offsite += (f" AND (i.kind NOT IN ({video}) OR EXISTS (SELECT 1 FROM importance vi"
                        " WHERE vi.hash = i.hash AND vi.tier = 1 AND vi.decided_by = %s))")
        args.append(config.OWNER)
    cur.execute(f"SELECT i.hash, i.dest_path FROM importance imp JOIN {config.INVENTORY} i ON i.hash = imp.hash"
                f" WHERE imp.tier = %s AND {not_offsite}" + common.order_by(),
                (a.tier, *args, *common.order_args()))

    files = common.pick_files(cur.fetchall(), f"tier {a.tier} (onedrive)")
    bw = os.environ.get("ONEDRIVE_PUSH_BWLIMIT")
    rc = common.push_with_cli(cur, provider, files, a.batch, a.dry_run, ["--bwlimit", bw] if bw else [])
    if rc == 7:
        log("OneDrive is full or throttling; stopping this run")


if __name__ == "__main__":
    main()
