"""
Generate per-section RSS 2.0 feeds from each section's posts.md.

Outputs (at site root):
    feed.xml       — author transmissions
    futures.xml    — speculative futures
    maps.xml       — speculative maps (only if maps/content/posts.md exists)
    ams.xml        — A Mote in Shadow

Each <item>'s <guid> matches the stub URL produced by gen-post-stubs.py
(/p/<slug> or /p/<section>/<slug>), so guids stay stable across edits.

Run after editing any posts.md:
    python scripts/gen-feed.py
"""

import html
import re
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://lastnpcalex.agency"

# (posts_md_rel, feed_filename, feed_title, feed_desc, landing_page)
FEEDS = [
    ("author/content/posts.md",  "feed.xml",    "lastnpcalex — transmissions",
     "hard SF transmissions from A.N. Alex ;; physics as constraint. humanity as nodes pulsing in the dark.",
     "/"),
    ("futures/content/posts.md", "futures.xml", "lastnpcalex — speculative futures",
     "µfiction by A.N. Alex ;; collected transmissions from the vectoral periphery.",
     "/futures.html"),
    ("maps/content/posts.md",    "maps.xml",    "lastnpcalex — speculative maps",
     "charts and maps based on the writing of A.N. Alex.",
     "/maps.html"),
    ("ams/content/posts.md",     "ams.xml",     "lastnpcalex — a mote in shadow",
     "A Mote in Shadow (EXU Book 1) ;; link page and announcements.",
     "/ams.html"),
]


def parse_posts(md_text: str):
    """Same parser as gen-post-stubs.py — kept self-contained so this script
    runs standalone without importing a hyphenated filename."""
    md_text = re.sub(r"<!--[\s\S]*?-->", "", md_text)
    sections = re.split(r"^## ", md_text, flags=re.MULTILINE)[1:]
    posts = []
    for section in sections:
        lines = section.strip().split("\n")
        if not lines:
            continue
        post = {"slug": lines[0].strip(), "tags": []}
        excerpt_lines = []
        in_meta = True
        for line in lines[1:]:
            m = re.match(r"^\s*-\s*(\w+):\s*(.+)$", line)
            if m and in_meta:
                key, value = m.group(1), m.group(2).strip()
                if key == "tags":
                    post["tags"] = [t.strip() for t in value.split(",")]
                else:
                    post[key] = value
            elif line.strip():
                in_meta = False
                excerpt_lines.append(line)
        post["excerpt"] = " ".join(excerpt_lines).strip()
        posts.append(post)
    return posts


def rfc822(date_str: str) -> str:
    """Convert 2026.06.17 → RFC-822 pubDate (e.g. Tue, 17 Jun 2026 00:00:00 GMT)."""
    d = datetime.strptime(date_str, "%Y.%m.%d").replace(tzinfo=timezone.utc)
    return formatdate(d.timestamp(), usegmt=True)


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def build_item(post: dict, landing_page: str, stub_subdir: str) -> str:
    slug = post["slug"]
    link = f"{SITE}{landing_page}#post/{slug}"
    guid = f"{SITE}/p/{stub_subdir}/{slug}" if stub_subdir else f"{SITE}/p/{slug}"
    cats = "".join(
        f"\n      <category>{esc(t)}</category>" for t in post.get("tags", []) if t
    )
    pubdate = (
        f"\n      <pubDate>{rfc822(post['date'])}</pubDate>"
        if post.get("date")
        else ""
    )
    return (
        "    <item>\n"
        f"      <title>{esc(post.get('title', slug))}</title>\n"
        f"      <link>{esc(link)}</link>\n"
        f"      <guid isPermaLink=\"true\">{esc(guid)}</guid>{pubdate}\n"
        f"      <description>{esc(post.get('excerpt', ''))}</description>{cats}\n"
        "    </item>"
    )


def build_feed(posts, feed_title, feed_desc, landing_page, stub_subdir) -> str:
    items = "\n".join(build_item(p, landing_page, stub_subdir) for p in posts)
    channel_link = f"{SITE}{landing_page}"
    last_build = formatdate(usegmt=True)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        f"    <title>{esc(feed_title)}</title>\n"
        f"    <link>{esc(channel_link)}</link>\n"
        f"    <description>{esc(feed_desc)}</description>\n"
        "    <language>en-us</language>\n"
        f"    <lastBuildDate>{last_build}</lastBuildDate>\n"
        f"{items}\n"
        "  </channel>\n"
        "</rss>\n"
    )


def main():
    for posts_rel, feed_file, feed_title, feed_desc, landing_page in FEEDS:
        posts_md = ROOT / posts_rel
        if not posts_md.exists():
            continue
        # stub_subdir matches gen-post-stubs.py so GUIDs align with stub URLs
        stub_subdir = "" if posts_rel.startswith("author/") else posts_rel.split("/")[0]
        posts = parse_posts(posts_md.read_text(encoding="utf-8"))
        # newest first — YYYY.MM.DD sorts lexicographically as chronological
        posts.sort(key=lambda p: p.get("date", ""), reverse=True)
        xml = build_feed(posts, feed_title, feed_desc, landing_page, stub_subdir)
        (ROOT / feed_file).write_text(xml, encoding="utf-8")
        print(f"  wrote {feed_file} ({len(posts)} items)")
    print("done")


if __name__ == "__main__":
    main()
