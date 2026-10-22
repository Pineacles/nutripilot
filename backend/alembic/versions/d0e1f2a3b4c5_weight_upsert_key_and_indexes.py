"""Merge doubled synced weights, and indexes for food lookups

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-23 00:00:00.000000

Overlapping syncs left a few synced (user, date, source) days twice, which made
the upsert fail for those days. Each is merged into one row with the averages
(what every chart already showed for that day); upsert_weight now repairs any
new ones itself. No unique constraint: the agent API allows several entries a
day for any source. The indexes cover food_id lookups (delete checks, recents,
servings) and per-user supplement definitions and own foods.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        WITH groups AS (
            SELECT user_id, date, source, min(id::text)::uuid AS keep,
                   avg(weight_kg) AS weight_kg, avg(body_fat_pct) AS body_fat_pct,
                   avg(muscle_mass_pct) AS muscle_mass_pct, avg(body_fat_kg) AS body_fat_kg,
                   avg(muscle_mass_kg) AS muscle_mass_kg
            FROM weight_logs WHERE source <> 'manual'
            GROUP BY user_id, date, source HAVING count(*) > 1
        )
        UPDATE weight_logs w SET weight_kg = g.weight_kg, body_fat_pct = g.body_fat_pct,
               muscle_mass_pct = g.muscle_mass_pct, body_fat_kg = g.body_fat_kg,
               muscle_mass_kg = g.muscle_mass_kg
        FROM groups g WHERE w.id = g.keep
    """)
    op.execute("""
        DELETE FROM weight_logs w USING weight_logs k
        WHERE w.user_id = k.user_id AND w.date = k.date AND w.source = k.source
          AND w.source <> 'manual' AND w.id::text > k.id::text
    """)
    op.create_index('idx_food_logs_food', 'food_logs', ['food_id'])
    op.create_index('idx_food_servings_food', 'food_servings', ['food_id'])
    op.create_index('idx_supplement_definitions_user', 'supplement_definitions', ['user_id'])
    op.create_index('idx_foods_created_by', 'foods', ['created_by'])


def downgrade() -> None:
    op.drop_index('idx_foods_created_by', table_name='foods')
    op.drop_index('idx_supplement_definitions_user', table_name='supplement_definitions')
    op.drop_index('idx_food_servings_food', table_name='food_servings')
    op.drop_index('idx_food_logs_food', table_name='food_logs')
