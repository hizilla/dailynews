#!/usr/bin/env python3
"""Save a third-party snapshot of Weibo trending searches."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "hotsearch.json"
URL = "https://newsnow.busiyi.world/api/s?id=weibo"


def main():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}
    attempted = datetime.now(timezone.utc).isoformat()
    try:
        request = urllib.request.Request(URL, headers={"User-Agent": "DailyNews/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        items = []
        for item in result.get("items", []):
            url = urllib.parse.urlsplit(item.get("url", ""))
            title = item.get("title", "")
            if url.scheme == "https" and url.hostname == "s.weibo.com" and isinstance(title, str) and title.strip():
                items.append({"title": title.strip(), "url": url.geturl()})
        if not items:
            raise ValueError("热搜榜为空")
        timestamp = result.get("updatedTime")
        updated = datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat() if isinstance(timestamp, (int, float)) else None
        data = {"items": items[:30], "updated": updated, "attempted": attempted, "error": False}
    except (OSError, ValueError, TypeError, OverflowError) as exc:
        print(f"微博热搜获取失败: {type(exc).__name__}")
        data = {**previous, "attempted": attempted, "error": True}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
