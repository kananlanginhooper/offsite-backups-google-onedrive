# Pushers

The jobs that copy files offsite with rclone and record each verified copy in the catalogue's `offsite_copy` table. The dashboard reads that table.

| File | What it does |
|---|---|
| `gdrive_push.py` | Google Drive: picks files by `--tier`, `--project` or a named batch, copies them in chunks (300 files or 20 GB), and verifies each one by MD5 before recording it. It stops for the day at Google's upload cap. |
| `onedrive_push.py` | OneDrive: the irreplaceable set only (tier 1). Video is left out unless the owner tagged it. Verifies with `rclone check --combined`, because OneDrive's native hash isn't MD5. |
| `common.py` | The shared gates and helpers. |
| `config.py` | Reads every setting from the repo's `.env`. |
| `push-ctl.sh gdrive\|onedrive start\|stop\|status` | Starts a queue only when this runner holds the job lock and the remote is signed in. Stops it without killing itself. |
| `push-queue.sh`, `onedrive-queue.sh` | Google runs the batches in `PUSH_GDRIVE_QUEUE` in order, resuming after the daily cap. OneDrive makes one pass over tier 1. |

## Safety gates (unchanged from the live jobs)

A file goes offsite only when **all** of these hold:

- its privacy scan (`sensitive_flag`) is `clear` or `fine`;
- it has no `offsite_exclusion` row (the Google pusher first turns the owner's own `private` and `pro production` decisions into exclusions);
- its screenshot text isn't flagged `flagged` or `private` (`text_sensitivity_flag`);
- its category isn't on the sensitive list (`content_category` joined to `sensitive_category`);
- for video, a professional-production scan came back `clear`;
- there's no verified copy of that hash there yet;
- the Takeout index is complete. Otherwise nothing uploads, so nothing Google already has gets uploaded again.

Each optional gate checks that its table exists first, so a table that hasn't been built yet never breaks a push.

## Settings

The `PUSH_*`, `GDRIVE_*`, `ONEDRIVE_*` and `RECOVERY_DB_*` keys in `.env.example`. Batch definitions go in the JSON file named by `PUSH_BATCHES_FILE` (shaped like `batches.example.json`), kept out of git.

Requires Python 3.10+ with `pymysql`, and rclone with the remotes signed in.
