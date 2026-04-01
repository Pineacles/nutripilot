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
    Supplement, SupplementDefinition, User, WaterLog,
    CaffeineLog, WeightLog,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_EMAIL = "demo@nutripilot.dev"
DEMO_PASSWORD = "demo"

# ---------------------------------------------------------------------------
# Extra foods — only created if not already in the DB (supplements, etc.)
# Nutrients per 100g.
# ---------------------------------------------------------------------------
EXTRA_FOODS = [
    {"name": "Whey Protein Shake", "n": {"kcal": 120, "protein": 24.0, "carbs": 3.0, "sugar": 2.0, "fiber": 0, "fat": 1.5, "sat_fat": 0.5, "salt": 0.3, "iron": 1.5, "magnesium": 20, "b12": 0.5, "zinc": 2.0, "vit_c": 0, "vit_d": 0, "calcium": 120, "potassium": 160}},
    {"name": "Protein Bar", "n": {"kcal": 350, "protein": 20.0, "carbs": 38, "sugar": 6.0, "fiber": 5.0, "fat": 12, "sat_fat": 5.0, "salt": 0.6, "iron": 3.0, "magnesium": 30, "b12": 1.5, "zinc": 2.0, "vit_c": 15, "vit_d": 2.5, "calcium": 200, "potassium": 180}},
    {"name": "Mixed Salad Greens", "n": {"kcal": 17, "protein": 1.5, "carbs": 2.9, "sugar": 0.8, "fiber": 1.8, "fat": 0.2, "sat_fat": 0, "salt": 0.04, "iron": 1.5, "magnesium": 13, "b12": 0, "zinc": 0.2, "vit_c": 18, "vit_d": 0, "calcium": 36, "potassium": 290}},
    {"name": "Blueberries", "n": {"kcal": 57, "protein": 0.7, "carbs": 14.5, "sugar": 10.0, "fiber": 2.4, "fat": 0.3, "sat_fat": 0, "salt": 0.003, "iron": 0.3, "magnesium": 6, "b12": 0, "zinc": 0.2, "vit_c": 9.7, "vit_d": 0, "calcium": 6, "potassium": 77}},
]

# ---------------------------------------------------------------------------
# Meal templates — (food_index, quantity_g_range) grouped by meal type
# ---------------------------------------------------------------------------
BREAKFAST_OPTIONS = [
    # Oatmeal bowl with banana and blueberries
    [("Oat flakes", 250, 350), ("Banana, raw", 80, 120), ("Blueberries", 40, 80), ("Honey, from flowers", 10, 20)],
    # Eggs on toast
    [("Scrambled eggs, prepared", 150, 200), ("Bread for toasting, wholemeal", 50, 70), ("Avocado, fresh", 30, 60)],
    # Protein shake + yogurt
    [("Whey Protein Shake", 30, 40), ("Yogurt, low fat", 150, 200), ("Banana, raw", 80, 120), ("Blueberries", 50, 80)],
    # Yogurt with peanut butter toast
    [("Yogurt, low fat", 200, 250), ("Bread for toasting, wholemeal", 60, 80), ("Peanut butter", 15, 25)],
    # Simple eggs and cheese
    [("Scrambled eggs, prepared", 150, 200), ("Emmentaler cheese, at least 45% fidm", 20, 30), ("Bread for toasting, wholemeal", 50, 70)],
]

LUNCH_OPTIONS = [
    # Chicken rice bowl
    [("Chicken, breast, without skin, raw", 150, 200), ("Rice polished, cooked in salted water (uniodised)", 180, 250), ("Broccoli, steamed (without addition of salt)", 100, 150), ("Olive oil", 5, 10)],
    # Salmon with sweet potato
    [("Salmon, cultured, raw", 150, 180), ("Sweet potato, raw", 200, 280), ("Mixed Salad Greens", 80, 120)],
    # Turkey salad
    [("Turkey, breast (schnitzel, ground), raw", 130, 170), ("Quinoa, cooked (without addition of salt and fat)", 150, 200), ("Mixed Salad Greens", 100, 150), ("Avocado, fresh", 40, 70), ("Olive oil", 5, 10)],
    # Tofu stir-fry
    [("Tofu, firm, plain (average)", 200, 250), ("Rice unpolished, cooked in salted water (uniodised)", 200, 250), ("Bell pepper, red, raw", 80, 120), ("Broccoli, steamed (without addition of salt)", 80, 120)],
    # Beef with pasta
    [("Beef, minced, raw", 120, 160), ("Pasta egg-free, cooked in salted water (uniodised)", 180, 250), ("Olive oil", 5, 10), ("Spinach, raw", 40, 60)],
]

