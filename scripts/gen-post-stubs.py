"""Generate agent-readable transmission pages and Markdown alternates.

Each p/<section>/<slug>.html file carries social metadata and the complete
article as semantic HTML. Browsers execute a JavaScript redirect to the interactive SPA;
non-JavaScript clients (including agents and crawlers) can read the document in
place. A sibling .md URL and a site-wide llms.txt index are generated as well.

Run after editing any posts.md or post Markdown file:
    python scripts/gen-post-stubs.py
"""

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://lastnpcalex.agency"
DEFAULT_IMAGE = f"{SITE}/img/banner.png"

# (posts_md_path, stub_subdir, interactive page, section label)
# stub_subdir="" means stubs go directly in p/.
SOURCES = [
    ("author/content/posts.md", "", "/", "Main page transmissions"),
    (
        "futures/content/posts.md",
        "futures",
        "/futures.html",
        "Speculative futures transmissions",
    ),
    (
        "maps/content/posts.md",
        "maps",
        "/maps.html",
        "Possible territories transmissions",
    ),
    (
        "ams/content/posts.md",
        "ams",
        "/ams.html",
        "A Mote in Shadow transmissions",
    ),
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
            match = re.match(r"^\s*-\s*(\w+):\s*(.+)$", line)
            if match and in_meta:
                key, value = match.group(1), match.group(2).strip()
                if key == "tags":
                    post["tags"] = [tag.strip() for tag in value.split(",")]
                else:
                    post[key] = value
            elif line.strip():
                in_meta = False
                excerpt_lines.append(line)
        post["excerpt"] = " ".join(excerpt_lines).strip()
        posts.append(post)
    return posts


STUB = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} // lastnpcalex.agency</title>
<link rel="icon" href="/img/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png">
<meta name="description" content="{desc}">
<meta name="robots" content="index,follow">
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
<link rel="canonical" href="{stub_url}">
<link rel="alternate" type="text/markdown" href="{stub_url}.md" title="Markdown source">
<script type="application/ld+json">{json_ld}</script>
<script>window.location.replace({interactive_json});</script>
<style>body{{max-width:78ch;margin:3rem auto;padding:0 1.25rem;background:#0a0a1a;color:#d9faff;font:16px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace}}h1,a{{color:#66ffff}}.meta{{color:#c78aff}}.excerpt{{border-left:3px solid #bf00ff;padding-left:1rem}}.article-body pre,.math-inline{{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}}.article-body img{{max-width:100%}}</style>
</head>
<body>
<article id="transmission-document">
<header><h1>{title}</h1><p class="meta">{date} ;; {tags}</p></header>
{excerpt_html}
<div class="article-body">{article_html}</div>
<p><a href="{interactive}">Open the interactive transmission</a> · <a href="{stub_url}.md">Markdown source</a></p>
</article>
</body>
</html>
"""


def build_stub(post: dict, stub_url: str, page: str, document: dict) -> str:
    title = post.get("title", post["slug"])
    excerpt = post.get("excerpt", "")
    if len(excerpt) > 300:
        excerpt = excerpt[:297].rstrip() + "…"
    interactive = f"{page}#post/{post['slug']}"
    json_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "datePublished": post.get("date", "").replace(".", "-"),
            "keywords": post.get("tags", []),
            "description": excerpt,
            "url": stub_url,
            "author": {"@type": "Person", "name": "A.N. Alex", "url": SITE},
            "articleBody": document["text"],
        },
        ensure_ascii=False,
    ).replace("</", "<\\/")
    return STUB.format(
        title=html.escape(title, quote=True),
        desc=html.escape(excerpt, quote=True),
        stub_url=stub_url,
        image=DEFAULT_IMAGE,
        json_ld=json_ld,
        interactive_json=json.dumps(interactive),
        interactive=interactive,
        date=html.escape(post.get("date", ""), quote=True),
        tags=" ".join(f"#{html.escape(tag)}" for tag in post.get("tags", [])),
        excerpt_html=(
            f'<p class="excerpt">{html.escape(excerpt)}</p>' if excerpt else ""
        ),
        article_html=document["html"],
    )


def build_markdown(post: dict, stub_url: str, markdown: str) -> str:
    metadata = [
        "---",
        f"title: {json.dumps(post.get('title', post['slug']), ensure_ascii=False)}",
        f"date: {post.get('date', '')}",
        f"tags: {', '.join(post.get('tags', []))}",
        f"canonical: {stub_url}",
        "---",
        "",
    ]
    return "\n".join(metadata) + "\n" + markdown.strip() + "\n"


def render_documents(posts: list, section_root: Path, page: str) -> list:
    sources = []
    for post in posts:
        source_path = section_root / post.get("file", "")
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing article source: {source_path}")
        sources.append({
            "source": source_path.read_text(encoding="utf-8"),
            "baseUrl": f"{SITE}{page}",
        })
    result = subprocess.run(
        ["node", str(ROOT / "scripts/render-transmissions.mjs")],
        input=json.dumps(sources), capture_output=True, text=True,
        encoding="utf-8", cwd=ROOT,
    )
    if result.returncode:
        raise RuntimeError(f"Article renderer failed (run npm ci first):\n{result.stderr}")
    return json.loads(result.stdout)


def main():
    out_root = ROOT / "p"
    out_root.mkdir(exist_ok=True)
    llms_sections = []

    for posts_rel, subdir, page, section_label in SOURCES:
        posts_md = ROOT / posts_rel
        if not posts_md.exists():
            continue

        out_dir = out_root / subdir if subdir else out_root
        out_dir.mkdir(parents=True, exist_ok=True)
        stub_prefix = f"{SITE}/p/{subdir}" if subdir else f"{SITE}/p"
        posts = parse_posts(posts_md.read_text(encoding="utf-8"))
        existing = {
            path.name
            for pattern in ("*.html", "*.md")
            for path in out_dir.glob(pattern)
        }
        current = set()
        llms_posts = []
        section_root = posts_md.parent.parent

        documents = render_documents(posts, section_root, page) if posts else []
        for post, document in zip(posts, documents, strict=True):
            slug = post["slug"]
            html_name = f"{slug}.html"
            markdown_name = f"{slug}.md"
            current.update((html_name, markdown_name))
            stub_url = f"{stub_prefix}/{slug}"
            (out_dir / html_name).write_text(
                build_stub(post, stub_url, page, document), encoding="utf-8"
            )
            (out_dir / markdown_name).write_text(
                build_markdown(post, stub_url, document["markdown"]), encoding="utf-8"
            )
            label = f"p/{subdir}/{html_name}" if subdir else f"p/{html_name}"
            print(f"  wrote {label} + Markdown")
            llms_posts.append((post, stub_url))

        for name in existing - current:
            (out_dir / name).unlink()
            label = f"p/{subdir}/{name}" if subdir else f"p/{name}"
            print(f"  removed stale {label}")

        if llms_posts:
            llms_sections.append((section_label, llms_posts))

    llms = [
        "# lastnpcalex.agency",
        "",
        "> Hard SF, speculative fiction, book updates, and maps by A.N. Alex.",
        "",
        "Every transmission link below contains the complete document. Append `.md` for Markdown.",
        "",
    ]
    for section_label, posts in llms_sections:
        llms.extend((f"## {section_label}", ""))
        for post, stub_url in posts:
            title = post.get("title", post["slug"])
            excerpt = post.get("excerpt", "")
            llms.append(
                f"- [{title}]({stub_url}) — {excerpt} "
                f"([Markdown]({stub_url}.md))"
            )
        llms.append("")
    (ROOT / "llms.txt").write_text(
        "\n".join(llms).strip() + "\n", encoding="utf-8"
    )
    print("  wrote llms.txt")
    print("done")


if __name__ == "__main__":
    main()
