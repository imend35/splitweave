from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.memory import InMemoryRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(repository=InMemoryRepository(seed=False))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def group(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/groups",
        json={
            "name": "Alpine Weekend",
            "description": "A deterministic API test group",
            "groupType": "trip",
            "currency": "EUR",
            "memberNames": ["Ada", "Deniz", "Mira"],
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def equal_expense_payload(group: dict) -> dict:
    members = group["members"]
    return {
        "title": "Mountain cabin",
        "amount": "100.00",
        "expenseDate": "2025-01-01",
        "category": "accommodation",
        "paidByMemberId": members[0]["id"],
        "splitMethod": "equal",
        "participants": [
            {"memberId": member["id"], "inputValue": "1", "position": position}
            for position, member in enumerate(members)
        ],
        "note": "Three-way split",
    }
