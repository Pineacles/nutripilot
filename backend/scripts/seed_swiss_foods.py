"""Seed Swiss Food Composition Database.
Usage: docker compose exec api python -m seed_swiss_foods
"""
import asyncio
from pathlib import Path

import httpx
import openpyxl
from sqlalchemy import select

from app.database import async_session
from app.models import Food, Nutrient

EXCEL_URL = "https://webapp.prod.blv.foodcase-services.com/wp-content/uploads/2025/07/Swiss_food_composition_database.xlsx"
EXCEL_PATH = Path("/tmp/swiss_food.xlsx")

def parse_value(val) -> float | None:
    """Parse a cell value, returning None for non-numeric entries."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().lower()
    if s in ("n.d.", "n.d", "-", "", "tr.", "traces"):
        return None
    # Handle "<0.1" type values
    if s.startswith("<"):
        try:
            return float(s[1:]) / 2  # use half the detection limit
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None

async def seed():
    # Download if not cached
    if not EXCEL_PATH.exists():
        print("Downloading Swiss Food Composition Database...")
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(EXCEL_URL)
            EXCEL_PATH.write_bytes(resp.content)
        print(f"Downloaded {EXCEL_PATH.stat().st_size / 1024:.0f} KB")

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)

    count = 0
    async with async_session() as db:
        for sheet_name in ["Generic Foods", "Branded foods"]:
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(min_row=4, values_only=True))
            for row in rows:
                name = row[3]  # Col D (index 3)
                if not name or not isinstance(name, str):
                    continue
                name = name.strip()
                if not name:
                    continue

                # Check if already exists
                existing = await db.execute(
                    select(Food).where(Food.name == name, Food.source == "swiss_db")
                )
                if existing.scalar_one_or_none():
                    continue

                food = Food(name=name, source="swiss_db")
                db.add(food)
                await db.flush()

                nutrient = Nutrient(
                    food_id=food.id,
                    kcal=parse_value(row[11]),      # Col L
                    fat=parse_value(row[14]),        # Col O
                    sat_fat=parse_value(row[17]),    # Col R
                    carbs=parse_value(row[41]),      # Col AP
                    sugar=parse_value(row[44]),      # Col AS
                    fiber=parse_value(row[50]),      # Col AY
                    protein=parse_value(row[53]),    # Col BB
                    salt=parse_value(row[56]),       # Col BE
                    b12=parse_value(row[89]),        # Col CL
                    vit_c=parse_value(row[101]),     # Col CX
                    vit_d=parse_value(row[104]),     # Col DA
                    potassium=parse_value(row[110]), # Col DG
                    calcium=parse_value(row[119]),   # Col DP
                    magnesium=parse_value(row[122]), # Col DS
                    iron=parse_value(row[128]),      # Col DY
                    zinc=parse_value(row[134]),      # Col EE
                    omega3=None,                     # Not directly available
                    vit_k2=None,                     # Not available
                )
                db.add(nutrient)
                count += 1

                if count % 100 == 0:
                    await db.commit()
                    print(f"  Imported {count} foods...")

        await db.commit()

    wb.close()
    print(f"\nDone! Imported {count} Swiss foods into the database.")

if __name__ == "__main__":
    asyncio.run(seed())
