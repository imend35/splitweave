from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(slots=True)
class MemberRecord:
    id: str
    name: str
    color: str
    is_active: bool
    created_at: datetime


@dataclass(slots=True)
class ExpenseShareRecord:
    member_id: str
    input_value: str
    allocated_cents: int
    position: int


@dataclass(slots=True)
class ExpenseRecord:
    id: str
    group_id: str
    title: str
    amount_cents: int
    expense_date: date
    category: str
    paid_by_member_id: str
    split_method: str
    shares: list[ExpenseShareRecord]
    note: str
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class SettlementRecord:
    id: str
    group_id: str
    from_member_id: str
    to_member_id: str
    amount_cents: int
    settlement_date: date
    note: str
    created_at: datetime


@dataclass(slots=True)
class ActivityRecord:
    id: str
    kind: str
    title: str
    detail: str
    created_at: datetime


@dataclass(slots=True)
class GroupRecord:
    id: str
    name: str
    description: str
    group_type: str
    currency: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    members: list[MemberRecord] = field(default_factory=list)
    expenses: list[ExpenseRecord] = field(default_factory=list)
    settlements: list[SettlementRecord] = field(default_factory=list)
    activities: list[ActivityRecord] = field(default_factory=list)
