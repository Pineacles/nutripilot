"""Alcohol for Swiss database foods

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-23 00:10:00.000000

The Swiss food composition import never read the database's "Alcohol (g)"
column, so wine, beer and spirits counted 0 g toward the alcohol target. These
are the official per 100 g values from that column (Swiss_food_composition_database.xlsx,
2025-07 edition), set only where the value is still empty.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALCOHOL_G_PER_100G = [
    ('Amaro Ramazzotti (30 vol%)', 21.5),
    ('Basler Leckerli (Swiss biscuit from Basel)', 0.8),
    ('Beer shandy (average)', 1.3),
    ('Beer, five grain', 4.1),
    ('Beer, lager', 4.0),
    ('Beer, non-alcoholic', 0.3),
    ('Biber (Filled ginger bread type)', 0.7),
    ('Bierwurst (coarse heat-treated, cured & smoked sausage, beef and pork)', 0.1),
    ('Birnenweggen, pastry with pear', 1.0),
    ('Calimocho (red wine mixed with cola)', 4.8),
    ('Cherry pie from Zug', 0.9),
    ('Cider, 4 vol%', 3.1),
    ('Cider, 6.2 vol%', 5.0),
    ('Cooked sausages (average)', 0.1),
    ('Egg liqueur, 16.5 vol%', 13.4),
    ('Fondue moitié-moitié, prepared', 4.7),
    ('Fondue, prepared', 4.4),
    ('Fondue, prepared with cider', 1.2),
    ('Luganighe', 0.2),
    ('Malibu Coconut (21 vol%)', 15.8),
    ('Milk chocolate, filled with alcohol', 2.2),
    ('Pastis 51 de Marseille (45 vol%)', 37.5),
    ("Peasant's Schüblig", 0.1),
    ('Port, 18.5 vol%', 14.8),
    ('Raw sausages with interrupted maturation (average)', 0.1),
    ('Saucisson sausage', 0.1),
    ('Saucisson sausage, cooked (without addition of fat and salt)', 0.1),
    ('Sherry, 18.5 vol%', 14.8),
    ('Shrimp cocktail, prepared', 1.9),
    ('Sorbet, fruit', 0.9),
    ('Sparkling wine, champagne', 9.1),
    ('Spirits, 40 vol% (e.g. Vodka, gin)', 33.4),
    ('Spirits, Kirsch, Cherry Schnaps', 35.0),
    ('Spirits, grain, 40% vol (e.g. whisky)', 35.2),
    ('Spirits, sugar cane (e.g. rum)', 33.4),
    ('Spirits, wine (e.g. cognac, brandy)', 33.1),
    ('Suze (20 vol%)', 15.3),
    ('Terrine de campagne', 0.3),
    ('Terrine, game meat', 0.3),
    ('Tiramisu', 1.6),
    ('Vermouth, 15 vol%', 12.1),
    ('Vinegar', 0.1),
    ('Wine red, 12 vol%', 9.6),
    ('Wine red, 13.5 vol%', 10.7),
    ('Wine red, 9 vol%', 7.5),
    ('Wine white, 11 vol%', 8.8),
    ('Wine white, 12.5 vol%', 10.0),
    ('Wine white, spritzer, sour', 5.0),
    ('Wine white, spritzer, sweet', 5.0),
]


def upgrade() -> None:
    stmt = sa.text(
        "UPDATE nutrients SET alcohol = :alcohol FROM foods "
        "WHERE nutrients.food_id = foods.id AND foods.source = 'swiss_db' "
        "AND foods.name = :name AND nutrients.alcohol IS NULL"
    )
    for name, grams in ALCOHOL_G_PER_100G:
        op.execute(stmt.bindparams(name=name, alcohol=grams))


def downgrade() -> None:
    # The values are correct data, not schema; nothing to undo.
    pass
