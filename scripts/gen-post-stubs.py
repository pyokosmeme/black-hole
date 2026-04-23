"""
Generate per-transmission OG stub pages at p/<slug>.html.

Each stub carries Open Graph tags specific to the post (title, excerpt, URL)
so link scrapers (Bluesky, Twitter, etc.) render a per-post card. Real
browsers are redirected to the SPA route /#post/<slug>.

Run after editing author/content/posts.md:
    python scripts/gen-post-stubs.py
"""

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_MD = ROOT / "author" / "content" / "posts.md"
OUT_DIR = ROOT / "p"
SITE = "https://lastnpcalex.agency"
DEFAULT_IMAGE = f"{SITE}/img/banner.png"


def parse_posts(md_text: str):
    # Strip HTML comments so example blocks don't leak in.
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


STUB = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} // lastnpcalex.agency</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="lastnpcalex.agency">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{site}/p/{slug}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<link rel="canonical" href="{site}/#post/{slug}">
<meta http-equiv="refresh" content="0;url=/#post/{slug}">
<script>window.location.replace('/#post/{slug}');</script>
<style>body{{background:#0a0a1a;color:#0ff;font-family:monospace;padding:2rem;}}</style>
</head>
<body>
<p>Redirecting to transmission… <a href="/#post/{slug}">continue manually</a>.</p>
</body>
</html>
"""


def build_stub(post: dict) -> str:
    title = post.get("title", post["slug"])
    excerpt = post.get("excerpt", "")
    if len(excerpt) > 300:
        excerpt = excerpt[:297].rstrip() + "…"
    return STUB.format(
        title=html.escape(title, quote=True),
        desc=html.escape(excerpt, quote=True),
        slug=post["slug"],
        site=SITE,
        image=DEFAULT_IMAGE,
    )


def main():
    md_text = POSTS_MD.read_text(encoding="utf-8")
    posts = parse_posts(md_text)
    OUT_DIR.mkdir(exist_ok=True)

    existing = {p.name for p in OUT_DIR.glob("*.html")}
    current = set()
    for post in posts:
        slug = post["slug"]
        fname = f"{slug}.html"
        current.add(fname)
        (OUT_DIR / fname).write_text(build_stub(post), encoding="utf-8")
        print(f"  wrote p/{fname}")

    stale = existing - current
    for name in stale:
        (OUT_DIR / name).unlink()
        print(f"  removed stale p/{name}")

    print(f"done: {len(posts)} stub(s)")


if __name__ == "__main__":
    main()
