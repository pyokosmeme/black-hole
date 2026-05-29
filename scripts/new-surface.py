"""
Add a new surface node to surfaces/config.json.

USAGE:
    python scripts/new-surface.py --slug my-thing --title "MY THING" \
        --url https://example.com [--repo URL] [--tags a,b] \
        [--flavor "one-line voice fragment"] [--desc "..."] [--local]

    --local      creates surfaces/<slug>/index.html scaffold so the surface
                 is hosted in-repo at /surfaces/<slug>/. omit for link-out.

Re-run scripts/gen-post-stubs.py afterward if you want OG stubs.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG_PATH = ROOT / "surfaces" / "config.json"

SCAFFOLD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{title} // surfaces</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(ellipse at center, #2a0d3f 0%, #0a0618 70%);
      color: #f4e9d4;
      font-family: 'Share Tech Mono', monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }}
    .wrap {{ max-width: 720px; text-align: center; }}
    h1 {{ color: #ffb347; letter-spacing: 4px; }}
    a {{ color: #c79bff; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>{title}</h1>
    <p><em>surface scaffold ;; vibe-code here.</em></p>
    <p><a href="/surfaces.html">← surfaces</a></p>
  </div>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--url", required=True, help="destination URL (external or local path)")
    ap.add_argument("--repo", default="", help="optional source-code URL")
    ap.add_argument("--tags", default="", help="comma-separated tags")
    ap.add_argument("--flavor", default="", help="one-line voice fragment")
    ap.add_argument("--desc", default="", help="1-2 sentence description")
    ap.add_argument("--local", action="store_true", help="scaffold surfaces/<slug>/index.html")
    args = ap.parse_args()

    cfg = json.loads(CFG_PATH.read_text(encoding="utf-8"))
    surfaces = cfg.setdefault("surfaces", [])

    if any(s["slug"] == args.slug for s in surfaces):
        print(f"slug '{args.slug}' already exists", file=sys.stderr)
        sys.exit(1)

    entry = {
        "slug": args.slug,
        "title": args.title,
        "url": args.url,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "flavor": args.flavor,
        "desc": args.desc,
    }
    if args.repo:
        entry["repo"] = args.repo
    if args.local:
        entry["local"] = True
        entry["url"] = f"/surfaces/{args.slug}/"
        local_dir = ROOT / "surfaces" / args.slug
        local_dir.mkdir(parents=True, exist_ok=True)
        index = local_dir / "index.html"
        if not index.exists():
            index.write_text(SCAFFOLD.format(title=args.title), encoding="utf-8")
            print(f"  scaffolded {index.relative_to(ROOT)}")

    surfaces.append(entry)
    CFG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  added surface '{args.slug}' to surfaces/config.json")
    print("done")


if __name__ == "__main__":
    main()
