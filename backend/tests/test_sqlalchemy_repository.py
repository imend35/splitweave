from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.main import create_app
from app.repositories.models import ExpenseModel, ExpenseShareModel
from app.repositories.sqlalchemy import SQLAlchemyRepository


def database_url(tmp_path, name: str) -> str:
    return f"sqlite:///{tmp_path / name}"


def create_group(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/groups",
        json={
            "name": "Persistent Trip",
            "description": "Survives application restarts",
            "groupType": "trip",
            "currency": "EUR",
            "memberNames": ["Ada", "Deniz"],
        },
    )
    assert response.status_code == 201
    return response.json()


def expense_payload(group: dict, *, amount: str = "10.01") -> dict:
    return {
        "title": "Train tickets",
        "amount": amount,
        "expenseDate": "2025-01-01",
        "category": "transport",
        "paidByMemberId": group["members"][0]["id"],
        "splitMethod": "equal",
        "participants": [
            {"memberId": member["id"], "inputValue": "1", "position": position}
            for position, member in enumerate(group["members"])
        ],
        "note": "Database round-trip",
    }


def test_data_survives_repository_and_application_restart(tmp_path) -> None:
    url = database_url(tmp_path, "restart.db")
    first_repository = SQLAlchemyRepository(url)
    with TestClient(create_app(repository=first_repository)) as first_client:
        group = create_group(first_client)
        group_id = group["id"]
        expense = first_client.post(
            f"/api/v1/groups/{group_id}/expenses", json=expense_payload(group)
        )
        assert expense.status_code == 201
        suggestion = first_client.get(
            f"/api/v1/groups/{group_id}/settlement-suggestions"
        ).json()[0]
        settlement = first_client.post(
            f"/api/v1/groups/{group_id}/settlements",
            json={
                "fromMemberId": suggestion["fromMemberId"],
                "toMemberId": suggestion["toMemberId"],
                "amount": "2.00",
                "settlementDate": "2025-01-02",
                "note": "Partial",
            },
        )
        assert settlement.status_code == 201

    second_repository = SQLAlchemyRepository(url)
    with TestClient(create_app(repository=second_repository)) as second_client:
        restored = second_client.get(f"/api/v1/groups/{group_id}")
        assert restored.status_code == 200
        assert restored.json()["expenses"][0]["amount"] == "10.01"
        assert restored.json()["settlements"][0]["amount"] == "2.00"
        balances = second_client.get(f"/api/v1/groups/{group_id}/balances").json()
        assert balances["totalSpent"] == "10.01"
        assert balances["unsettled"] == "3.00"


def test_aggregate_updates_and_deletes_are_persisted(tmp_path) -> None:
    url = database_url(tmp_path, "mutations.db")
    repository = SQLAlchemyRepository(url)
    with TestClient(create_app(repository=repository)) as client:
        group = create_group(client)
        group_id = group["id"]
        created = client.post(
            f"/api/v1/groups/{group_id}/expenses", json=expense_payload(group)
        ).json()
        updated = client.put(
            f"/api/v1/groups/{group_id}/expenses/{created['id']}",
            json=expense_payload(group, amount="20.01"),
        )
        assert updated.status_code == 200
        assert updated.json()["amount"] == "20.01"
        assert [share["allocatedAmount"] for share in updated.json()["shares"]] == [
            "10.01",
            "10.00",
        ]

    reopened = SQLAlchemyRepository(url)
    with TestClient(create_app(repository=reopened)) as client:
        restored = client.get(f"/api/v1/groups/{group_id}").json()
        assert restored["expenses"][0]["amount"] == "20.01"
        assert client.delete(
            f"/api/v1/groups/{group_id}/expenses/{restored['expenses'][0]['id']}"
        ).status_code == 204

    final_repository = SQLAlchemyRepository(url)
    final_group = final_repository.get(group_id)
    assert final_group is not None
    assert final_group.expenses == []
    assert [member.name for member in final_group.members] == ["Ada", "Deniz"]
    final_repository.close()


def test_money_uses_fixed_precision_columns_and_clear_cascades(tmp_path) -> None:
    url = database_url(tmp_path, "precision.db")
    repository = SQLAlchemyRepository(url)
    with TestClient(create_app(repository=repository)) as client:
        group = create_group(client)
        client.post(f"/api/v1/groups/{group['id']}/expenses", json=expense_payload(group))

    inspection_repository = SQLAlchemyRepository(url)
    with Session(inspection_repository.engine) as session:
        stored_amount = session.scalar(select(ExpenseModel.amount))
        assert stored_amount == Decimal("10.01")
        assert session.scalar(select(func.count()).select_from(ExpenseShareModel)) == 2

    inspection_repository.clear()
    assert inspection_repository.list() == []
    with Session(inspection_repository.engine) as session:
        assert session.scalar(select(func.count()).select_from(ExpenseShareModel)) == 0
    inspection_repository.close()
