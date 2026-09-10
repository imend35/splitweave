import re
from collections.abc import Mapping
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from app.domain import ExpenseShareRecord, GroupRecord
from app.errors import DomainError

MONEY_PATTERN = re.compile(r"^\d+(?:\.\d{1,2})?$")
PERCENTAGE_PATTERN = re.compile(r"^\d+(?:\.\d{1,2})?$")
MAX_MONEY_CENTS = 999_999_999_999


@dataclass(slots=True)
class Allocation:
    member_id: str
    input_value: str
    allocated_cents: int
    position: int


@dataclass(slots=True)
class BalancePosition:
    member_id: str
    member_name: str
    member_color: str
    is_active: bool
    position: int
    paid_cents: int
    owed_cents: int
    settlements_sent_cents: int
    settlements_received_cents: int
    net_cents: int


@dataclass(slots=True)
class SettlementSuggestion:
    from_member_id: str
    from_member_name: str
    to_member_id: str
    to_member_name: str
    amount_cents: int


def parse_money_to_cents(raw_value: str, *, allow_zero: bool = False) -> int:
    value = raw_value.strip()
    if not MONEY_PATTERN.fullmatch(value):
        raise DomainError(
            "INVALID_MONEY",
            "Enter a valid amount with no more than two decimal places.",
        )
    whole, _, fraction = value.partition(".")
    cents = int(whole) * 100 + int(fraction.ljust(2, "0") or "0")
    if cents > MAX_MONEY_CENTS:
        raise DomainError("AMOUNT_TOO_LARGE", "The amount exceeds the supported maximum.")
    if cents < 0 or (cents == 0 and not allow_zero):
        raise DomainError("AMOUNT_NOT_POSITIVE", "The amount must be greater than zero.")
    return cents


