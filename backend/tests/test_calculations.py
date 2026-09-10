import pytest

from app.errors import DomainError
from app.services.calculations import BalancePosition, allocate_shares, suggest_settlements


def allocations(total_cents: int, method: str, values: list[str]) -> list[int]:
    participants = [
        {"member_id": f"member-{index}", "input_value": value, "position": index}
        for index, value in enumerate(values)
    ]
    return [
        allocation.allocated_cents
        for allocation in allocate_shares(total_cents, method, participants)
    ]


def test_equal_split_uses_stable_largest_remainder_order() -> None:
    assert allocations(10_000, "equal", ["1", "1", "1"]) == [3334, 3333, 3333]


def test_exact_split_must_equal_total() -> None:
    assert allocations(12_000, "exact", ["50.00", "40.00", "30.00"]) == [5000, 4000, 3000]

    with pytest.raises(DomainError, match="equal the expense total") as error:
        allocations(12_000, "exact", ["50.00", "40.00", "29.99"])

    assert error.value.code == "SPLIT_TOTAL_MISMATCH"


def test_percentage_split_validates_total_and_rounds_deterministically() -> None:
    assert allocations(20_000, "percentage", ["50", "30", "20"]) == [10_000, 6000, 4000]

    with pytest.raises(DomainError) as error:
        allocations(20_000, "percentage", ["50", "30", "19.99"])

    assert error.value.code == "PERCENTAGE_TOTAL_MISMATCH"


def test_weighted_split_supports_rounding_and_rejects_fractional_weights() -> None:
    assert allocations(101, "shares", ["2", "1", "1"]) == [51, 25, 25]

    with pytest.raises(DomainError) as error:
        allocations(101, "shares", ["1.5", "1", "1"])

    assert error.value.code == "INVALID_SHARE_WEIGHT"


def test_duplicate_participants_are_rejected() -> None:
    participants = [
        {"member_id": "same", "input_value": "1", "position": 0},
        {"member_id": "same", "input_value": "1", "position": 1},
    ]

    with pytest.raises(DomainError) as error:
        allocate_shares(1000, "equal", participants)

    assert error.value.code == "DUPLICATE_PARTICIPANT"


def test_suggestions_match_largest_balances_then_creation_order() -> None:
    balances = [
        BalancePosition("a", "Ada", "#000", True, 0, 0, 0, 0, 0, 7000),
        BalancePosition("b", "Bora", "#111", True, 1, 0, 0, 0, 0, 3000),
        BalancePosition("c", "Can", "#222", True, 2, 0, 0, 0, 0, -6000),
        BalancePosition("d", "Derya", "#333", True, 3, 0, 0, 0, 0, -4000),
    ]

    suggestions = suggest_settlements(balances)

    result = [
        (item.from_member_id, item.to_member_id, item.amount_cents) for item in suggestions
    ]
    assert result == [
        ("c", "a", 6000),
        ("d", "b", 3000),
        ("d", "a", 1000),
    ]
    assert len(suggestions) <= len(balances) - 1
