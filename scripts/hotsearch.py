#!/usr/bin/env python3
"""Save a third-party snapshot of Weibo trending searches."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "hotsearch.json"
SOURCES = (
    ("NewsNow", "https://newsnow.busiyi.world/api/s?id=weibo"),
    ("60s", "https://60s.viki.moe/v2/weibo"),
)


def fetch(source, url):
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; DailyNews/1.0)",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)

    if source == "60s":
        raw_items = result.get("data", [])
        updated = None
    else:
        raw_items = result.get("items", [])
        timestamp = result.get("updatedTime")
        updated = datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat() if isinstance(timestamp, (int, float)) else None

    items = []
    for item in raw_items:
        item_url = item.get("url") or item.get("link", "")
        parsed = urllib.parse.urlsplit(item_url)
        title = item.get("title", "")
        if parsed.scheme == "https" and parsed.hostname == "s.weibo.com" and isinstance(title, str) and title.strip():
            items.append({"title": title.strip(), "url": parsed.geturl()})
    if not items:
        raise ValueError("热搜榜为空")
    return items[:30], updated


def main():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}
    attempted = datetime.now(timezone.utc).isoformat()
    for source, url in SOURCES:
        try:
            items, updated = fetch(source, url)
            data = {"items": items, "updated": updated or attempted, "time_is_fetch": not bool(updated), "attempted": attempted, "error": False, "source": source}
            break
        except (OSError, ValueError, TypeError, OverflowError) as exc:
            print(f"微博热搜 {source} 获取失败: {type(exc).__name__}")
    else:
        data = {**previous, "attempted": attempted, "error": True}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
