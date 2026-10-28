from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    # Refresh tokens rotate: every /auth/refresh returns a new one and invalidates the old.
    refresh_token: str | None = None
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str
    all_sessions: bool = False
