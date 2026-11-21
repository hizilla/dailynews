"""Resolve news links and extract article text without sending links to the model."""
import ipaddress
import socket
import urllib.parse
import urllib.request

import trafilatura
from googlenewsdecoder import gnewsdecoder


def public_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("invalid article URL")
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(addr[4][0]).is_global for addr in addresses):
        raise ValueError("non-public article URL")
    return url


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, public_url(newurl))


def get_article(url):
    url = public_url(url)
    if urllib.parse.urlsplit(url).hostname == "news.google.com":
        decoded = gnewsdecoder(url, timeout=10)
        if not decoded.get("success"):
            raise ValueError("Google News link could not be resolved")
        url = public_url(decoded["decoded_url"])
        if urllib.parse.urlsplit(url).hostname == "news.google.com":
            raise ValueError("link does not resolve to publisher")
    opener = urllib.request.build_opener(PublicRedirect())
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; DailyNews/1.0)", "Accept": "text/html,application/xhtml+xml"})
    with opener.open(request, timeout=15) as response:
        if response.headers.get_content_type() not in ("text/html", "application/xhtml+xml"):
            raise ValueError("not an HTML article")
        original_url = public_url(response.geturl())
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("article is too large")
    content = trafilatura.extract(raw, url=original_url, include_comments=False, include_tables=False, favor_precision=True)
    if not content or len(content.strip()) < 100:
        raise ValueError("article text unavailable")
    return original_url, content.strip()[:10000]
