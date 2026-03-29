"""Generate today's demo data if it doesn't already exist.

Called on app startup and scheduled to run daily at 00:05.
"""
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import select, func

from app.database import async_session
from app.models import Food, FoodLog, Supplement, User, WeightLog


# ---------------------------------------------------------------------------
# Meal templates — (food_name, qty_lo, qty_hi)
# ---------------------------------------------------------------------------
BREAKFAST_OPTIONS = [
    [("Oatmeal (cooked)", 250, 350), ("Banana", 80, 120), ("Blueberries", 40, 80), ("Honey", 10, 20)],
    [("Eggs (scrambled)", 150, 200), ("Whole Wheat Toast", 50, 70), ("Avocado", 30, 60)],
    [("Whey Protein Shake", 30, 40), ("Greek Yogurt (plain, 2%)", 150, 200), ("Banana", 80, 120), ("Blueberries", 50, 80)],
    [("Greek Yogurt (plain, 2%)", 200, 250), ("Whole Wheat Toast", 60, 80), ("Peanut Butter", 15, 25)],
    [("Eggs (scrambled)", 150, 200), ("Cheddar Cheese", 20, 30), ("Whole Wheat Toast", 50, 70)],
]

LUNCH_OPTIONS = [
    [("Chicken Breast (grilled)", 150, 200), ("White Rice (cooked)", 180, 250), ("Broccoli (steamed)", 100, 150), ("Olive Oil", 5, 10)],
    [("Salmon Fillet (baked)", 150, 180), ("Sweet Potato (baked)", 200, 280), ("Mixed Salad Greens", 80, 120)],
    [("Turkey Breast (roasted)", 130, 170), ("Quinoa (cooked)", 150, 200), ("Mixed Salad Greens", 100, 150), ("Avocado", 40, 70), ("Olive Oil", 5, 10)],
    [("Tofu (firm)", 200, 250), ("Brown Rice (cooked)", 200, 250), ("Bell Pepper (red)", 80, 120), ("Broccoli (steamed)", 80, 120)],
    [("Ground Beef (90% lean)", 120, 160), ("Pasta (cooked)", 180, 250), ("Olive Oil", 5, 10), ("Spinach (raw)", 40, 60)],
]

DINNER_OPTIONS = [
    [("Chicken Breast (grilled)", 150, 200), ("Quinoa (cooked)", 150, 200), ("Broccoli (steamed)", 120, 160), ("Olive Oil", 5, 10)],
    [("Salmon Fillet (baked)", 140, 180), ("Pasta (cooked)", 150, 220), ("Spinach (raw)", 50, 80), ("Olive Oil", 5, 10)],
    [("Ground Beef (90% lean)", 150, 200), ("Brown Rice (cooked)", 180, 250), ("Avocado", 40, 70), ("Mixed Salad Greens", 60, 100)],
    [("Turkey Breast (roasted)", 150, 200), ("Sweet Potato (baked)", 200, 300), ("Broccoli (steamed)", 100, 150)],
    [("Tofu (firm)", 180, 250), ("White Rice (cooked)", 180, 250), ("Spinach (raw)", 50, 80), ("Bell Pepper (red)", 80, 120), ("Olive Oil", 5, 10)],
]

SNACK_OPTIONS = [
    [("Almonds", 25, 40)],
    [("Apple", 150, 200)],
    [("Protein Bar", 55, 65)],
    [("Cottage Cheese (low-fat)", 150, 200)],
    [("Greek Yogurt (plain, 2%)", 150, 200), ("Blueberries", 40, 60)],
    [("Dark Chocolate (85%)", 15, 25)],
    [("Banana", 100, 130), ("Peanut Butter", 15, 25)],
    [("Whey Protein Shake", 30, 40), ("Milk (whole)", 200, 300)],
]

