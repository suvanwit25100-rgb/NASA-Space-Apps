"""
Push alerts without a server of our own, using the free public ntfy.sh service.

After nrt_update.py writes app/public/data/nrt.json, this compares each area's newest-week anomaly (z) with the level it
had at the last run and sends a notification only when an area RISES past +2.0 or +3.0 standard deviations, and at least +50% on the same week, (so a quiet
area never pings, and a persistently hot area pings once, not every day). Anyone can subscribe on their phone or in a
browser to the topic  globalburnlog-<area id>  at https://ntfy.sh. Nothing personal is stored or sent: the messages carry
only public fire statistics, and the subscriber list lives with ntfy, not with us.

First run (no state file) records the current levels without sending anything, to avoid a flood.
At most MAX_PER_RUN messages are sent per run (the strongest first) to stay inside ntfy's anonymous rate limits.

Usage:
    python3 pipeline/send_alerts.py [--dry-run] [--test]
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "public" / "data"
STATE = DATA / "alerts_state.json"
SITE = "https://globalburnlog.earth"
NTFY = "https://ntfy.sh"
LEVELS = (2.0, 3.0)  # "notable" and "extreme", in standard deviations
MIN_RATIO = 1.5  # and at least +50% on the same week of earlier years: the near-real-time feed runs a little high, so small excesses are not alerted
MAX_PER_RUN = 40
MIN_TYPICAL = 500  # ignore areas with fewer than this many typical cell-days a week; their z is too noisy
# only the world and the curated regions: the near-real-time feed cannot drop gas flares the way the archive does, which
# still leaves some small countries over-read after our persistent-spot filter


def level_of(z: float) -> float:
    return max([0.0] + [lv for lv in LEVELS if z >= lv])


def post(topic: str, title: str, body: str, click: str, priority: str, dry: bool) -> bool:
    if dry:
        print(f"[dry-run] {topic} | {title} | {body}")
        return True
    r = requests.post(
        f"{NTFY}/{topic}",
        data=body.encode("utf-8"),
        headers={"Title": title, "Tags": "fire", "Priority": priority, "Click": click},
        timeout=30,
    )
    if r.status_code == 429:
        print("ntfy rate limit reached; stopping", file=sys.stderr)
        return False
    r.raise_for_status()
    time.sleep(1)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true", help="send one test message to the topic globalburnlog-test and exit")
    args = ap.parse_args()

    if args.test:
        ok = post("globalburnlog-test", "Global Burn Log test", "If you can read this, push alerts work.", SITE, "default", args.dry_run)
        print("test sent" if ok else "test failed")
        return

    nrt = json.loads((DATA / "nrt.json").read_text())
    regs = json.loads((DATA / "regions.json").read_text())["regions"]
    names = {r["id"]: r["name"] for r in regs if r["kind"] in ("world", "featured")}
    first_run = not STATE.exists()
    prev = {} if first_run else json.loads(STATE.read_text())
    prev_levels = prev.get("levels", {})

    levels = {}
    fresh = []
    for aid, a in nrt["areas"].items():
        if aid not in names:
            continue
        lv = level_of(a["z"]) if a["typical"] >= MIN_TYPICAL and a["n"] / a["typical"] >= MIN_RATIO else 0.0
        levels[aid] = lv
        if not first_run and lv > prev_levels.get(aid, 0.0):
            fresh.append((a["z"], aid, a, lv))
    fresh.sort(reverse=True)

    sent = 0
    if first_run:
        print(f"first run: recorded {len(levels)} areas, nothing sent")
    for z, aid, a, lv in fresh[:MAX_PER_RUN]:
        name = names.get(aid, aid)
        pct = round((a["n"] / a["typical"] - 1) * 100)
        title = f"{name}: fire activity {'extreme' if lv >= 3 else 'well above normal'}"
        body = (f"{a['n']:,} burning cell-days in {nrt['start']} to {nrt['end']}, {pct:+d}% against the same week in 2013-2025 "
                f"({z:+.1f} standard deviations). Near-real-time data, about 12 days behind.")
        if not post(f"globalburnlog-{aid}", title, body, f"{SITE}/seasons?aoi={aid}", "high" if lv >= 3 else "default", args.dry_run):
            break
        sent += 1
    if len(fresh) > MAX_PER_RUN:
        print(f"{len(fresh) - MAX_PER_RUN} further alerts held back by the per-run cap")
    print(f"{sent} alert(s) sent" + (" (dry run)" if args.dry_run else ""))
    if not args.dry_run:
        STATE.write_text(json.dumps({"end": nrt["end"], "levels": levels}, separators=(",", ":")))


if __name__ == "__main__":
    main()
