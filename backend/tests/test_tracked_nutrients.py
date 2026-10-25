"""Settings, Tracked nutrients: which nutrients the dashboard shows."""

import pytest

pytestmark = pytest.mark.asyncio


async def test_hide_and_show_nutrients(async_client, auth_headers):
    assert (await async_client.get("/api/v1/settings", headers=auth_headers)).json()["hidden_nutrients"] == []
    resp = await async_client.put(
        "/api/v1/settings/tracked-nutrients", json={"hidden": ["alcohol", "vit_k2", "alcohol"]}, headers=auth_headers
    )
    assert resp.status_code == 200 and resp.json()["hidden"] == ["vit_k2", "alcohol"]
    assert (await async_client.get("/api/v1/settings", headers=auth_headers)).json()["hidden_nutrients"] == [
        "vit_k2", "alcohol"
    ]
    # Calories always stay; unknown names are refused.
    for bad in (["kcal"], ["sodium_typo"]):
        resp = await async_client.put("/api/v1/settings/tracked-nutrients", json={"hidden": bad}, headers=auth_headers)
        assert resp.status_code == 422


async def test_recents_put_the_usual_food_for_the_meal_first(async_client, auth_headers, api_key_headers):
    ids = {}
    for name in ("Usual oats", "Last pasta"):
        resp = await async_client.post("/api/foods", json={"name": name, "nutrients": {"kcal": 100}}, headers=api_key_headers)
        ids[name] = resp.json()["id"]
    for day, name, meal in (("2024-06-01", "Usual oats", "breakfast"), ("2024-06-02", "Usual oats", "breakfast"),
                            ("2024-06-03", "Last pasta", "dinner")):
        resp = await async_client.post(
            "/api/agent/log/food",
            json={"food_id": ids[name], "quantity_g": 80, "meal_type": meal, "date": day},
            headers=api_key_headers,
        )
        assert resp.status_code == 201, resp.text
    newest = (await async_client.get("/api/dashboard/foods/recent", headers=auth_headers)).json()
    assert newest[0]["name"] == "Last pasta"
    breakfast = (await async_client.get("/api/dashboard/foods/recent?meal=breakfast", headers=auth_headers)).json()
    assert breakfast[0]["name"] == "Usual oats"