def money_from_cents(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    absolute = abs(cents)
    return f"{sign}{absolute // 100}.{absolute % 100:02d}"


def _percentage_to_basis_points(raw_value: str) -> int:
    value = raw_value.strip()
    if not PERCENTAGE_PATTERN.fullmatch(value):
        raise DomainError(
            "INVALID_PERCENTAGE",
            "Percentages may contain no more than two decimal places.",
        )
    whole, _, fraction = value.partition(".")
    return int(whole) * 100 + int(fraction.ljust(2, "0") or "0")


def _allocate_by_weights(
    total_cents: int,
    participants: list[dict[str, Any]],
    weights: list[int],
) -> list[Allocation]:
    total_weight = sum(weights)
    if total_weight <= 0:
        raise DomainError("INVALID_SPLIT", "The split values must total more than zero.")

    rows: list[dict[str, Any]] = []
    for participant, weight in zip(participants, weights, strict=True):
        raw = Fraction(total_cents * weight, total_weight)
        floor = raw.numerator // raw.denominator
        rows.append(
            {
                **participant,
                "allocated_cents": floor,
                "remainder": raw - floor,
            }
        )

    remaining = total_cents - sum(row["allocated_cents"] for row in rows)
    remainder_order = sorted(rows, key=lambda row: (-row["remainder"], row["position"]))
    for index in range(remaining):
        remainder_order[index]["allocated_cents"] += 1

    return [
        Allocation(
            member_id=row["member_id"],
            input_value=row["input_value"],
            allocated_cents=row["allocated_cents"],
            position=row["position"],
        )
        for row in sorted(rows, key=lambda row: row["position"])
    ]


def allocate_shares(
    total_cents: int,
    method: str,
    raw_participants: list[Mapping[str, Any]],
) -> list[Allocation]:
    if total_cents <= 0 or total_cents > MAX_MONEY_CENTS:
        raise DomainError("INVALID_EXPENSE_AMOUNT", "Expense amount must be greater than zero.")
    if not raw_participants:
        raise DomainError("PARTICIPANTS_REQUIRED", "Select at least one participant.")

    participants = [
        {
            "member_id": str(item["member_id"]),
            "input_value": str(item.get("input_value", "1")).strip(),
            "position": int(item["position"]),
        }
        for item in raw_participants
    ]
    member_ids = [item["member_id"] for item in participants]
    if len(member_ids) != len(set(member_ids)):
        raise DomainError("DUPLICATE_PARTICIPANT", "A participant can appear only once.")

    positions = sorted(item["position"] for item in participants)
    if positions != list(range(len(participants))):
        raise DomainError(
            "INVALID_PARTICIPANT_ORDER",
            "Participant positions must be unique and start at zero.",
        )

    participants.sort(key=lambda item: item["position"])
    if method == "exact":
        allocations = [
            Allocation(
                member_id=item["member_id"],
                input_value=item["input_value"],
                allocated_cents=parse_money_to_cents(item["input_value"], allow_zero=True),
                position=item["position"],
            )
            for item in participants
        ]
        if sum(item.allocated_cents for item in allocations) != total_cents:
            raise DomainError(
                "SPLIT_TOTAL_MISMATCH",
                "The exact amounts must equal the expense total.",
            )
        return allocations

    if method == "equal":
        weights = [1] * len(participants)
        for item in participants:
            item["input_value"] = "1"
    elif method == "percentage":
        weights = [_percentage_to_basis_points(item["input_value"]) for item in participants]
        if any(weight <= 0 for weight in weights):
            raise DomainError(
                "INVALID_PERCENTAGE",
                "Each participant percentage must be greater than zero.",
            )
        if sum(weights) != 10_000:
            raise DomainError(
                "PERCENTAGE_TOTAL_MISMATCH",
                "Participant percentages must equal 100.00%.",
            )
    elif method == "shares":
        if any(not item["input_value"].isdigit() for item in participants):
            raise DomainError(
                "INVALID_SHARE_WEIGHT",
                "Weighted shares must be positive whole numbers.",
            )
        weights = [int(item["input_value"]) for item in participants]
        if any(weight <= 0 for weight in weights):
            raise DomainError(
                "INVALID_SHARE_WEIGHT",
                "Weighted shares must be positive whole numbers.",
            )
    else:
        raise DomainError("INVALID_SPLIT_METHOD", "The split method is not supported.")

    return _allocate_by_weights(total_cents, participants, weights)


def calculate_balances(group: GroupRecord) -> list[BalancePosition]:
    positions = [
        BalancePosition(
            member_id=member.id,
            member_name=member.name,
            member_color=member.color,
            is_active=member.is_active,
            position=position,
            paid_cents=0,
            owed_cents=0,
            settlements_sent_cents=0,
            settlements_received_cents=0,
            net_cents=0,
        )
        for position, member in enumerate(group.members)
    ]
    by_id = {position.member_id: position for position in positions}

    for expense in group.expenses:
        by_id[expense.paid_by_member_id].paid_cents += expense.amount_cents
        for share in expense.shares:
            by_id[share.member_id].owed_cents += share.allocated_cents

    for settlement in group.settlements:
        by_id[settlement.from_member_id].settlements_sent_cents += settlement.amount_cents
        by_id[settlement.to_member_id].settlements_received_cents += settlement.amount_cents

    for position in positions:
        position.net_cents = (
            position.paid_cents
            - position.owed_cents
            + position.settlements_sent_cents
            - position.settlements_received_cents
        )

    if sum(position.net_cents for position in positions) != 0:
        raise RuntimeError("Balance invariant violated: member net balances must sum to zero.")
    return positions


def suggest_settlements(balances: list[BalancePosition]) -> list[SettlementSuggestion]:
    creditors = [
        {"position": item, "remaining": item.net_cents}
        for item in balances
        if item.net_cents > 0
    ]
    debtors = [
        {"position": item, "remaining": -item.net_cents}
        for item in balances
        if item.net_cents < 0
    ]
    suggestions: list[SettlementSuggestion] = []
    while debtors and creditors:
        debtors.sort(key=lambda row: (-row["remaining"], row["position"].position))
        creditors.sort(key=lambda row: (-row["remaining"], row["position"].position))
        debtor = debtors[0]
        creditor = creditors[0]
        amount = min(debtor["remaining"], creditor["remaining"])
        debtor_position = debtor["position"]
        creditor_position = creditor["position"]
        suggestions.append(
            SettlementSuggestion(
                from_member_id=debtor_position.member_id,
                from_member_name=debtor_position.member_name,
                to_member_id=creditor_position.member_id,
                to_member_name=creditor_position.member_name,
                amount_cents=amount,
            )
        )
        debtor["remaining"] -= amount
        creditor["remaining"] -= amount
        if debtor["remaining"] == 0:
            debtors.pop(0)
        if creditor["remaining"] == 0:
            creditors.pop(0)

    if any(row["remaining"] for row in debtors) or any(row["remaining"] for row in creditors):
        raise RuntimeError("Settlement suggestions did not reconcile to zero.")
    return suggestions


def share_records(allocations: list[Allocation]) -> list[ExpenseShareRecord]:
    return [
        ExpenseShareRecord(
            member_id=item.member_id,
            input_value=item.input_value,
            allocated_cents=item.allocated_cents,
            position=item.position,
        )
        for item in allocations
    ]
