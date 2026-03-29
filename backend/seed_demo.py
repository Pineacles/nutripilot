"""Seed script — creates a demo user with 3 months of realistic data.

Usage: docker compose exec api python -m seed_demo
"""
import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import select, delete

from app.database import async_session
from app.models import (
    Food, FoodLog, MicronutrientTarget, Nutrient,
    Supplement, SupplementDefinition, User, WeightLog,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_EMAIL = "demo@nutripilot.dev"
DEMO_PASSWORD = "demo"

# ---------------------------------------------------------------------------
# Food database — nutrients per 100g
# ---------------------------------------------------------------------------
FOODS = [
    # Breakfast foods
    {"name": "Oatmeal (cooked)", "n": {"kcal": 71, "protein": 2.5, "carbs": 12, "sugar": 0.5, "fiber": 1.7, "fat": 1.5, "sat_fat": 0.3, "salt": 0.005, "iron": 1.1, "magnesium": 27, "b12": 0, "zinc": 0.6, "vit_c": 0, "vit_d": 0, "calcium": 9, "potassium": 61}},
    {"name": "Eggs (scrambled)", "n": {"kcal": 148, "protein": 10.0, "carbs": 1.6, "sugar": 1.4, "fiber": 0, "fat": 11.0, "sat_fat": 3.3, "salt": 0.42, "iron": 1.5, "magnesium": 11, "b12": 1.1, "zinc": 1.1, "vit_c": 0, "vit_d": 2.0, "calcium": 71, "potassium": 147}},
    {"name": "Greek Yogurt (plain, 2%)", "n": {"kcal": 73, "protein": 10.0, "carbs": 3.6, "sugar": 3.2, "fiber": 0, "fat": 2.0, "sat_fat": 1.0, "salt": 0.09, "iron": 0.1, "magnesium": 11, "b12": 0.75, "zinc": 0.5, "vit_c": 0, "vit_d": 0, "calcium": 110, "potassium": 141}},
    {"name": "Banana", "n": {"kcal": 89, "protein": 1.1, "carbs": 23, "sugar": 12.2, "fiber": 2.6, "fat": 0.3, "sat_fat": 0.1, "salt": 0.003, "iron": 0.3, "magnesium": 27, "b12": 0, "zinc": 0.15, "vit_c": 8.7, "vit_d": 0, "calcium": 5, "potassium": 358}},
    {"name": "Whole Wheat Toast", "n": {"kcal": 247, "protein": 13.0, "carbs": 41, "sugar": 5.6, "fiber": 7.0, "fat": 3.4, "sat_fat": 0.7, "salt": 1.1, "iron": 2.5, "magnesium": 75, "b12": 0, "zinc": 1.8, "vit_c": 0, "vit_d": 0, "calcium": 107, "potassium": 254}},
    {"name": "Whey Protein Shake", "n": {"kcal": 120, "protein": 24.0, "carbs": 3.0, "sugar": 2.0, "fiber": 0, "fat": 1.5, "sat_fat": 0.5, "salt": 0.3, "iron": 1.5, "magnesium": 20, "b12": 0.5, "zinc": 2.0, "vit_c": 0, "vit_d": 0, "calcium": 120, "potassium": 160}},
    {"name": "Blueberries", "n": {"kcal": 57, "protein": 0.7, "carbs": 14.5, "sugar": 10.0, "fiber": 2.4, "fat": 0.3, "sat_fat": 0, "salt": 0.003, "iron": 0.3, "magnesium": 6, "b12": 0, "zinc": 0.2, "vit_c": 9.7, "vit_d": 0, "calcium": 6, "potassium": 77}},
    {"name": "Peanut Butter", "n": {"kcal": 588, "protein": 25.0, "carbs": 20, "sugar": 9.0, "fiber": 6.0, "fat": 50, "sat_fat": 10, "salt": 1.2, "iron": 1.7, "magnesium": 160, "b12": 0, "zinc": 2.8, "vit_c": 0, "vit_d": 0, "calcium": 43, "potassium": 649}},
    # Lunch / Dinner proteins
    {"name": "Chicken Breast (grilled)", "n": {"kcal": 165, "protein": 31.0, "carbs": 0, "sugar": 0, "fiber": 0, "fat": 3.6, "sat_fat": 1.0, "salt": 0.18, "iron": 0.7, "magnesium": 29, "b12": 0.3, "zinc": 1.0, "vit_c": 0, "vit_d": 0.1, "calcium": 15, "potassium": 256}},
    {"name": "Salmon Fillet (baked)", "n": {"kcal": 208, "protein": 20.0, "carbs": 0, "sugar": 0, "fiber": 0, "fat": 13.0, "sat_fat": 3.0, "salt": 0.12, "iron": 0.3, "magnesium": 30, "b12": 2.8, "zinc": 0.6, "vit_c": 0, "vit_d": 11.0, "calcium": 12, "potassium": 363, "omega3": 2.2}},
    {"name": "Ground Beef (90% lean)", "n": {"kcal": 176, "protein": 20.0, "carbs": 0, "sugar": 0, "fiber": 0, "fat": 10.0, "sat_fat": 4.0, "salt": 0.17, "iron": 2.4, "magnesium": 20, "b12": 2.6, "zinc": 5.5, "vit_c": 0, "vit_d": 0.1, "calcium": 18, "potassium": 315}},
    {"name": "Tofu (firm)", "n": {"kcal": 76, "protein": 8.0, "carbs": 1.9, "sugar": 0.6, "fiber": 0.3, "fat": 4.8, "sat_fat": 0.7, "salt": 0.02, "iron": 5.4, "magnesium": 30, "b12": 0, "zinc": 0.8, "vit_c": 0.1, "vit_d": 0, "calcium": 350, "potassium": 121}},
    {"name": "Turkey Breast (roasted)", "n": {"kcal": 135, "protein": 30.0, "carbs": 0, "sugar": 0, "fiber": 0, "fat": 1.0, "sat_fat": 0.3, "salt": 0.2, "iron": 1.4, "magnesium": 27, "b12": 0.4, "zinc": 2.0, "vit_c": 0, "vit_d": 0.1, "calcium": 10, "potassium": 293}},
    # Carb sources
    {"name": "White Rice (cooked)", "n": {"kcal": 130, "protein": 2.7, "carbs": 28, "sugar": 0, "fiber": 0.4, "fat": 0.3, "sat_fat": 0.1, "salt": 0.003, "iron": 0.2, "magnesium": 12, "b12": 0, "zinc": 0.5, "vit_c": 0, "vit_d": 0, "calcium": 10, "potassium": 35}},
    {"name": "Brown Rice (cooked)", "n": {"kcal": 112, "protein": 2.3, "carbs": 24, "sugar": 0.4, "fiber": 1.8, "fat": 0.8, "sat_fat": 0.2, "salt": 0.003, "iron": 0.4, "magnesium": 39, "b12": 0, "zinc": 0.6, "vit_c": 0, "vit_d": 0, "calcium": 10, "potassium": 79}},
    {"name": "Sweet Potato (baked)", "n": {"kcal": 90, "protein": 2.0, "carbs": 21, "sugar": 6.5, "fiber": 3.3, "fat": 0.1, "sat_fat": 0, "salt": 0.09, "iron": 0.7, "magnesium": 27, "b12": 0, "zinc": 0.3, "vit_c": 19.6, "vit_d": 0, "calcium": 38, "potassium": 475}},
    {"name": "Pasta (cooked)", "n": {"kcal": 131, "protein": 5.0, "carbs": 25, "sugar": 0.6, "fiber": 1.8, "fat": 1.1, "sat_fat": 0.2, "salt": 0.003, "iron": 1.3, "magnesium": 18, "b12": 0, "zinc": 0.5, "vit_c": 0, "vit_d": 0, "calcium": 7, "potassium": 44}},
    {"name": "Quinoa (cooked)", "n": {"kcal": 120, "protein": 4.4, "carbs": 21, "sugar": 0.9, "fiber": 2.8, "fat": 1.9, "sat_fat": 0.2, "salt": 0.02, "iron": 1.5, "magnesium": 64, "b12": 0, "zinc": 1.1, "vit_c": 0, "vit_d": 0, "calcium": 17, "potassium": 172}},
    # Vegetables
    {"name": "Broccoli (steamed)", "n": {"kcal": 35, "protein": 2.4, "carbs": 7.2, "sugar": 1.4, "fiber": 3.3, "fat": 0.4, "sat_fat": 0.1, "salt": 0.08, "iron": 0.7, "magnesium": 21, "b12": 0, "zinc": 0.4, "vit_c": 64.9, "vit_d": 0, "calcium": 40, "potassium": 293}},
    {"name": "Mixed Salad Greens", "n": {"kcal": 17, "protein": 1.5, "carbs": 2.9, "sugar": 0.8, "fiber": 1.8, "fat": 0.2, "sat_fat": 0, "salt": 0.04, "iron": 1.5, "magnesium": 13, "b12": 0, "zinc": 0.2, "vit_c": 18, "vit_d": 0, "calcium": 36, "potassium": 290}},
    {"name": "Avocado", "n": {"kcal": 160, "protein": 2.0, "carbs": 8.5, "sugar": 0.7, "fiber": 6.7, "fat": 15.0, "sat_fat": 2.1, "salt": 0.02, "iron": 0.6, "magnesium": 29, "b12": 0, "zinc": 0.6, "vit_c": 10, "vit_d": 0, "calcium": 12, "potassium": 485}},
    {"name": "Spinach (raw)", "n": {"kcal": 23, "protein": 2.9, "carbs": 3.6, "sugar": 0.4, "fiber": 2.2, "fat": 0.4, "sat_fat": 0.1, "salt": 0.2, "iron": 2.7, "magnesium": 79, "b12": 0, "zinc": 0.5, "vit_c": 28, "vit_d": 0, "calcium": 99, "potassium": 558}},
    {"name": "Bell Pepper (red)", "n": {"kcal": 31, "protein": 1.0, "carbs": 6.0, "sugar": 4.2, "fiber": 2.1, "fat": 0.3, "sat_fat": 0, "salt": 0.01, "iron": 0.4, "magnesium": 12, "b12": 0, "zinc": 0.25, "vit_c": 128, "vit_d": 0, "calcium": 7, "potassium": 211}},
    # Fats & extras
    {"name": "Olive Oil", "n": {"kcal": 884, "protein": 0, "carbs": 0, "sugar": 0, "fiber": 0, "fat": 100, "sat_fat": 14, "salt": 0.005, "iron": 0.6, "magnesium": 0, "b12": 0, "zinc": 0, "vit_c": 0, "vit_d": 0, "calcium": 1, "potassium": 1}},
    {"name": "Almonds", "n": {"kcal": 579, "protein": 21.0, "carbs": 22, "sugar": 4.4, "fiber": 12.5, "fat": 50, "sat_fat": 3.8, "salt": 0.003, "iron": 3.7, "magnesium": 270, "b12": 0, "zinc": 3.1, "vit_c": 0, "vit_d": 0, "calcium": 269, "potassium": 733}},
    {"name": "Dark Chocolate (85%)", "n": {"kcal": 604, "protein": 7.8, "carbs": 46, "sugar": 24, "fiber": 11, "fat": 43, "sat_fat": 25, "salt": 0.06, "iron": 11.9, "magnesium": 228, "b12": 0.3, "zinc": 3.3, "vit_c": 0, "vit_d": 0, "calcium": 73, "potassium": 715}},
    # Snacks / other
    {"name": "Apple", "n": {"kcal": 52, "protein": 0.3, "carbs": 14, "sugar": 10.4, "fiber": 2.4, "fat": 0.2, "sat_fat": 0, "salt": 0.003, "iron": 0.1, "magnesium": 5, "b12": 0, "zinc": 0.04, "vit_c": 4.6, "vit_d": 0, "calcium": 6, "potassium": 107}},
    {"name": "Protein Bar", "n": {"kcal": 350, "protein": 20.0, "carbs": 38, "sugar": 6.0, "fiber": 5.0, "fat": 12, "sat_fat": 5.0, "salt": 0.6, "iron": 3.0, "magnesium": 30, "b12": 1.5, "zinc": 2.0, "vit_c": 15, "vit_d": 2.5, "calcium": 200, "potassium": 180}},
    {"name": "Cottage Cheese (low-fat)", "n": {"kcal": 72, "protein": 12.0, "carbs": 2.7, "sugar": 2.7, "fiber": 0, "fat": 1.0, "sat_fat": 0.6, "salt": 0.9, "iron": 0.1, "magnesium": 8, "b12": 0.4, "zinc": 0.4, "vit_c": 0, "vit_d": 0, "calcium": 83, "potassium": 104}},
    {"name": "Honey", "n": {"kcal": 304, "protein": 0.3, "carbs": 82, "sugar": 82, "fiber": 0.2, "fat": 0, "sat_fat": 0, "salt": 0.01, "iron": 0.4, "magnesium": 2, "b12": 0, "zinc": 0.2, "vit_c": 0.5, "vit_d": 0, "calcium": 6, "potassium": 52}},
    {"name": "Milk (whole)", "n": {"kcal": 61, "protein": 3.2, "carbs": 4.8, "sugar": 4.8, "fiber": 0, "fat": 3.3, "sat_fat": 1.9, "salt": 0.1, "iron": 0, "magnesium": 11, "b12": 0.4, "zinc": 0.4, "vit_c": 0, "vit_d": 1.3, "calcium": 113, "potassium": 132}},
    {"name": "Cheddar Cheese", "n": {"kcal": 403, "protein": 25.0, "carbs": 1.3, "sugar": 0.5, "fiber": 0, "fat": 33, "sat_fat": 21, "salt": 1.6, "iron": 0.7, "magnesium": 28, "b12": 0.8, "zinc": 3.1, "vit_c": 0, "vit_d": 0.3, "calcium": 721, "potassium": 98}},
]

# ---------------------------------------------------------------------------
# Meal templates — (food_index, quantity_g_range) grouped by meal type
# ---------------------------------------------------------------------------
BREAKFAST_OPTIONS = [
    # Oatmeal bowl with banana and blueberries
    [("Oatmeal (cooked)", 250, 350), ("Banana", 80, 120), ("Blueberries", 40, 80), ("Honey", 10, 20)],
    # Eggs on toast
    [("Eggs (scrambled)", 150, 200), ("Whole Wheat Toast", 50, 70), ("Avocado", 30, 60)],
    # Protein shake + yogurt
    [("Whey Protein Shake", 30, 40), ("Greek Yogurt (plain, 2%)", 150, 200), ("Banana", 80, 120), ("Blueberries", 50, 80)],
    # Yogurt with peanut butter toast
    [("Greek Yogurt (plain, 2%)", 200, 250), ("Whole Wheat Toast", 60, 80), ("Peanut Butter", 15, 25)],
    # Simple eggs and cheese
    [("Eggs (scrambled)", 150, 200), ("Cheddar Cheese", 20, 30), ("Whole Wheat Toast", 50, 70)],
]

LUNCH_OPTIONS = [
    # Chicken rice bowl
    [("Chicken Breast (grilled)", 150, 200), ("White Rice (cooked)", 180, 250), ("Broccoli (steamed)", 100, 150), ("Olive Oil", 5, 10)],
    # Salmon with sweet potato
    [("Salmon Fillet (baked)", 150, 180), ("Sweet Potato (baked)", 200, 280), ("Mixed Salad Greens", 80, 120)],
    # Turkey salad
    [("Turkey Breast (roasted)", 130, 170), ("Quinoa (cooked)", 150, 200), ("Mixed Salad Greens", 100, 150), ("Avocado", 40, 70), ("Olive Oil", 5, 10)],
    # Tofu stir-fry
    [("Tofu (firm)", 200, 250), ("Brown Rice (cooked)", 200, 250), ("Bell Pepper (red)", 80, 120), ("Broccoli (steamed)", 80, 120)],
    # Beef with pasta
    [("Ground Beef (90% lean)", 120, 160), ("Pasta (cooked)", 180, 250), ("Olive Oil", 5, 10), ("Spinach (raw)", 40, 60)],
]

DINNER_OPTIONS = [
    # Chicken with quinoa
    [("Chicken Breast (grilled)", 150, 200), ("Quinoa (cooked)", 150, 200), ("Broccoli (steamed)", 120, 160), ("Olive Oil", 5, 10)],
    # Salmon pasta
    [("Salmon Fillet (baked)", 140, 180), ("Pasta (cooked)", 150, 220), ("Spinach (raw)", 50, 80), ("Olive Oil", 5, 10)],
    # Beef and rice
    [("Ground Beef (90% lean)", 150, 200), ("Brown Rice (cooked)", 180, 250), ("Avocado", 40, 70), ("Mixed Salad Greens", 60, 100)],
    # Turkey with sweet potato
    [("Turkey Breast (roasted)", 150, 200), ("Sweet Potato (baked)", 200, 300), ("Broccoli (steamed)", 100, 150)],
    # Tofu bowl
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

# ---------------------------------------------------------------------------
# Supplement definitions
# ---------------------------------------------------------------------------
SUPPLEMENT_DEFS = [
    {"name": "Vitamin D3", "dose_amount": 4000, "dose_unit": "IU", "time_of_day": "morning",
     "micronutrients": {"vitamin_d": 100}},
    {"name": "Fish Oil (Omega-3)", "dose_amount": 1000, "dose_unit": "mg", "time_of_day": "morning",
     "micronutrients": {"omega3": 500}},
    {"name": "Creatine Monohydrate", "dose_amount": 5, "dose_unit": "g", "time_of_day": "morning",
     "micronutrients": {}},
    {"name": "Zinc", "dose_amount": 25, "dose_unit": "mg", "time_of_day": "evening",
     "micronutrients": {"zinc": 25}},
    {"name": "Magnesium Glycinate", "dose_amount": 400, "dose_unit": "mg", "time_of_day": "evening",
     "micronutrients": {"magnesium": 400}},
]

MICRONUTRIENT_TARGETS = [
    {"nutrient": "vitamin_d", "target_value": 100, "unit": "µg"},
    {"nutrient": "zinc", "target_value": 15, "unit": "mg"},
    {"nutrient": "omega3", "target_value": 1000, "unit": "mg"},
    {"nutrient": "magnesium", "target_value": 400, "unit": "mg"},
    {"nutrient": "iron", "target_value": 18, "unit": "mg"},
    {"nutrient": "b12", "target_value": 2.4, "unit": "µg"},
]


def _rand(lo: float, hi: float) -> float:
    return round(random.uniform(lo, hi), 1)


async def seed_demo():
    random.seed(42)  # reproducible

    async with async_session() as db:
        # Check if demo user exists — wipe and recreate
        result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Wiping existing demo user data...")
            await db.execute(delete(FoodLog).where(FoodLog.user_id == existing.id))
            await db.execute(delete(WeightLog).where(WeightLog.user_id == existing.id))
            await db.execute(delete(Supplement).where(Supplement.user_id == existing.id))
            await db.execute(delete(SupplementDefinition).where(SupplementDefinition.user_id == existing.id))
            await db.execute(delete(MicronutrientTarget).where(MicronutrientTarget.user_id == existing.id))
            await db.execute(delete(User).where(User.id == existing.id))
            await db.commit()

        # Create demo user
        user = User(
            email=DEMO_EMAIL,
            password_hash=pwd_context.hash(DEMO_PASSWORD),
            api_key="demo-api-key-" + uuid.uuid4().hex[:20],
            display_name="Demo User",
            target_kcal=2200,
            target_protein_g=170.0,
            target_carbs_g=230.0,
            target_fat_g=75.0,
            target_fiber_g=30.0,
            target_sugar_g=50.0,
            target_sodium_mg=2300.0,
            target_weight_kg=78.0,
        )
        db.add(user)
        await db.flush()
        user_id = user.id
        print(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

        # ----- Supplement definitions -----
        for sd in SUPPLEMENT_DEFS:
            db.add(SupplementDefinition(
                user_id=user_id,
                name=sd["name"],
                dose_amount=sd["dose_amount"],
                dose_unit=sd["dose_unit"],
                time_of_day=sd["time_of_day"],
                active=True,
                micronutrients=sd["micronutrients"],
            ))

        # ----- Micronutrient targets -----
        for mt in MICRONUTRIENT_TARGETS:
            db.add(MicronutrientTarget(
                user_id=user_id,
                nutrient=mt["nutrient"],
                target_value=mt["target_value"],
                unit=mt["unit"],
            ))

        # ----- Seed foods (only if they don't exist) -----
        food_map: dict[str, uuid.UUID] = {}
        for f in FOODS:
            result = await db.execute(select(Food).where(Food.name == f["name"]))
            existing_food = result.scalar_one_or_none()
            if existing_food:
                food_map[f["name"]] = existing_food.id
            else:
                food = Food(name=f["name"], source="seed")
                db.add(food)
                await db.flush()
                food_map[f["name"]] = food.id
                n = f["n"]
                db.add(Nutrient(
                    food_id=food.id,
                    kcal=n.get("kcal", 0),
                    protein=n.get("protein", 0),
                    carbs=n.get("carbs", 0),
                    sugar=n.get("sugar", 0),
                    fiber=n.get("fiber", 0),
                    fat=n.get("fat", 0),
                    sat_fat=n.get("sat_fat", 0),
                    salt=n.get("salt", 0),
                    iron=n.get("iron", 0),
                    magnesium=n.get("magnesium", 0),
                    b12=n.get("b12", 0),
                    zinc=n.get("zinc", 0),
                    vit_c=n.get("vit_c", 0),
                    vit_d=n.get("vit_d", 0),
                    calcium=n.get("calcium", 0),
                    potassium=n.get("potassium", 0),
                    omega3=n.get("omega3", 0),
                    vit_k2=n.get("vit_k2", 0),
                ))

        # ----- Generate 90 days of data -----
        today = date.today()
        start_date = today - timedelta(days=89)

        # Weight trajectory: 85kg -> ~80kg with noise
        start_weight = 85.0
        end_weight = 80.0
        start_bf = 22.0
        end_bf = 18.5
        start_muscle = 37.5
        end_muscle = 39.5

        total_food_logs = 0
        total_weight_logs = 0
        total_supplement_logs = 0

        for day_offset in range(90):
            current_date = start_date + timedelta(day_offset)
            progress = day_offset / 89  # 0 to 1

            # Skip ~5% of days (rest days / forgot to log)
            if random.random() < 0.05:
                continue

            is_weekend = current_date.weekday() >= 5

            # --- Weight log (log ~80% of days) ---
            if random.random() < 0.80:
                base_weight = start_weight + (end_weight - start_weight) * progress
                # Add daily fluctuation (water, food timing)
                daily_weight = base_weight + random.gauss(0, 0.4)
                daily_weight = round(max(daily_weight, end_weight - 1), 1)

                base_bf = start_bf + (end_bf - start_bf) * progress
                daily_bf = round(base_bf + random.gauss(0, 0.3), 1)

                base_muscle = start_muscle + (end_muscle - start_muscle) * progress
                daily_muscle = round(base_muscle + random.gauss(0, 0.2), 1)

                db.add(WeightLog(
                    user_id=user_id,
                    date=current_date,
                    weight_kg=daily_weight,
                    body_fat_pct=daily_bf,
                    muscle_mass_pct=daily_muscle,
                    source="manual",
                ))
                total_weight_logs += 1

            # --- Food logs ---
            # Pick meals with some variation
            breakfast = random.choice(BREAKFAST_OPTIONS)
            lunch = random.choice(LUNCH_OPTIONS)
            dinner = random.choice(DINNER_OPTIONS)

            # 1-2 snacks, more on weekends
            num_snacks = random.choice([1, 1, 2]) if not is_weekend else random.choice([1, 2, 2, 3])
            snacks = random.sample(SNACK_OPTIONS, min(num_snacks, len(SNACK_OPTIONS)))

            # Weekend: slightly larger portions (10-20% more)
            portion_mult = random.uniform(1.05, 1.15) if is_weekend else 1.0

            # As user progresses, slightly tighter portions (discipline improving)
            discipline_mult = 1.0 - (progress * 0.05)  # 1.0 -> 0.95 over 90 days

            for meal_type, options in [("breakfast", breakfast), ("lunch", lunch), ("dinner", dinner)]:
                for food_name, lo, hi in options:
                    qty = _rand(lo, hi) * portion_mult * discipline_mult
                    db.add(FoodLog(
                        user_id=user_id,
                        food_id=food_map[food_name],
                        date=current_date,
                        quantity_g=round(qty, 1),
                        meal_type=meal_type,
                    ))
                    total_food_logs += 1

            for snack_items in snacks:
                for food_name, lo, hi in snack_items:
                    qty = _rand(lo, hi) * portion_mult
                    db.add(FoodLog(
                        user_id=user_id,
                        food_id=food_map[food_name],
                        date=current_date,
                        quantity_g=round(qty, 1),
                        meal_type="snack",
                    ))
                    total_food_logs += 1

            # --- Supplement logs (~88% adherence, slightly better over time) ---
            adherence = 0.82 + (progress * 0.10)  # 82% -> 92%
            for sd in SUPPLEMENT_DEFS:
                if random.random() < adherence:
                    db.add(Supplement(
                        user_id=user_id,
                        date=current_date,
                        name=sd["name"],
                        dose_amount=sd["dose_amount"],
                        dose_unit=sd["dose_unit"],
                        time_of_day=sd["time_of_day"],
                    ))
                    total_supplement_logs += 1

        await db.commit()

        print(f"\nSeeded 90 days of data:")
        print(f"  Food logs:       {total_food_logs}")
        print(f"  Weight logs:     {total_weight_logs}")
        print(f"  Supplement logs: {total_supplement_logs}")
        print(f"  Foods in DB:     {len(food_map)}")
        print(f"  Supplements:     {len(SUPPLEMENT_DEFS)} definitions")
        print(f"  Micro targets:   {len(MICRONUTRIENT_TARGETS)}")
        print(f"\nDemo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed_demo())
