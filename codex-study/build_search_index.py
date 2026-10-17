"""Rebuild the offline search index from the chapter HTML files."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"
SCRIPT = ROOT / "assets" / "app.js"
INDEX_PATTERN = re.compile(r"  var SEARCH_INDEX = \[[\s\S]*?\n\];")
CHAPTER_PATTERN = re.compile(r'href="chapters/([a-z-]+)\.html" class="chapter-card"')
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class ChapterText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.description = ""
        self.article_parts = []
        self.in_title = False
        self.article_depth = 0
        self.article_closed = False
        self.sections = []
        self.pending_anchor = ""
        self.in_heading = False
        self.heading_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta" and attrs.get("name") == "description":
            self.description = attrs.get("content", "")
        elif tag == "article" and "mdx-content" in attrs.get("class", "").split():
            self.article_depth = 1
        elif self.article_depth and tag not in VOID_TAGS:
            if self.article_depth == 1 and tag == "div" and attrs.get("id"):
                self.pending_anchor = attrs["id"]
            elif self.article_depth == 1 and tag == "h2":
                if not self.pending_anchor:
                    raise ValueError("文章小節缺少頁內錨點")
                self.sections.append({"id": self.pending_anchor, "title": "", "text_parts": []})
                self.pending_anchor = ""
                self.in_heading = True
                self.heading_parts = []
            self.article_depth += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "h2" and self.in_heading:
            self.sections[-1]["title"] = compact(self.heading_parts)
            self.in_heading = False
        if self.article_depth and tag not in VOID_TAGS:
            self.article_depth -= 1
            if self.article_depth == 0:
                if tag != "article":
                    raise ValueError("文章標籤未完整閉合")
                self.article_closed = True

    def handle_startendtag(self, tag, attrs):
        if tag == "meta":
            self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.article_depth:
            self.article_parts.append(data)
            if self.sections:
                self.sections[-1]["text_parts"].append(data)
            if self.in_heading:
                self.heading_parts.append(data)


def compact(parts):
    return " ".join(" ".join(parts).split())


def generate():
    home = INDEX.read_text(encoding="utf-8")
    slugs = CHAPTER_PATTERN.findall(home)
    if len(slugs) != 10 or len(set(slugs)) != 10:
        raise ValueError("首頁必須有十張不重複的章節卡片")
    chapters = []
    for order, slug in enumerate(slugs, 1):
        parser = ChapterText()
        parser.feed((ROOT / "chapters" / f"{slug}.html").read_text(encoding="utf-8"))
        title = compact(parser.title_parts).split("｜", 1)[0].strip()
        summary = parser.description.strip()
        body = compact(parser.article_parts)
        if not title or not summary or not body or not parser.article_closed:
            raise ValueError(f"章節缺少標題、摘要或完整文章：{slug}")
        sections = [{"id": part["id"], "title": part["title"], "text": compact(part["text_parts"])} for part in parser.sections]
        if not sections or any(not part["title"] or not part["text"] for part in sections) or len({part["id"] for part in sections}) != len(sections):
            raise ValueError(f"章節小節標題、錨點或文字不完整：{slug}")
        chapters.append({"order": order, "slug": slug, "title": title, "summary": summary, "sections": sections})
    return "  var SEARCH_INDEX = " + json.dumps(chapters, ensure_ascii=False, indent=2) + ";"


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--check", action="store_true", help="只檢查索引是否與章節同步")
    check = args.parse_args().check
    source = SCRIPT.read_text(encoding="utf-8")
    replacement = generate()
    updated, count = INDEX_PATTERN.subn(lambda _: replacement, source)
    if count != 1:
        raise ValueError("找不到唯一的 SEARCH_INDEX 區塊")
    if check:
        if updated != source:
            print("搜尋索引未同步；請執行 python build_search_index.py", file=sys.stderr)
            return 1
        print("搜尋索引與十章內容一致")
        return 0
    if updated != source:
        SCRIPT.write_text(updated, encoding="utf-8", newline="\n")
        print("已更新 assets/app.js 的搜尋索引")
    else:
        print("搜尋索引已是最新版本")
    return 0


if __name__ == "__main__":
    sys.exit(main())
