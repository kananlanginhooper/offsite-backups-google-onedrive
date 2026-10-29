#!/bin/bash
# OneDrive: one pass over the irreplaceable set (tier 1). Re-runnable: verified hashes are skipped.
set -u
cd "$(dirname "$0")"
mkdir -p logs
LOG=logs/onedrive-push.log
BATCH="onedrive-tier1-$(date +%Y-%m-%d)"
out="logs/onedrive-push-$(date +%Y%m%d).log"
echo "$(date -Is) run onedrive_push.py --tier 1 --batch $BATCH" >> $LOG
nice -n 10 python3 onedrive_push.py --tier 1 --batch "$BATCH" >> "$out" 2>&1
n=$(grep -E "hashes, .* GB to push" "$out" | tail -1 | sed -E 's/.*: ([0-9]+) hashes.*/\1/')
echo "$(date -Is) tier 1 started with ${n:-?} hashes left" >> $LOG
