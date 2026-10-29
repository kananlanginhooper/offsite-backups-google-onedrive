"""Push the irreplaceable set (importance tier 1) to OneDrive, one copy per hash.

Ported from the live push job; same gates as the Google pusher, plus:
  - defaults to --tier 1 and refuses any other tier without --force-tier (OneDrive holds only the
    irreplaceable subset, so a slipped flag must not fill it with everything);
  - leaves video out unless the owner tagged it high-value (importance tier 1 with
    decided_by = PUSH_OWNER_TAG; automatic tiering never sets that). --allow-video-tier1 overrides;
  - verifies with `rclone check --combined`: OneDrive's native hash isn't MD5, and rclone computes
    the matching hash on the local side too.
"""
import argparse
import os
import subprocess
import sys
import tempfile

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

    chunks = common.plan_chunks(cur.fetchall(), f"tier {a.tier} (onedrive)")
    for n, (root, items) in enumerate(chunks, 1):
        log(f"chunk {n}/{len(chunks)}: {len(items)} files")
        remote_dir = f"{provider.remote}{provider.base}/"
        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as lst:
            lst.write("\n".join(rel for _, rel in items) + "\n")
        cmd = ["rclone", "copy", root, remote_dir, "--files-from-raw", lst.name,
               "--transfers", "4", "--checkers", "8", "--stats", "60s", "--stats-one-line"]
        if os.environ.get("ONEDRIVE_PUSH_BWLIMIT"):
            cmd += ["--bwlimit", os.environ["ONEDRIVE_PUSH_BWLIMIT"]]
        print(" ".join(cmd), flush=True)
        if a.dry_run:
            os.unlink(lst.name)
            continue
        r = subprocess.run(cmd)
        if r.returncode != 0:
            log(f"rclone copy exit {r.returncode}; recording only what verifies")

        report = lst.name + ".check"
        subprocess.run(["rclone", "check", root, remote_dir, "--files-from-raw", lst.name,
                        "--combined", report, "--one-way"], capture_output=True, text=True)
        verified = set()
        if os.path.exists(report):
            with open(report, encoding="utf-8") as f:
                verified = {line[2:].rstrip("\n") for line in f if line.startswith("= ")}
            os.unlink(report)

        ok = bad = 0
        for h, rel in items:
            if rel not in verified:
                bad += 1
                log(f"NOT VERIFIED {rel}")
                continue
            common.record_copy(cur, provider, h, rel, root, None, "rclone_check", a.batch)
            ok += 1
        os.unlink(lst.name)
        log(f"{root}: verified {ok}, not verified {bad}")


if __name__ == "__main__":
    main()
