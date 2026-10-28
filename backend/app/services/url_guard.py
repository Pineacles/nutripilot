"""SSRF guard: reject URLs whose host resolves to a non-public IP address.

Used before making any outbound HTTP request whose target is at least
partially user/agent-controlled (integration source_url, OAuth token_url),
to stop an attacker from pointing the sync worker at loopback, RFC1918,
link-local (including the 169.254.169.254 cloud metadata endpoint), CGNAT,
multicast, reserved, or unspecified addresses, whether IPv4 or IPv6.

DNS rebinding: a check followed by a separate fetch leaves a window in which a
hostile DNS server could answer differently the second time. resolve_pinned()
therefore returns the validated address together with the request arguments
that make httpx connect to exactly that address (URL host replaced by the IP,
Host header and TLS SNI/certificate name kept as the original hostname), so
the connection cannot be redirected to another address after the check.
Redirects must stay disabled (httpx's default) because a redirect target is a
new, unchecked URL.
"""

from __future__ import annotations

import asyncio
import ipaddress
from dataclasses import dataclass
from dataclasses import field as dc_field
from urllib.parse import urlsplit, urlunsplit

_ALLOWED_SCHEMES = {"http", "https"}

# IPv4 Carrier-Grade NAT (CGNAT) range: not classified as "private" by the
# stdlib ipaddress module, so it needs an explicit check.
_CGNAT_V4 = ipaddress.ip_network("100.64.0.0/10")


class UnsafeURLError(ValueError):
    """Raised when a URL is not safe to fetch (SSRF risk)."""


def _is_unsafe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # Unwrap IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) so we evaluate the
    # embedded IPv4 address against the same rules.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped

    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    if isinstance(ip, ipaddress.IPv4Address) and ip in _CGNAT_V4:
        return True

    return False


@dataclass(frozen=True)
class PinnedTarget:
    """Arguments for an httpx request that must connect to one pre-validated IP."""

    url: str
    headers: dict[str, str] = dc_field(default_factory=dict)
    extensions: dict[str, str] = dc_field(default_factory=dict)


async def resolve_pinned(url: str, *, field: str) -> PinnedTarget:
    """Validate *url* as a public http(s) URL and pin the connection to the checked address.

    Checks:
    - scheme is http or https
    - a host is present
    - ALL resolved IP addresses for the host are public (not loopback,
      RFC1918 private, link-local/cloud-metadata, CGNAT, multicast,
      reserved, unspecified, or their IPv6 equivalents)

    Raises UnsafeURLError otherwise. Pass the result to httpx as
    ``client.request(method, target.url, headers={**mine, **target.headers},
    extensions=target.extensions)``.
    """
    if not url:
        raise UnsafeURLError(f"{field}: URL is required")

    parsed = urlsplit(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise UnsafeURLError(f"{field}: URL scheme must be http or https")

    host = parsed.hostname
    if not host:
        raise UnsafeURLError(f"{field}: URL must include a host")

    loop = asyncio.get_running_loop()
    try:
        addrinfo = await loop.getaddrinfo(host, None)
    except OSError as exc:
        raise UnsafeURLError(f"{field}: could not resolve host '{host}': {exc}") from exc

    if not addrinfo:
        raise UnsafeURLError(f"{field}: host '{host}' did not resolve to any address")

    first_ip: ipaddress.IPv4Address | ipaddress.IPv6Address | None = None
    for _family, _type, _proto, _canonname, sockaddr in addrinfo:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise UnsafeURLError(f"{field}: host '{host}' resolved to an unparseable address ({ip_str!r})") from exc
        if _is_unsafe_ip(ip):
            raise UnsafeURLError(f"{field}: host '{host}' resolves to a non-public address ({ip})")
        # Prefer IPv4: the host may have no IPv6 route and only one address is tried.
        if first_ip is None or (first_ip.version == 6 and ip.version == 4):
            first_ip = ip

    assert first_ip is not None
    ip_text = f"[{first_ip}]" if first_ip.version == 6 else str(first_ip)
    port = f":{parsed.port}" if parsed.port else ""
    host_text = f"[{host}]" if ":" in host else host
    pinned_url = urlunsplit((parsed.scheme, f"{ip_text}{port}", parsed.path, parsed.query, ""))
    extensions = {"sni_hostname": host} if parsed.scheme == "https" else {}
    return PinnedTarget(pinned_url, {"Host": f"{host_text}{port}"}, extensions)


async def assert_public_http_url(url: str, *, field: str) -> None:
    """Raise UnsafeURLError unless *url* is a public http(s) URL (validation only, no pinning)."""
    await resolve_pinned(url, field=field)
