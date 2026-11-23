#!/usr/bin/env python3
"""Trigger the GitHub Actions update workflow from an external scheduler."""

import json
import os
import sys
import time
import urllib.error
import urllib.request


REPOSITORY = os.environ.get("DAILYNEWS_REPOSITORY", "hizilla/dailynews")
WORKFLOW = os.environ.get("DAILYNEWS_WORKFLOW", "update.yml")
REF = os.environ.get("DAILYNEWS_REF", "main")
TOKEN = os.environ.get("DAILYNEWS_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN")
ATTEMPTS = max(1, int(os.environ.get("DAILYNEWS_TRIGGER_ATTEMPTS", "3")))
TIMEOUT = max(1, int(os.environ.get("DAILYNEWS_TRIGGER_TIMEOUT", "20")))


def trigger():
    if "/" not in REPOSITORY or not TOKEN:
        print("请设置 DAILYNEWS_GITHUB_TOKEN，以及格式为 owner/repository 的 DAILYNEWS_REPOSITORY", file=sys.stderr)
        return 2

    url = f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{WORKFLOW}/dispatches"
    body = json.dumps({"ref": REF}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {TOKEN}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "dailynews-external-trigger/1.0",
        },
    )

    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                if response.status == 204:
                    print(f"已触发 {REPOSITORY}/{WORKFLOW}，ref={REF}")
                    return 0
                print(f"GitHub 返回非预期状态码: {response.status}", file=sys.stderr)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"第 {attempt}/{ATTEMPTS} 次触发失败: HTTP {exc.code} {detail}", file=sys.stderr)
            if 400 <= exc.code < 500 and exc.code != 429:
                return 1
        except (OSError, TimeoutError) as exc:
            print(f"第 {attempt}/{ATTEMPTS} 次触发失败: {exc}", file=sys.stderr)
        if attempt < ATTEMPTS:
            time.sleep(min(60, 5 * attempt))
    return 1


if __name__ == "__main__":
    raise SystemExit(trigger())
