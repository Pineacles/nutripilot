"""Seed script: creates an initial user.

Usage: docker compose exec api python -m seed
Reads SEED_EMAIL / SEED_PASSWORD / SEED_API_KEY from env (falls back to
randomly generated secrets for password and API key when unset).
"""
import asyncio
import os
import secrets

from passlib.context import CryptContext
from sqlalchemy import select

from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    email = os.environ.get("SEED_EMAIL", "admin@nutripilot.dev")

    password = os.environ.get("SEED_PASSWORD")
    password_generated = password is None
    if password_generated:
        password = secrets.token_urlsafe(16)

    api_key = os.environ.get("SEED_API_KEY")
    api_key_generated = api_key is None
    if api_key_generated:
        api_key = secrets.token_urlsafe(32)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"User {email} already exists, skipping.")
            return

        user = User(
            email=email,
            password_hash=pwd_context.hash(password),
            api_key=api_key,
            target_kcal=2000,
            target_protein_g=150.0,
            target_carbs_g=250.0,
            target_fat_g=70.0,
            target_weight_kg=75.0,
        )
        db.add(user)
        await db.commit()
        print("Seed user created:")
        print(f"  Email:    {email}")
        if password_generated:
            print(f"  Password: {password}")
        else:
            print("  Password: set via env, not shown")
        if api_key_generated:
            print(f"  API Key:  {api_key}")
        else:
            print("  API Key:  set via env, not shown")


if __name__ == "__main__":
    asyncio.run(seed())
