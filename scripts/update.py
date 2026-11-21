#!/usr/bin/env python3
"""Build a small, static news snapshot from configured RSS/Atom feeds."""
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data" / "news.json"
CATEGORIES = ("local", "society", "world", "discovery")


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.ignored += 1
        if tag in ("p", "br", "div", "li"):
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.ignored:
            self.ignored -= 1
        if tag in ("p", "div", "li"):
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.ignored:
            self.parts.append(data)


def plain_html(value):
    parser = PlainText()
    parser.feed(value)
    return re.sub(r"\s+", " ", "".join(parser.parts)).strip()


def text(element, name):
    node = element.find(name)
    return "".join(node.itertext()).strip() if node is not None else ""


def fetch(feed, city):
    url = feed["url"].replace("{city}", urllib.parse.quote(city))
    request = urllib.request.Request(url, headers={"User-Agent": "DailyNews/1.0 (RSS reader)"})
    with urllib.request.urlopen(request, timeout=20) as response:
        root = ET.fromstring(response.read(2_000_000))
    entries = root.findall("./channel/item") or root.findall("{http://www.w3.org/2005/Atom}entry")
    result = []
    for entry in entries[:15]:
        atom = "{http://www.w3.org/2005/Atom}"
        title = text(entry, "title") or text(entry, atom + "title")
        link = text(entry, "link")
        if not link:
            node = entry.find(atom + "link")
            link = node.get("href", "") if node is not None else ""
        if not title or urllib.parse.urlparse(link).scheme not in ("http", "https"):
            continue
        description = text(entry, "{http://purl.org/rss/1.0/modules/content/}encoded") or text(entry, "description") or text(entry, atom + "content") or text(entry, atom + "summary")
        # Google News descriptions are generally lists of related headlines, not article text.
        content = "" if urllib.parse.urlparse(url).hostname == "news.google.com" else plain_html(description)
        result.append({"title": re.sub(r"\s+", " ", title), "url": link, "_content": content[:6000],
                       "published": text(entry, "pubDate") or text(entry, atom + "published") or text(entry, atom + "updated"),
                       "source": text(entry, "source") or feed["name"]})
    if not result:
        raise ValueError("没有可用条目")
    return result


def main():
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    city = config.get("city", "").strip()
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        previous = {}
    old_sources = previous.get("sources", {})
    sources = {}
    for feed in config["feeds"]:
        category = feed["category"]
        if category not in CATEGORIES:
            raise ValueError(f"未知栏目: {category}")
        key = category + ":" + feed["url"].replace("{city}", urllib.parse.quote(city))
        if "{city}" in feed["url"] and not city:
            continue
        now = datetime.now(timezone.utc).isoformat()
        try:
            sources[key] = {"category": category, "name": feed["name"], "items": fetch(feed, city), "updated": now, "error": False}
            old_items = {item["url"]: item for item in old_sources.get(key, {}).get("items", [])}
            for item in sources[key]["items"]:
                old = old_items.get(item["url"], {})
                if old.get("title") == item["title"] and old.get("summary"):
                    item["summary"] = old["summary"]
        except Exception as exc:
            print(f"获取 {feed['name']} 失败: {exc}")
            sources[key] = dict(old_sources.get(key, {"category": category, "name": feed["name"], "items": [], "updated": None}), error=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"city": city, "attempted": datetime.now(timezone.utc).isoformat(), "sources": sources}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
