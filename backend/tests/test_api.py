from fastapi.testclient import TestClient


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    payload = response.json()
    assert payload["error"]["code"] == code
    assert payload["error"]["message"]
    assert isinstance(payload["error"]["details"], list)


def test_health_and_empty_group_list(client: TestClient) -> None:
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    assert client.get("/api/v1/groups").json() == []


def test_group_member_crud_and_duplicate_name_conflict(client: TestClient, group: dict) -> None:
    group_id = group["id"]
    assert group["name"] == "Alpine Weekend"
    assert group["currency"] == "EUR"
    assert [member["name"] for member in group["members"]] == ["Ada", "Deniz", "Mira"]

    added = client.post(f"/api/v1/groups/{group_id}/members", json={"name": "Can"})
    assert added.status_code == 201
    member = added.json()

    renamed = client.patch(
        f"/api/v1/groups/{group_id}/members/{member['id']}", json={"name": "Cansu"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Cansu"

    duplicate = client.post(f"/api/v1/groups/{group_id}/members", json={"name": " ada "})
    assert_error(duplicate, 409, "MEMBER_NAME_CONFLICT")


def test_equal_expense_balances_and_suggestions(
    client: TestClient, group: dict, equal_expense_payload: dict
) -> None:
    group_id = group["id"]
    created = client.post(f"/api/v1/groups/{group_id}/expenses", json=equal_expense_payload)
    assert created.status_code == 201
    expense = created.json()
    assert expense["amount"] == "100.00"
    assert [share["allocatedAmount"] for share in expense["shares"]] == [
        "33.34",
        "33.33",
        "33.33",
    ]

    balances = client.get(f"/api/v1/groups/{group_id}/balances")
    assert balances.status_code == 200
    payload = balances.json()
    assert payload["totalSpent"] == "100.00"
    assert payload["unsettled"] == "66.66"
    assert sum(int(line["netMinorUnits"]) for line in payload["balances"]) == 0

    suggestions = client.get(f"/api/v1/groups/{group_id}/settlement-suggestions").json()
    result = [
        (item["fromMemberName"], item["toMemberName"], item["amount"])
        for item in suggestions
    ]
    assert result == [
        ("Deniz", "Ada", "33.33"),
        ("Mira", "Ada", "33.33"),
    ]


def test_partial_settlement_updates_and_delete_reverses_balances(
    client: TestClient, group: dict, equal_expense_payload: dict
) -> None:
    group_id = group["id"]
    client.post(f"/api/v1/groups/{group_id}/expenses", json=equal_expense_payload)
    suggestion = client.get(f"/api/v1/groups/{group_id}/settlement-suggestions").json()[0]

    settlement = client.post(
        f"/api/v1/groups/{group_id}/settlements",
        json={
            "fromMemberId": suggestion["fromMemberId"],
            "toMemberId": suggestion["toMemberId"],
            "amount": "10.00",
            "settlementDate": "2025-01-02",
            "note": "Partial repayment",
        },
    )
    assert settlement.status_code == 201
    assert client.get(f"/api/v1/groups/{group_id}/balances").json()["unsettled"] == "56.66"

    deleted = client.delete(
        f"/api/v1/groups/{group_id}/settlements/{settlement.json()['id']}"
    )
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/groups/{group_id}/balances").json()["unsettled"] == "66.66"


def test_invalid_split_and_excessive_settlement_return_stable_errors(
    client: TestClient, group: dict, equal_expense_payload: dict
) -> None:
    group_id = group["id"]
    invalid = {
        **equal_expense_payload,
        "splitMethod": "percentage",
        "participants": [
            {**participant, "inputValue": "20"}
            for participant in equal_expense_payload["participants"]
        ],
    }
    assert_error(
        client.post(f"/api/v1/groups/{group_id}/expenses", json=invalid),
        400,
        "PERCENTAGE_TOTAL_MISMATCH",
    )

    client.post(f"/api/v1/groups/{group_id}/expenses", json=equal_expense_payload)
    suggestion = client.get(f"/api/v1/groups/{group_id}/settlement-suggestions").json()[0]
    excessive = client.post(
        f"/api/v1/groups/{group_id}/settlements",
        json={
            "fromMemberId": suggestion["fromMemberId"],
            "toMemberId": suggestion["toMemberId"],
            "amount": "99.00",
            "settlementDate": "2025-01-02",
            "note": "Too much",
        },
    )
    assert_error(excessive, 400, "SETTLEMENT_EXCEEDS_BALANCE")


def test_update_delete_filter_and_archive_guards(
    client: TestClient, group: dict, equal_expense_payload: dict
) -> None:
    group_id = group["id"]
    first = client.post(f"/api/v1/groups/{group_id}/expenses", json=equal_expense_payload).json()
    second_payload = {
        **equal_expense_payload,
        "title": "Train tickets",
        "amount": "60.00",
        "category": "transport",
    }
    second = client.post(f"/api/v1/groups/{group_id}/expenses", json=second_payload).json()

    filtered = client.get(
        f"/api/v1/groups/{group_id}/expenses", params={"category": "transport", "search": "train"}
    )
    assert filtered.status_code == 200
    assert [expense["id"] for expense in filtered.json()] == [second["id"]]

    updated_payload = {**equal_expense_payload, "title": "Updated cabin", "amount": "90.00"}
    updated = client.put(
        f"/api/v1/groups/{group_id}/expenses/{first['id']}", json=updated_payload
    )
    assert updated.status_code == 200
    assert updated.json()["amount"] == "90.00"
    assert client.delete(f"/api/v1/groups/{group_id}/expenses/{second['id']}").status_code == 204
    assert client.get(f"/api/v1/groups/{group_id}/balances").json()["totalSpent"] == "90.00"

    locked_currency = client.patch(f"/api/v1/groups/{group_id}", json={"currency": "USD"})
    assert_error(locked_currency, 409, "CURRENCY_LOCKED")

    assert client.patch(f"/api/v1/groups/{group_id}", json={"isArchived": True}).status_code == 200
    archived_write = client.post(f"/api/v1/groups/{group_id}/members", json={"name": "Blocked"})
    assert_error(archived_write, 409, "GROUP_ARCHIVED")


def test_validation_and_not_found_use_documented_error_shape(client: TestClient) -> None:
    invalid = client.post(
        "/api/v1/groups",
        json={"name": " ", "groupType": "trip", "currency": "EUR", "memberNames": []},
    )
    assert_error(invalid, 422, "VALIDATION_ERROR")
    assert invalid.json()["error"]["details"]

    missing = client.get("/api/v1/groups/00000000-0000-0000-0000-000000000000")
    assert_error(missing, 404, "GROUP_NOT_FOUND")
