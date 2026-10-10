from slowapi import Limiter

from app.client_ip import get_client_ip

# Keyed on the real client address (forwarded by the Next.js proxy), not on
# the proxy's own address, so one visitor cannot exhaust everyone's bucket.
limiter = Limiter(key_func=get_client_ip)
