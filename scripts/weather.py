#!/usr/bin/env python3
"""Fetch a Hangzhou forecast, retaining the previous snapshot on failure."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "weather.json"
PLACE = {"name": "杭州，浙江，中国", "latitude": 30.29365, "longitude": 120.16142}


def main():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        previous = {}
    params = urllib.parse.urlencode({"latitude": PLACE["latitude"], "longitude": PLACE["longitude"],
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
        "timezone": "Asia/Shanghai", "forecast_days": 7})
    try:
        request = urllib.request.Request("https://api.open-meteo.com/v1/forecast?" + params,
                                         headers={"User-Agent": "DailyNews/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            forecast = json.load(response)
        if not forecast.get("daily", {}).get("time"):
            raise ValueError("天气数据为空")
        snapshot = {"place": PLACE, "daily": forecast["daily"],
                    "updated": datetime.now(timezone.utc).isoformat(), "error": False}
    except Exception as exc:
        print(f"获取杭州天气失败: {exc}")
        snapshot = {**previous, "place": PLACE, "error": True}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
