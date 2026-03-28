"""Seed script — creates an initial user.

Usage: docker compose exec api python -m seed
Reads SEED_EMAIL and SEED_PASSWORD from env (falls back to defaults for dev).
"""
import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    email = os.environ.get("SEED_EMAIL", "admin@nutripilot.dev")
    password = os.environ.get("SEED_PASSWORD", "nutripilot")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"User {email} already exists, skipping.")
            return

        user = User(
            email=email,
            password_hash=pwd_context.hash(password),
            api_key=settings.api_key,
            display_name=email.split("@")[0].title(),
            target_kcal=2000,
            target_protein_g=150.0,
            target_carbs_g=250.0,
            target_fat_g=70.0,
            target_weight_kg=75.0,
        )
        db.add(user)
        await db.commit()
        print(f"Seed user created:")
        print(f"  Email:    {email}")
        print(f"  API Key:  {settings.api_key}")


if __name__ == "__main__":
    asyncio.run(seed())
