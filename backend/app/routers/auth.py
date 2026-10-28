import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.config import settings
from app.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import AccessTokenResponse, LoginRequest, LogoutRequest, RefreshRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dummy hash used to prevent timing attacks when user is not found
_DUMMY_HASH = pwd_context.hash("dummy-password-for-timing-attack-prevention")


async def issue_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Create a refresh token and record its jti so it can be rotated and revoked."""
    now = datetime.now(UTC)
    expires = now + timedelta(days=settings.refresh_token_expire_days)
    jti = uuid.uuid4().hex
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.expires_at < now))
    db.add(RefreshToken(jti=jti, user_id=user_id, expires_at=expires))
    await db.commit()
    return create_refresh_token(str(user_id), jti, expires)


async def revoke_all_refresh_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Log every session of the user out (call on password change or suspected token theft)."""
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await db.commit()


def _refresh_claims(token: str) -> tuple[uuid.UUID, str]:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    jti = payload.get("jti")
    try:
        user_uuid = uuid.UUID(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload") from exc
    if not isinstance(jti, str) or not jti:
        # Issued before refresh tokens were revocable: the session has to log in once more.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return user_uuid, jti


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        # Always run verify to prevent timing attacks
        pwd_context.verify(body.password, _DUMMY_HASH)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=await issue_refresh_token(db, user.id),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
@limiter.limit("10/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_uuid, jti = _refresh_claims(body.refresh_token)
    # Single-use: deleting the row is the claim. A second request with the same token
    # finds nothing, so a replayed (stolen) token is detected.
    claimed = await db.execute(
        delete(RefreshToken).where(
            RefreshToken.jti == jti,
            RefreshToken.user_id == user_uuid,
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    if claimed.rowcount != 1:
        # Valid signature but no live record: already used, revoked or expired. Treat a
        # replay as possible theft and end every session of this user.
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_uuid))
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    await db.commit()
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return AccessTokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=await issue_refresh_token(db, user.id),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def logout(request: Request, body: LogoutRequest, db: AsyncSession = Depends(get_db)):
    """Revoke this session's refresh token (or all of the user's sessions)."""
    try:
        user_uuid, jti = _refresh_claims(body.refresh_token)
    except HTTPException:
        # Nothing to revoke; the client is signing out either way.
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if body.all_sessions:
        await revoke_all_refresh_tokens(db, user_uuid)
    else:
        await db.execute(delete(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.user_id == user_uuid))
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
