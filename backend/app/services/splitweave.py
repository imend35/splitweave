from datetime import UTC, datetime
from uuid import uuid4

from app.constants import MEMBER_COLORS
from app.domain import (
    ActivityRecord,
    ExpenseRecord,
    GroupRecord,
    MemberRecord,
    SettlementRecord,
)
from app.errors import DomainError, archived_group_error, not_found
from app.repositories.base import GroupRepository
from app.schemas import (
    ExpenseCategory,
    ExpenseWrite,
    GroupCreate,
    GroupPatch,
    MemberCreate,
    MemberPatch,
    SettlementCreate,
)
from app.services.calculations import (
    BalancePosition,
    SettlementSuggestion,
    allocate_shares,
    calculate_balances,
    parse_money_to_cents,
    share_records,
    suggest_settlements,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


class SplitWeaveService:
    def __init__(self, repository: GroupRepository) -> None:
        self.repository = repository

    def list_groups(self) -> list[GroupRecord]:
        return sorted(self.repository.list(), key=lambda group: group.updated_at, reverse=True)

    def get_group(self, group_id: str) -> GroupRecord:
        group = self.repository.get(group_id)
        if group is None:
            raise not_found("group")
        return group

    def create_group(self, payload: GroupCreate) -> GroupRecord:
        normalized_names = [name.casefold() for name in payload.member_names]
        if len(normalized_names) != len(set(normalized_names)):
            raise DomainError(
                "MEMBER_NAME_CONFLICT",
                "Member names must be unique within a group.",
                409,
            )

        timestamp = utc_now()
        group = GroupRecord(
            id=str(uuid4()),
            name=payload.name,
            description=payload.description,
            group_type=payload.group_type.value,
            currency=payload.currency.value,
            is_archived=False,
            created_at=timestamp,
            updated_at=timestamp,
        )
        for name in payload.member_names:
            group.members.append(self._new_member(name, len(group.members), timestamp))
        self._activity(
            group,
            kind="group",
            title="Group created",
            detail=f"{group.name} is ready for shared expenses.",
            timestamp=timestamp,
        )
        return self.repository.save(group)

    def update_group(self, group_id: str, payload: GroupPatch) -> GroupRecord:
        group = self.get_group(group_id)
        fields = payload.model_fields_set
        if group.is_archived and (fields != {"is_archived"} or payload.is_archived is not False):
            raise archived_group_error()

        if payload.currency is not None and payload.currency.value != group.currency:
            if group.expenses or group.settlements:
                raise DomainError(
                    "CURRENCY_LOCKED",
                    "Group currency cannot change after a transaction has been recorded.",
                    409,
                )
            group.currency = payload.currency.value
        if payload.name is not None:
            group.name = payload.name
        if payload.description is not None:
            group.description = payload.description
        if payload.group_type is not None:
            group.group_type = payload.group_type.value
        if payload.is_archived is not None and payload.is_archived != group.is_archived:
            group.is_archived = payload.is_archived
            self._activity(
                group,
                kind="group",
                title="Group archived" if payload.is_archived else "Group restored",
                detail=f"{group.name} is {'read-only' if payload.is_archived else 'active again'}.",
            )
        return self._touch_and_save(group)

    def list_members(self, group_id: str) -> list[MemberRecord]:
        return self.get_group(group_id).members

    def add_member(self, group_id: str, payload: MemberCreate) -> MemberRecord:
        group = self.get_group(group_id)
        self._assert_writable(group)
        self._assert_unique_member_name(group, payload.name)
        member = self._new_member(payload.name, len(group.members), utc_now())
        group.members.append(member)
        self._activity(
            group,
            kind="member",
            title="Member added",
            detail=f"{member.name} joined the group.",
        )
        saved = self._touch_and_save(group)
        return self._member(saved, member.id)

    def update_member(self, group_id: str, member_id: str, payload: MemberPatch) -> MemberRecord:
        group = self.get_group(group_id)
        self._assert_writable(group)
        member = self._member(group, member_id)
        if payload.name is not None and payload.name != member.name:
            self._assert_unique_member_name(group, payload.name, excluded_id=member.id)
            member.name = payload.name
        if payload.is_active is not None and payload.is_active != member.is_active:
            member.is_active = payload.is_active
            self._activity(
                group,
                kind="member",
                title="Member reactivated" if member.is_active else "Member deactivated",
                detail=f"{member.name} is now {'active' if member.is_active else 'inactive'}.",
            )
        saved = self._touch_and_save(group)
        return self._member(saved, member_id)

    def list_expenses(
        self,
        group_id: str,
        *,
        search: str | None = None,
        category: ExpenseCategory | None = None,
        payer_id: str | None = None,
        participant_id: str | None = None,
        from_date=None,
        to_date=None,
        sort: str = "newest",
    ) -> list[ExpenseRecord]:
        expenses = self.get_group(group_id).expenses
        if search:
            needle = search.strip().casefold()
            expenses = [
                item
                for item in expenses
                if needle in item.title.casefold() or needle in item.note.casefold()
            ]
        if category:
            expenses = [item for item in expenses if item.category == category.value]
        if payer_id:
            expenses = [item for item in expenses if item.paid_by_member_id == payer_id]
        if participant_id:
            expenses = [
                item
                for item in expenses
                if any(share.member_id == participant_id for share in item.shares)
            ]
        if from_date:
            expenses = [item for item in expenses if item.expense_date >= from_date]
        if to_date:
            expenses = [item for item in expenses if item.expense_date <= to_date]
        reverse = sort != "oldest"
        return sorted(
            expenses,
            key=lambda item: (item.expense_date, item.created_at, item.id),
            reverse=reverse,
        )

    def get_expense(self, group_id: str, expense_id: str) -> ExpenseRecord:
        group = self.get_group(group_id)
        return self._expense(group, expense_id)

    def create_expense(self, group_id: str, payload: ExpenseWrite) -> ExpenseRecord:
        group = self.get_group(group_id)
        self._assert_writable(group)
        if sum(member.is_active for member in group.members) < 2:
            raise DomainError(
                "INSUFFICIENT_ACTIVE_MEMBERS",
                "At least two active group members are required before adding an expense.",
            )
        expense = self._build_expense(group, payload)
        group.expenses.append(expense)
        self._activity(group, kind="expense", title="Expense added", detail=expense.title)
        saved = self._touch_and_save(group)
        return self._expense(saved, expense.id)

    def update_expense(
        self,
        group_id: str,
        expense_id: str,
        payload: ExpenseWrite,
    ) -> ExpenseRecord:
        group = self.get_group(group_id)
        self._assert_writable(group)
        current = self._expense(group, expense_id)
        replacement = self._build_expense(group, payload, expense_id=expense_id)
        replacement.created_at = current.created_at
        group.expenses[group.expenses.index(current)] = replacement
        self._activity(group, kind="expense", title="Expense updated", detail=replacement.title)
        saved = self._touch_and_save(group)
        return self._expense(saved, expense_id)

    def delete_expense(self, group_id: str, expense_id: str) -> None:
        group = self.get_group(group_id)
        self._assert_writable(group)
        expense = self._expense(group, expense_id)
        group.expenses.remove(expense)
        self._activity(group, kind="expense", title="Expense deleted", detail=expense.title)
        self._touch_and_save(group)

    def balances(self, group_id: str) -> list[BalancePosition]:
        return calculate_balances(self.get_group(group_id))

    def settlement_suggestions(self, group_id: str) -> list[SettlementSuggestion]:
        return suggest_settlements(self.balances(group_id))

    def list_settlements(self, group_id: str) -> list[SettlementRecord]:
        return sorted(
            self.get_group(group_id).settlements,
            key=lambda item: (item.settlement_date, item.created_at, item.id),
            reverse=True,
        )

    def create_settlement(self, group_id: str, payload: SettlementCreate) -> SettlementRecord:
        group = self.get_group(group_id)
        self._assert_writable(group)
        if payload.from_member_id == payload.to_member_id:
            raise DomainError(
                "SAME_SETTLEMENT_MEMBER",
                "Sender and receiver must be different members.",
            )
        sender = self._member(group, payload.from_member_id)
        receiver = self._member(group, payload.to_member_id)
        balances = {item.member_id: item for item in calculate_balances(group)}
        sender_balance = balances[sender.id].net_cents
        receiver_balance = balances[receiver.id].net_cents
        if sender_balance >= 0 or receiver_balance <= 0:
            raise DomainError(
                "INVALID_SETTLEMENT_DIRECTION",
                "The sender must owe money and the receiver must be owed money.",
            )
        amount_cents = parse_money_to_cents(payload.amount)
        if amount_cents > min(-sender_balance, receiver_balance):
            raise DomainError(
                "SETTLEMENT_EXCEEDS_BALANCE",
                "The repayment exceeds the outstanding balance between debtor and creditor.",
            )
        settlement = SettlementRecord(
            id=str(uuid4()),
            group_id=group.id,
            from_member_id=sender.id,
            to_member_id=receiver.id,
            amount_cents=amount_cents,
            settlement_date=payload.settlement_date,
            note=payload.note,
            created_at=utc_now(),
        )
        group.settlements.append(settlement)
        self._activity(
            group,
            kind="settlement",
            title="Repayment recorded",
            detail=f"{sender.name} paid {receiver.name}.",
        )
        saved = self._touch_and_save(group)
        return self._settlement(saved, settlement.id)

    def delete_settlement(self, group_id: str, settlement_id: str) -> None:
        group = self.get_group(group_id)
        self._assert_writable(group)
        settlement = self._settlement(group, settlement_id)
        sender = self._member(group, settlement.from_member_id)
        receiver = self._member(group, settlement.to_member_id)
        group.settlements.remove(settlement)
        self._activity(
            group,
            kind="settlement",
            title="Repayment deleted",
            detail=f"{sender.name} → {receiver.name}",
        )
        self._touch_and_save(group)

    def _build_expense(
        self,
        group: GroupRecord,
        payload: ExpenseWrite,
        *,
        expense_id: str | None = None,
    ) -> ExpenseRecord:
        self._member(group, payload.paid_by_member_id)
        participant_ids = [participant.member_id for participant in payload.participants]
        active_members = {member.id for member in group.members if member.is_active}
        unknown_or_inactive = [
            member_id for member_id in participant_ids if member_id not in active_members
        ]
        if unknown_or_inactive:
            raise DomainError(
                "INVALID_PARTICIPANT",
                "Every participant must be an active member of this group.",
            )
        amount_cents = parse_money_to_cents(payload.amount)
        allocations = allocate_shares(
            amount_cents,
            payload.split_method.value,
            [
                {
                    "member_id": participant.member_id,
                    "input_value": participant.input_value,
                    "position": participant.position,
                }
                for participant in payload.participants
            ],
        )
        timestamp = utc_now()
        return ExpenseRecord(
            id=expense_id or str(uuid4()),
            group_id=group.id,
            title=payload.title,
            amount_cents=amount_cents,
            expense_date=payload.expense_date,
            category=payload.category.value,
            paid_by_member_id=payload.paid_by_member_id,
            split_method=payload.split_method.value,
            shares=share_records(allocations),
            note=payload.note,
            created_at=timestamp,
            updated_at=timestamp,
        )

    @staticmethod
    def _assert_writable(group: GroupRecord) -> None:
        if group.is_archived:
            raise archived_group_error()

    @staticmethod
    def _new_member(name: str, position: int, timestamp: datetime) -> MemberRecord:
        return MemberRecord(
            id=str(uuid4()),
            name=name,
            color=MEMBER_COLORS[position % len(MEMBER_COLORS)],
            is_active=True,
            created_at=timestamp,
        )

    @staticmethod
    def _assert_unique_member_name(
        group: GroupRecord,
        name: str,
        *,
        excluded_id: str | None = None,
    ) -> None:
        if any(
            member.id != excluded_id and member.name.casefold() == name.casefold()
            for member in group.members
        ):
            raise DomainError(
                "MEMBER_NAME_CONFLICT",
                "Member names must be unique within a group.",
                409,
            )

    @staticmethod
    def _member(group: GroupRecord, member_id: str) -> MemberRecord:
        member = next((item for item in group.members if item.id == member_id), None)
        if member is None:
            raise not_found("member")
        return member

    @staticmethod
    def _expense(group: GroupRecord, expense_id: str) -> ExpenseRecord:
        expense = next((item for item in group.expenses if item.id == expense_id), None)
        if expense is None:
            raise not_found("expense")
        return expense

    @staticmethod
    def _settlement(group: GroupRecord, settlement_id: str) -> SettlementRecord:
        settlement = next((item for item in group.settlements if item.id == settlement_id), None)
        if settlement is None:
            raise not_found("settlement")
        return settlement

    @staticmethod
    def _activity(
        group: GroupRecord,
        *,
        kind: str,
        title: str,
        detail: str,
        timestamp: datetime | None = None,
    ) -> None:
        group.activities.insert(
            0,
            ActivityRecord(
                id=str(uuid4()),
                kind=kind,
                title=title,
                detail=detail,
                created_at=timestamp or utc_now(),
            ),
        )

    def _touch_and_save(self, group: GroupRecord) -> GroupRecord:
        group.updated_at = utc_now()
        return self.repository.save(group)
