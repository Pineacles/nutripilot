"""Unit tests for the SSRF guard (app.services.url_guard.assert_public_http_url).

DNS is monkeypatched onto the *current test's* running event loop instance
(not the global asyncio module) so these tests never touch the network and
can't leak state between tests.
"""

from __future__ import annotations

import asyncio
import socket

import pytest

from app.services.url_guard import UnsafeURLError, assert_public_http_url

pytestmark = pytest.mark.asyncio


def _install_fake_dns(monkeypatch, addrinfo_by_host: dict[str, list[str]]):
    """Make the current event loop's getaddrinfo() resolve to canned IPs, no real DNS."""
    loop = asyncio.get_running_loop()

    async def _fake_getaddrinfo(host, port, *args, **kwargs):
        ips = addrinfo_by_host.get(host)
        if ips is None:
            raise OSError(f"no fake DNS entry for {host!r}")
        return [
            (socket.AF_INET if "." in ip else socket.AF_INET6, socket.SOCK_STREAM, 6, "", (ip, 0))
            for ip in ips
        ]

    monkeypatch.setattr(loop, "getaddrinfo", _fake_getaddrinfo)


async def test_rejects_localhost(monkeypatch):
    _install_fake_dns(monkeypatch, {"localhost": ["127.0.0.1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://localhost/api", field="source_url")


async def test_rejects_loopback_ip_literal(monkeypatch):
    _install_fake_dns(monkeypatch, {"127.0.0.1": ["127.0.0.1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://127.0.0.1/api", field="source_url")


async def test_rejects_cloud_metadata_ip(monkeypatch):
    _install_fake_dns(monkeypatch, {"169.254.169.254": ["169.254.169.254"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://169.254.169.254/latest/meta-data", field="source_url")


async def test_rejects_rfc1918_private(monkeypatch):
    _install_fake_dns(monkeypatch, {"internal.example.com": ["10.1.2.3"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://internal.example.com/api", field="source_url")


async def test_rejects_cgnat(monkeypatch):
    _install_fake_dns(monkeypatch, {"cgnat.example.com": ["100.64.1.1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://cgnat.example.com/api", field="source_url")


async def test_rejects_private_ipv6(monkeypatch):
    _install_fake_dns(monkeypatch, {"internal-v6.example.com": ["fc00::1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://internal-v6.example.com/api", field="source_url")


async def test_rejects_ipv6_loopback(monkeypatch):
    _install_fake_dns(monkeypatch, {"v6loop.example.com": ["::1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://v6loop.example.com/api", field="source_url")


async def test_rejects_ipv4_mapped_ipv6_private(monkeypatch):
    _install_fake_dns(monkeypatch, {"mapped.example.com": ["::ffff:10.0.0.1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://mapped.example.com/api", field="source_url")


async def test_rejects_if_any_resolved_ip_is_private(monkeypatch):
    """Multi-A-record host: even one private IP among several should reject."""
    _install_fake_dns(monkeypatch, {"multi.example.com": ["93.184.216.34", "10.0.0.1"]})
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("http://multi.example.com/api", field="source_url")


async def test_rejects_non_http_scheme(monkeypatch):
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("ftp://example.com/api", field="source_url")


async def test_rejects_missing_url(monkeypatch):
    with pytest.raises(UnsafeURLError):
        await assert_public_http_url("", field="source_url")


async def test_allows_public_url(monkeypatch):
    _install_fake_dns(monkeypatch, {"api.example.com": ["93.184.216.34"]})
    # Should not raise.
    await assert_public_http_url("http://api.example.com/api", field="source_url")
