import hmac

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.database import get_db
from app.models.user import User

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def _lookup_user_by_api_key(db: AsyncSession, api_key: str) -> User | None:
    """Look up a user by API key using a constant-time comparison.

    The DB query itself still does an equality WHERE (needed to narrow to a
    row at all), but the final accept/reject decision is made with
    hmac.compare_digest to avoid leaking timing information about how much
    of the key matched.
    """
    result = await db.execute(select(User).where(User.api_key == api_key))
    user = result.scalar_one_or_none()
    if user is None or not hmac.compare_digest(user.api_key, api_key):
        return None
    return user


async def get_current_user_api_key(
    api_key: str = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    user = await _lookup_user_by_api_key(db, api_key)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return user


async def get_current_user_jwt(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    import uuid as _uuid

    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    try:
        user_uuid = _uuid.UUID(user_id_str)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_user_jwt_or_api_key(
    request: Request,
    api_key: str | None = Depends(api_key_header),
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Accept either JWT Bearer token or X-API-Key header for authentication."""
    # Try API key first (agents / barcode scanner)
    if api_key is not None:
        user = await _lookup_user_by_api_key(db, api_key)
        if user is not None:
            return user

    # Try JWT token (browser / dashboard)
    if token is not None:
        import uuid as _uuid
        payload = decode_token(token)
        if payload is not None and payload.get("type") == "access":
            user_id_str = payload.get("sub")
            if user_id_str is not None:
                try:
                    user_uuid = _uuid.UUID(user_id_str)
                    result = await db.execute(select(User).where(User.id == user_uuid))
                    user = result.scalar_one_or_none()
                    if user is not None:
                        return user
                except (TypeError, ValueError):
                    pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid JWT Bearer token or X-API-Key header required",
    )
