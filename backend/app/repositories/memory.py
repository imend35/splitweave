from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from threading import RLock
from uuid import uuid4

from app.constants import MEMBER_COLORS
from app.domain import (
    ActivityRecord,
    ExpenseRecord,
    GroupRecord,
    MemberRecord,
    SettlementRecord,
)
from app.repositories.base import GroupRepository
from app.services.calculations import allocate_shares, share_records


def utc_now() -> datetime:
    return datetime.now(UTC)


class InMemoryRepository(GroupRepository):
    """Thread-safe process-local store used during the mock-backend phase."""

    def __init__(self, *, seed: bool = True) -> None:
        self._groups: dict[str, GroupRecord] = {}
        self._lock = RLock()
        if seed:
            self._seed_demo_group()

    def list(self) -> list[GroupRecord]:
        with self._lock:
            return deepcopy(list(self._groups.values()))

    def get(self, group_id: str) -> GroupRecord | None:
        with self._lock:
            group = self._groups.get(group_id)
            return deepcopy(group) if group is not None else None

    def save(self, group: GroupRecord) -> GroupRecord:
        with self._lock:
            self._groups[group.id] = deepcopy(group)
            return deepcopy(group)

    def clear(self) -> None:
        with self._lock:
            self._groups.clear()

    def _seed_demo_group(self) -> None:
        now = utc_now()
        group_id = str(uuid4())
        members = [
            MemberRecord(
                str(uuid4()),
                name,
                MEMBER_COLORS[index],
                True,
                now + timedelta(seconds=index),
            )
            for index, name in enumerate(["Ada", "Deniz", "Mira", "Can"])
        ]
        by_name = {member.name: member for member in members}

        def expense(
            *,
            title: str,
            amount_cents: int,
            category: str,
            payer: str,
            method: str,
            participant_values: list[tuple[str, str]],
            days_ago: int,
        ) -> ExpenseRecord:
            participants = [
                {
                    "member_id": by_name[name].id,
                    "input_value": value,
                    "position": position,
                }
                for position, (name, value) in enumerate(participant_values)
            ]
            allocations = allocate_shares(amount_cents, method, participants)
            timestamp = now - timedelta(days=days_ago)
            return ExpenseRecord(
                id=str(uuid4()),
                group_id=group_id,
                title=title,
                amount_cents=amount_cents,
                expense_date=date.today() - timedelta(days=days_ago),
                category=category,
                paid_by_member_id=by_name[payer].id,
                split_method=method,
                shares=share_records(allocations),
                note="Seeded demo transaction",
                created_at=timestamp,
                updated_at=timestamp,
            )

        expenses = [
            expense(
                title="Seaside accommodation",
                amount_cents=120_000,
                category="accommodation",
                payer="Ada",
                method="equal",
                participant_values=[("Ada", "1"), ("Deniz", "1"), ("Mira", "1"), ("Can", "1")],
                days_ago=4,
            ),
            expense(
                title="Dinner by the marina",
                amount_cents=64_000,
                category="food_drink",
                payer="Deniz",
                method="percentage",
                participant_values=[
                    ("Ada", "40"),
                    ("Deniz", "20"),
                    ("Mira", "20"),
                    ("Can", "20"),
                ],
                days_ago=3,
            ),
            expense(
                title="Airport transfer",
                amount_cents=27_550,
                category="transport",
                payer="Mira",
                method="exact",
                participant_values=[("Ada", "100.00"), ("Deniz", "100.00"), ("Can", "75.50")],
                days_ago=2,
            ),
        ]
        settlement = SettlementRecord(
            id=str(uuid4()),
            group_id=group_id,
            from_member_id=by_name["Can"].id,
            to_member_id=by_name["Ada"].id,
            amount_cents=10_000,
            settlement_date=date.today() - timedelta(days=1),
            note="Partial repayment",
            created_at=now - timedelta(days=1),
        )
        activities = [
            ActivityRecord(
                id=str(uuid4()),
                kind="group",
                title="Group created",
                detail="Aegean Weekend is ready for shared expenses.",
                created_at=now - timedelta(days=5),
            ),
            *[
                ActivityRecord(
                    id=str(uuid4()),
                    kind="expense",
                    title="Expense added",
                    detail=item.title,
                    created_at=item.created_at,
                )
                for item in expenses
            ],
            ActivityRecord(
                id=str(uuid4()),
                kind="settlement",
                title="Repayment recorded",
                detail="Can paid Ada 100.00 TRY.",
                created_at=settlement.created_at,
            ),
        ]
        group = GroupRecord(
            id=group_id,
            name="Aegean Weekend",
            description="Four friends sharing the costs of a long weekend on the Aegean coast.",
            group_type="trip",
            currency="TRY",
            is_archived=False,
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(days=1),
            members=members,
            expenses=expenses,
            settlements=[settlement],
            activities=activities,
        )
        self.save(group)
