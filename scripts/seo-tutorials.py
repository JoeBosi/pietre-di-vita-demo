#!/usr/bin/env python3
"""Idempotent SEO pass over olio/tutorial/{it,en}/*.html.

Reads ../frontend/scripts/seo-data.json and (re)writes in each page: <title>, meta description, canonical,
hreflang alternates, Open Graph, Twitter card, JSON-LD (Course / TechArticle) and the footer cross links.
In the English pages the links to the app point to /en/... Safe to run again: it replaces its own block.
Usage: python3 olio/scripts/seo-tutorials.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "frontend" / "scripts" / "seo-data.json").read_text(encoding="utf-8"))
TUT = ROOT / "tutorial"
HOST = DATA["host"]
OG_LOCALE = {"it": "it_IT", "en": "en_US"}
START, END = "<!-- seo:start -->", "<!-- seo:end -->"


def esc(s):
    return html.escape(s, quote=True)


def url(lang, c):
    return f"{HOST}/tutorial/{lang}/" + ("" if c.get("dirUrl") else c[lang])


def person():
    a = DATA["author"]
    return {"@type": "Person", "name": a["name"], "url": a["url"], "sameAs": a["sameAs"]}


def build_head(lang, c, h1, course_name):
    other = "en" if lang == "it" else "it"
    t = c["itT" if lang == "it" else "enT"]
    canon = url(lang, c)
    alts = [("it", url("it", c)), ("en", url("en", c)), ("x-default", url("it", c))]
    img = HOST + DATA["ogImage"]
    alt = DATA["ogImageAlt"][lang]
    site = DATA["siteName"][lang]
    if c["id"] == "index":
        ld = {"@context": "https://schema.org", "@type": "Course", "name": h1, "description": t["description"], "url": canon,
              "inLanguage": lang, "isAccessibleForFree": True, "provider": person(), "author": person()}
    else:
        ld = {"@context": "https://schema.org", "@type": "TechArticle", "headline": h1, "description": t["description"], "url": canon,
              "inLanguage": lang, "author": person(), "datePublished": DATA["lastmod"], "dateModified": DATA["lastmod"],
              "mainEntityOfPage": canon,
              "isPartOf": {"@type": "Course", "name": course_name, "url": url(lang, DATA["tutorial"]["index"])}}
    lines = [START, f"<title>{esc(t['title'])}</title>",
             f'<meta name="description" content="{esc(t["description"])}">',
             f'<link rel="canonical" href="{esc(canon)}">']
    lines += [f'<link rel="alternate" hreflang="{h}" href="{esc(u)}">' for h, u in alts]
    og = [("og:type", "website"), ("og:site_name", site), ("og:title", t["title"]), ("og:description", t["description"]), ("og:url", canon),
          ("og:image", img), ("og:image:type", "image/jpeg"), ("og:image:width", "1200"), ("og:image:height", "630"), ("og:image:alt", alt),
          ("og:locale", OG_LOCALE[lang]), ("og:locale:alternate", OG_LOCALE[other])]
    lines += [f'<meta property="{k}" content="{esc(v)}">' for k, v in og]
    tw = [("twitter:card", "summary_large_image"), ("twitter:title", t["title"]), ("twitter:description", t["description"]),
          ("twitter:image", img), ("twitter:image:alt", alt)]
    lines += [f'<meta name="{k}" content="{esc(v)}">' for k, v in tw]
    lines.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c") + "</script>")
    lines.append(END)
    return "\n".join(lines) + "\n"


def footer_links(lang):
    f = DATA["footerLinks"][lang]
    a = DATA["author"]
    parts = [(a["url"], f["site"]), (DATA["repo"], f["github"]), (a["sameAs"][1], f["linkedin"])]
    return '<span class="xlinks">' + "".join(
        f' &middot; <a href="{u}" target="_blank" rel="noopener">{l}</a>' for u, l in parts) + "</span>"


APP_LINKS = [(r'href="/"', 'href="/en/"'), (r'href="/come-funziona"', 'href="/en/come-funziona"'),
             (r'href="/filiera"', 'href="/en/filiera"'), (r'href="/b/', 'href="/en/b/')]


def process(lang, c):
    p = TUT / lang / c[lang]
    s = p.read_text(encoding="utf-8")
    h1 = re.search(r"<h1>(.*?)</h1>", s, re.S).group(1)
    h1 = html.unescape(re.sub(r"<[^>]+>", "", h1)).strip()
    idx = (TUT / lang / "index.html").read_text(encoding="utf-8")
    course_name = html.unescape(re.sub(r"<[^>]+>", "", re.search(r"<h1>(.*?)</h1>", idx, re.S).group(1))).strip()
    s = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", s, flags=re.S)
    s = re.sub(r"<title>.*?</title>\n?", "", s, flags=re.S)
    s = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?', "", s)
    s = s.replace("</head>", build_head(lang, c, h1, course_name) + "</head>", 1)
    s = re.sub(r'<span class="xlinks">.*?</span>', "", s, flags=re.S)
    s = re.sub(r"(<footer>.*?)(</footer>)", lambda m: m.group(1) + footer_links(lang) + m.group(2), s, count=1, flags=re.S)
    if lang == "en":
        for a, b in APP_LINKS:
            s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


def main():
    entries = [DATA["tutorial"]["index"]] + DATA["tutorial"]["chapters"]
    n = 0
    for c in entries:
        for lang in ("it", "en"):
            process(lang, c)
            n += 1
    print(f"seo-tutorials: {n} pages updated")


if __name__ == "__main__":
    main()
