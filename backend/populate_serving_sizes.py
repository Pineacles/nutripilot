"""Populate common serving sizes for Swiss DB foods.
Usage: docker compose exec api python -m populate_serving_sizes
"""
import asyncio

from sqlalchemy import update

from app.database import async_session
from app.models.food import Food

# Common serving sizes: name -> (serving_size_g, serving_label)
SERVING_SIZES = {
    "Chicken egg, whole, hard boiled": (55, "1 egg"),
    "Egg, raw": (55, "1 egg"),
    "Scrambled eggs, prepared": (100, "1 serving"),
    "Banana, raw": (120, "1 medium banana"),
    "Apple, fresh": (180, "1 medium apple"),
    "Bread for toasting, wholemeal": (30, "1 slice"),
    "Bread for toasting, white, made with butter": (30, "1 slice"),
    "Bread for toasting, white, made with vegetable oil": (30, "1 slice"),
    "Braided white bread made with butter": (60, "1 slice"),
    "Brown bread": (50, "1 slice"),
    "White bread": (50, "1 slice"),
    "Semi-white bread": (50, "1 slice"),
    "Wholewheat bread": (50, "1 slice"),
    "Yogurt natural": (180, "1 cup"),
    "Yogurt, low fat": (180, "1 cup"),
    "Yogurt, strawberry": (180, "1 cup"),
    "Milk partially skimmed, UHT": (200, "1 glass"),
    "Whole milk, UHT": (200, "1 glass"),
    "Oat flakes": (40, "1 serving (4 tbsp)"),
    "Rice polished, cooked in salted water (uniodised)": (180, "1 cup cooked"),
    "Rice unpolished, cooked in salted water (uniodised)": (180, "1 cup cooked"),
    "Pasta egg-free, cooked in salted water (uniodised)": (180, "1 cup cooked"),
    "Quinoa, cooked (without addition of salt and fat)": (185, "1 cup cooked"),
    "Chicken, breast, without skin, raw": (150, "1 breast"),
    "Chicken, breast, with skin, raw": (170, "1 breast"),
    "Salmon, cultured, raw": (150, "1 fillet"),
    "Salmon, wild, raw": (150, "1 fillet"),
    "Beef, minced, raw": (125, "1 patty"),
    "Almond": (30, "1 handful"),
    "Peanut butter": (32, "2 tbsp"),
    "Olive oil": (14, "1 tbsp"),
    "Honey, from flowers": (21, "1 tbsp"),
    "Avocado, fresh": (150, "1 avocado"),
    "Broccoli, steamed (without addition of salt)": (150, "1 cup"),
    "Spinach, raw": (30, "1 cup"),
    "Sweet potato, raw": (130, "1 medium"),
    "Potato, peeled, raw": (150, "1 medium"),
    "Cottage cheese": (200, "1 cup"),
    "Emmentaler cheese, at least 45% fidm": (30, "1 slice"),
    "Raclette cheese": (30, "1 slice"),
    "Chocolate, dark": (25, "3 squares"),
    "Tofu, firm, plain (average)": (125, "1/2 block"),
    "Turkey, breast (schnitzel, ground), raw": (150, "1 breast"),
    "Bell pepper, red, raw": (120, "1 pepper"),
}


async def populate():
    async with async_session() as db:
        count = 0
        for name, (size_g, label) in SERVING_SIZES.items():
            result = await db.execute(
                update(Food)
                .where(Food.name == name)
                .values(serving_size_g=size_g, serving_label=label)
            )
            count += result.rowcount
        await db.commit()
        print(f"Updated {count} foods with serving sizes")


if __name__ == "__main__":
    asyncio.run(populate())
