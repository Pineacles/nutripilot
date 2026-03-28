"""Seed script — creates an initial user for development."""
import asyncio
import secrets

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "admin@nutripilot.dev"))
        if result.scalar_one_or_none():
            print("Seed user already exists, skipping.")
            return

        user = User(
            email="admin@nutripilot.dev",
            password_hash=pwd_context.hash("nutripilot"),
            api_key=settings.api_key,
            display_name="Admin",
            target_kcal=2000,
            target_protein_g=150.0,
            target_carbs_g=250.0,
            target_fat_g=70.0,
            target_weight_kg=75.0,
        )
        db.add(user)
        await db.commit()
        print(f"Seed user created:")
        print(f"  Email:    admin@nutripilot.dev")
        print(f"  Password: nutripilot")
        print(f"  API Key:  {settings.api_key}")


if __name__ == "__main__":
    asyncio.run(seed())