DINNER_OPTIONS = [
    # Chicken with quinoa
    [("Chicken, breast, without skin, raw", 150, 200), ("Quinoa, cooked (without addition of salt and fat)", 150, 200), ("Broccoli, steamed (without addition of salt)", 120, 160), ("Olive oil", 5, 10)],
    # Salmon pasta
    [("Salmon, cultured, raw", 140, 180), ("Pasta egg-free, cooked in salted water (uniodised)", 150, 220), ("Spinach, raw", 50, 80), ("Olive oil", 5, 10)],
    # Beef and rice
    [("Beef, minced, raw", 150, 200), ("Rice unpolished, cooked in salted water (uniodised)", 180, 250), ("Avocado, fresh", 40, 70), ("Mixed Salad Greens", 60, 100)],
    # Turkey with sweet potato
    [("Turkey, breast (schnitzel, ground), raw", 150, 200), ("Sweet potato, raw", 200, 300), ("Broccoli, steamed (without addition of salt)", 100, 150)],
    # Tofu bowl
    [("Tofu, firm, plain (average)", 180, 250), ("Rice polished, cooked in salted water (uniodised)", 180, 250), ("Spinach, raw", 50, 80), ("Bell pepper, red, raw", 80, 120), ("Olive oil", 5, 10)],
]

SNACK_OPTIONS = [
    [("Almond", 25, 40)],
    [("Apple, fresh", 150, 200)],
    [("Protein Bar", 55, 65)],
    [("Cottage cheese", 150, 200)],
    [("Yogurt, low fat", 150, 200), ("Blueberries", 40, 60)],
    [("Chocolate, dark", 15, 25)],
    [("Banana, raw", 100, 130), ("Peanut butter", 15, 25)],
    [("Whey Protein Shake", 30, 40), ("Whole milk, UHT", 200, 300)],
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
            await db.execute(delete(WaterLog).where(WaterLog.user_id == existing.id))
            await db.execute(delete(CaffeineLog).where(CaffeineLog.user_id == existing.id))
            await db.execute(delete(Supplement).where(Supplement.user_id == existing.id))
            await db.execute(delete(SupplementDefinition).where(SupplementDefinition.user_id == existing.id))
            await db.execute(delete(MicronutrientTarget).where(MicronutrientTarget.user_id == existing.id))
            from app.models.integration import Integration
            await db.execute(delete(Integration).where(Integration.user_id == existing.id))
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
            target_water_ml=2500.0,
            target_caffeine_mg=400.0,
            target_alcohol_g=20.0,  # moderate drinking limit
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

        # ----- Build food map from existing DB foods -----
        result = await db.execute(select(Food))
        food_map: dict[str, uuid.UUID] = {f.name: f.id for f in result.scalars().all()}
        print(f"Found {len(food_map)} foods in database")

        # Create extra foods (supplements, etc.) only if not already present
        for f in EXTRA_FOODS:
            if f["name"] not in food_map:
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
                print(f"  Created extra food: {f['name']}")

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
        total_water_logs = 0
        total_caffeine_logs = 0
        _warned_foods: set[str] = set()

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
                    if food_name not in food_map:
                        if food_name not in _warned_foods:
                            print(f"  WARNING: food not found in DB, skipping: {food_name}")
                            _warned_foods.add(food_name)
                        continue
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
                    if food_name not in food_map:
                        if food_name not in _warned_foods:
                            print(f"  WARNING: food not found in DB, skipping: {food_name}")
                            _warned_foods.add(food_name)
                        continue
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

            # --- Water logs (1500-3500ml per day, 2-5 entries) ---
            num_water = random.choice([2, 3, 3, 4, 5])
            for _ in range(num_water):
                amount = random.randint(200, 600)
                db.add(WaterLog(
                    user_id=user_id,
                    date=current_date,
                    amount_ml=float(amount),
                ))
                total_water_logs += 1

            # --- Caffeine logs (0-3 per day, morning/afternoon) ---
            num_caffeine = random.choice([0, 1, 1, 2, 2, 3])
            caffeine_sources = [
                ("espresso", 63),
                ("cappuccino", 80),
                ("filter coffee", 95),
                ("green tea", 30),
                ("energy drink", 80),
                ("black tea", 47),
            ]
            for _ in range(num_caffeine):
                source, mg = random.choice(caffeine_sources)
                # Add some variation
                mg = mg + random.randint(-10, 10)
                db.add(CaffeineLog(
                    user_id=user_id,
                    date=current_date,
                    amount_mg=float(max(mg, 10)),
                    source_name=source,
                ))
                total_caffeine_logs += 1

        await db.commit()

        print(f"\nSeeded 90 days of data:")
        print(f"  Food logs:       {total_food_logs}")
        print(f"  Weight logs:     {total_weight_logs}")
        print(f"  Supplement logs: {total_supplement_logs}")
        print(f"  Water logs:      {total_water_logs}")
        print(f"  Caffeine logs:   {total_caffeine_logs}")
        print(f"  Foods in DB:     {len(food_map)}")
        print(f"  Supplements:     {len(SUPPLEMENT_DEFS)} definitions")
        print(f"  Micro targets:   {len(MICRONUTRIENT_TARGETS)}")
        print(f"\nDemo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed_demo())