SUPPLEMENT_DEFS = [
    {"name": "Vitamin D3", "dose_amount": 4000, "dose_unit": "IU", "time_of_day": "morning"},
    {"name": "Fish Oil (Omega-3)", "dose_amount": 1000, "dose_unit": "mg", "time_of_day": "morning"},
    {"name": "Creatine Monohydrate", "dose_amount": 5, "dose_unit": "g", "time_of_day": "morning"},
    {"name": "Zinc", "dose_amount": 25, "dose_unit": "mg", "time_of_day": "evening"},
    {"name": "Magnesium Glycinate", "dose_amount": 400, "dose_unit": "mg", "time_of_day": "evening"},
]

DEMO_EMAIL = "demo@nutripilot.dev"


def _rand(lo: float, hi: float) -> float:
    return round(random.uniform(lo, hi), 1)


async def seed_today():
    """Generate demo data for today. Skips if today's food logs already exist."""
    today = date.today()

    async with async_session() as db:
        # Find demo user
        result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        user = result.scalar_one_or_none()
        if not user:
            return

        # Check if today already has food logs
        result = await db.execute(
            select(func.count())
            .select_from(FoodLog)
            .where(FoodLog.user_id == user.id, FoodLog.date == today)
        )
        if result.scalar() > 0:
            return

        # Build food name -> id map
        result = await db.execute(select(Food))
        food_map: dict[str, uuid.UUID] = {f.name: f.id for f in result.scalars().all()}

        is_weekend = today.weekday() >= 5
        portion_mult = random.uniform(1.05, 1.15) if is_weekend else 1.0

        # Pick today's meals
        breakfast = random.choice(BREAKFAST_OPTIONS)
        lunch = random.choice(LUNCH_OPTIONS)
        dinner = random.choice(DINNER_OPTIONS)
        num_snacks = random.choice([1, 2, 2, 3]) if is_weekend else random.choice([1, 1, 2])
        snacks = random.sample(SNACK_OPTIONS, min(num_snacks, len(SNACK_OPTIONS)))

        count = 0
        for meal_type, items in [("breakfast", breakfast), ("lunch", lunch), ("dinner", dinner)]:
            for food_name, lo, hi in items:
                if food_name not in food_map:
                    continue
                db.add(FoodLog(
                    user_id=user.id,
                    food_id=food_map[food_name],
                    date=today,
                    quantity_g=round(_rand(lo, hi) * portion_mult, 1),
                    meal_type=meal_type,
                ))
                count += 1

        for snack_items in snacks:
            for food_name, lo, hi in snack_items:
                if food_name not in food_map:
                    continue
                db.add(FoodLog(
                    user_id=user.id,
                    food_id=food_map[food_name],
                    date=today,
                    quantity_g=round(_rand(lo, hi) * portion_mult, 1),
                    meal_type="snack",
                ))
                count += 1

        # Weight log — continue trend from most recent entry
        result = await db.execute(
            select(WeightLog)
            .where(WeightLog.user_id == user.id)
            .order_by(WeightLog.date.desc())
            .limit(1)
        )
        last_weight = result.scalar_one_or_none()
        if last_weight:
            # Small daily drift toward goal (78kg) with noise
            goal = user.target_weight_kg or 78.0
            current = last_weight.weight_kg
            drift = (goal - current) * random.uniform(0.005, 0.02)
            new_weight = round(current + drift + random.gauss(0, 0.3), 1)

            bf = last_weight.body_fat_pct
            new_bf = round(bf + random.gauss(-0.03, 0.2), 1) if bf else None

            mm = last_weight.muscle_mass_pct
            new_mm = round(mm + random.gauss(0.01, 0.15), 1) if mm else None

            db.add(WeightLog(
                user_id=user.id,
                date=today,
                weight_kg=new_weight,
                body_fat_pct=new_bf,
                muscle_mass_pct=new_mm,
                source="manual",
            ))

        # Supplements — ~90% adherence
        supp_count = 0
        for sd in SUPPLEMENT_DEFS:
            if random.random() < 0.90:
                db.add(Supplement(
                    user_id=user.id,
                    date=today,
                    name=sd["name"],
                    dose_amount=sd["dose_amount"],
                    dose_unit=sd["dose_unit"],
                    time_of_day=sd["time_of_day"],
                ))
                supp_count += 1

        await db.commit()
        print(f"[demo_daily] Seeded {today}: {count} food logs, 1 weight log, {supp_count} supplements")
