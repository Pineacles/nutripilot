"""Rate limiter keys on the real client address, not the proxy's."""

from starlette.requests import Request

from app.client_ip import get_client_ip


def _req(peer: str, headers: dict[str, str] | None = None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1234)})


def test_cf_header_trusted_from_internal_peer():
    assert get_client_ip(_req("172.18.0.5", {"CF-Connecting-IP": "1.1.1.1"})) == "1.1.1.1"


def test_headers_ignored_from_public_peer():
    assert get_client_ip(_req("8.8.4.4", {"CF-Connecting-IP": "1.1.1.1"})) == "8.8.4.4"


def test_xff_skips_internal_hops_and_spoofed_left_entries():
    xff = "9.9.9.9, 1.1.1.1, 10.0.0.2"
    assert get_client_ip(_req("127.0.0.1", {"X-Forwarded-For": xff})) == "1.1.1.1"


def test_falls_back_to_peer():
    assert get_client_ip(_req("172.18.0.5")) == "172.18.0.5"
    assert get_client_ip(_req("172.18.0.5", {"CF-Connecting-IP": "garbage"})) == "172.18.0.5"
