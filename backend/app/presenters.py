from app.domain import ExpenseRecord, GroupRecord, MemberRecord, SettlementRecord
from app.schemas import (
    ActivityResponse,
    ExpenseResponse,
    ExpenseShareResponse,
    GroupBalancesResponse,
    GroupResponse,
    GroupSummaryResponse,
    MemberBalanceResponse,
    MemberResponse,
    SettlementResponse,
    SettlementSuggestionResponse,
)
from app.services.calculations import (
    BalancePosition,
    SettlementSuggestion,
    calculate_balances,
    money_from_cents,
)


def member_response(member: MemberRecord) -> MemberResponse:
    return MemberResponse(
        id=member.id,
        name=member.name,
        color=member.color,
        is_active=member.is_active,
        created_at=member.created_at,
    )


def expense_response(expense: ExpenseRecord) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        group_id=expense.group_id,
        title=expense.title,
        amount=money_from_cents(expense.amount_cents),
        expense_date=expense.expense_date,
        category=expense.category,
        paid_by_member_id=expense.paid_by_member_id,
        split_method=expense.split_method,
        shares=[
            ExpenseShareResponse(
                member_id=share.member_id,
                input_value=share.input_value,
                allocated_amount=money_from_cents(share.allocated_cents),
                position=share.position,
            )
            for share in sorted(expense.shares, key=lambda item: item.position)
        ],
        note=expense.note,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


def settlement_response(settlement: SettlementRecord) -> SettlementResponse:
    return SettlementResponse(
        id=settlement.id,
        group_id=settlement.group_id,
        from_member_id=settlement.from_member_id,
        to_member_id=settlement.to_member_id,
        amount=money_from_cents(settlement.amount_cents),
        settlement_date=settlement.settlement_date,
        note=settlement.note,
        created_at=settlement.created_at,
    )


def group_response(group: GroupRecord) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        group_type=group.group_type,
        currency=group.currency,
        is_archived=group.is_archived,
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=[member_response(member) for member in group.members],
        expenses=[expense_response(expense) for expense in group.expenses],
        settlements=[settlement_response(item) for item in group.settlements],
        activities=[
            ActivityResponse(
                id=activity.id,
                kind=activity.kind,
                title=activity.title,
                detail=activity.detail,
                created_at=activity.created_at,
            )
            for activity in sorted(group.activities, key=lambda item: item.created_at, reverse=True)
        ],
    )


def group_summary_response(group: GroupRecord) -> GroupSummaryResponse:
    balances = calculate_balances(group)
    return GroupSummaryResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        group_type=group.group_type,
        currency=group.currency,
        is_archived=group.is_archived,
        member_count=len(group.members),
        expense_count=len(group.expenses),
        total_spent=money_from_cents(sum(expense.amount_cents for expense in group.expenses)),
        unsettled=money_from_cents(sum(item.net_cents for item in balances if item.net_cents > 0)),
        member_preview=[member_response(member) for member in group.members[:4]],
        updated_at=group.updated_at,
    )


def balance_response(position: BalancePosition) -> MemberBalanceResponse:
    return MemberBalanceResponse(
        member_id=position.member_id,
        member_name=position.member_name,
        member_color=position.member_color,
        is_active=position.is_active,
        position=position.position,
        paid=money_from_cents(position.paid_cents),
        owed=money_from_cents(position.owed_cents),
        settlements_sent=money_from_cents(position.settlements_sent_cents),
        settlements_received=money_from_cents(position.settlements_received_cents),
        net=money_from_cents(position.net_cents),
        net_minor_units=str(position.net_cents),
    )


def balances_response(group: GroupRecord) -> GroupBalancesResponse:
    balances = calculate_balances(group)
    return GroupBalancesResponse(
        total_spent=money_from_cents(sum(expense.amount_cents for expense in group.expenses)),
        unsettled=money_from_cents(sum(item.net_cents for item in balances if item.net_cents > 0)),
        balances=[balance_response(item) for item in balances],
    )


def suggestion_response(item: SettlementSuggestion) -> SettlementSuggestionResponse:
    return SettlementSuggestionResponse(
        from_member_id=item.from_member_id,
        from_member_name=item.from_member_name,
        to_member_id=item.to_member_id,
        to_member_name=item.to_member_name,
        amount=money_from_cents(item.amount_cents),
    )
