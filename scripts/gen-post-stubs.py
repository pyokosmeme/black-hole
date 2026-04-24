"""
Generate per-transmission OG stub pages at p/<stub_dir>/<slug>.html.

Each stub carries Open Graph tags specific to the post (title, excerpt, URL)
so link scrapers (Bluesky, Twitter, etc.) render a per-post card. Real
browsers are redirected to the SPA route <page>#post/<slug>.

Run after editing any posts.md:
    python scripts/gen-post-stubs.py
"""

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://lastnpcalex.agency"
DEFAULT_IMAGE = f"{SITE}/img/banner.png"

# Each entry: (posts_md_path, stub_subdir, redirect_page)
# stub_subdir="" means stubs go directly in p/
SOURCES = [
    ("author/content/posts.md",   "",        "/"),
    ("futures/content/posts.md",  "futures", "/futures.html"),
    ("maps/content/posts.md",     "maps",    "/maps.html"),
    ("ams/content/posts.md",      "ams",     "/ams.html"),
]


def parse_posts(md_text: str):
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
<meta property="og:url" content="{stub_url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<link rel="canonical" href="{site}{page}#post/{slug}">
<meta http-equiv="refresh" content="0;url={page}#post/{slug}">
<script>window.location.replace('{page}#post/{slug}');</script>
<style>body{{background:#0a0a1a;color:#0ff;font-family:monospace;padding:2rem;}}</style>
</head>
<body>
<p>Redirecting to transmission… <a href="{page}#post/{slug}">continue manually</a>.</p>
</body>
</html>
"""


def build_stub(post: dict, stub_url: str, page: str) -> str:
    title = post.get("title", post["slug"])
    excerpt = post.get("excerpt", "")
    if len(excerpt) > 300:
        excerpt = excerpt[:297].rstrip() + "…"
    return STUB.format(
        title=html.escape(title, quote=True),
        desc=html.escape(excerpt, quote=True),
        slug=post["slug"],
        stub_url=stub_url,
        site=SITE,
        page=page,
        image=DEFAULT_IMAGE,
    )


def main():
    out_root = ROOT / "p"
    out_root.mkdir(exist_ok=True)

    for posts_rel, subdir, page in SOURCES:
        posts_md = ROOT / posts_rel
        if not posts_md.exists():
            continue

        out_dir = out_root / subdir if subdir else out_root
        out_dir.mkdir(parents=True, exist_ok=True)

        # Stub URL prefix for this section
        stub_prefix = f"{SITE}/p/{subdir}" if subdir else f"{SITE}/p"

        md_text = posts_md.read_text(encoding="utf-8")
        posts = parse_posts(md_text)

        existing = {p.name for p in out_dir.glob("*.html")} if subdir else set()
        current = set()

        for post in posts:
            slug = post["slug"]
            fname = f"{slug}.html"
            current.add(fname)
            stub_url = f"{stub_prefix}/{slug}"
            (out_dir / fname).write_text(
                build_stub(post, stub_url, page), encoding="utf-8"
            )
            label = f"p/{subdir}/{fname}" if subdir else f"p/{fname}"
            print(f"  wrote {label}")

        stale = existing - current
        for name in stale:
            (out_dir / name).unlink()
            label = f"p/{subdir}/{name}" if subdir else f"p/{name}"
            print(f"  removed stale {label}")

    print("done")


if __name__ == "__main__":
    main()
