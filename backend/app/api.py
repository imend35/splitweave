from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.presenters import (
    balances_response,
    expense_response,
    group_response,
    group_summary_response,
    member_response,
    settlement_response,
    suggestion_response,
)
from app.schemas import (
    ErrorEnvelope,
    ExpenseCategory,
    ExpenseResponse,
    ExpenseWrite,
    GroupBalancesResponse,
    GroupCreate,
    GroupPatch,
    GroupResponse,
    GroupSummaryResponse,
    HealthResponse,
    MemberCreate,
    MemberPatch,
    MemberResponse,
    SettlementCreate,
    SettlementResponse,
    SettlementSuggestionResponse,
)
from app.services.splitweave import SplitWeaveService

router = APIRouter()

ERROR_RESPONSES = {
    400: {"model": ErrorEnvelope, "description": "Domain rule violation"},
    404: {"model": ErrorEnvelope, "description": "Resource not found"},
    409: {"model": ErrorEnvelope, "description": "Conflicting resource state"},
    422: {"model": ErrorEnvelope, "description": "Request validation failed"},
}


def get_service(request: Request) -> SplitWeaveService:
    return request.app.state.splitweave_service


Service = Annotated[SplitWeaveService, Depends(get_service)]


@router.get("/health", response_model=HealthResponse, tags=["System"])
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/groups",
    response_model=list[GroupSummaryResponse],
    responses=ERROR_RESPONSES,
    tags=["Groups"],
)
def list_groups(service: Service) -> list[GroupSummaryResponse]:
    return [group_summary_response(group) for group in service.list_groups()]


@router.post(
    "/groups",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
    tags=["Groups"],
)
def create_group(payload: GroupCreate, service: Service) -> GroupResponse:
    return group_response(service.create_group(payload))


@router.get(
    "/groups/{group_id}",
    response_model=GroupResponse,
    responses=ERROR_RESPONSES,
    tags=["Groups"],
)
def get_group(group_id: str, service: Service) -> GroupResponse:
    return group_response(service.get_group(group_id))


@router.patch(
    "/groups/{group_id}",
    response_model=GroupResponse,
    responses=ERROR_RESPONSES,
    tags=["Groups"],
)
def update_group(group_id: str, payload: GroupPatch, service: Service) -> GroupResponse:
    return group_response(service.update_group(group_id, payload))


@router.get(
    "/groups/{group_id}/members",
    response_model=list[MemberResponse],
    responses=ERROR_RESPONSES,
    tags=["Members"],
)
def list_members(group_id: str, service: Service) -> list[MemberResponse]:
    return [member_response(member) for member in service.list_members(group_id)]


@router.post(
    "/groups/{group_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
    tags=["Members"],
)
def add_member(group_id: str, payload: MemberCreate, service: Service) -> MemberResponse:
    return member_response(service.add_member(group_id, payload))


@router.patch(
    "/groups/{group_id}/members/{member_id}",
    response_model=MemberResponse,
    responses=ERROR_RESPONSES,
    tags=["Members"],
)
def update_member(
    group_id: str,
    member_id: str,
    payload: MemberPatch,
    service: Service,
) -> MemberResponse:
    return member_response(service.update_member(group_id, member_id, payload))


@router.get(
    "/groups/{group_id}/expenses",
    response_model=list[ExpenseResponse],
    responses=ERROR_RESPONSES,
    tags=["Expenses"],
)
def list_expenses(
    group_id: str,
    service: Service,
    search: Annotated[str | None, Query(max_length=120)] = None,
    category: ExpenseCategory | None = None,
    payer_id: Annotated[str | None, Query(alias="payerId")] = None,
    participant_id: Annotated[str | None, Query(alias="participantId")] = None,
    from_date: Annotated[date | None, Query(alias="fromDate")] = None,
    to_date: Annotated[date | None, Query(alias="toDate")] = None,
    sort: Literal["newest", "oldest"] = "newest",
) -> list[ExpenseResponse]:
    return [
        expense_response(expense)
        for expense in service.list_expenses(
            group_id,
            search=search,
            category=category,
            payer_id=payer_id,
            participant_id=participant_id,
            from_date=from_date,
            to_date=to_date,
            sort=sort,
        )
    ]


@router.post(
    "/groups/{group_id}/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
    tags=["Expenses"],
)
def create_expense(group_id: str, payload: ExpenseWrite, service: Service) -> ExpenseResponse:
    return expense_response(service.create_expense(group_id, payload))


@router.get(
    "/groups/{group_id}/expenses/{expense_id}",
    response_model=ExpenseResponse,
    responses=ERROR_RESPONSES,
    tags=["Expenses"],
)
def get_expense(group_id: str, expense_id: str, service: Service) -> ExpenseResponse:
    return expense_response(service.get_expense(group_id, expense_id))


@router.put(
    "/groups/{group_id}/expenses/{expense_id}",
    response_model=ExpenseResponse,
    responses=ERROR_RESPONSES,
    tags=["Expenses"],
)
def update_expense(
    group_id: str,
    expense_id: str,
    payload: ExpenseWrite,
    service: Service,
) -> ExpenseResponse:
    return expense_response(service.update_expense(group_id, expense_id, payload))


@router.delete(
    "/groups/{group_id}/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=ERROR_RESPONSES,
    tags=["Expenses"],
)
def delete_expense(group_id: str, expense_id: str, service: Service) -> Response:
    service.delete_expense(group_id, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/groups/{group_id}/balances",
    response_model=GroupBalancesResponse,
    responses=ERROR_RESPONSES,
    tags=["Balances"],
)
def get_balances(group_id: str, service: Service) -> GroupBalancesResponse:
    return balances_response(service.get_group(group_id))


@router.get(
    "/groups/{group_id}/settlement-suggestions",
    response_model=list[SettlementSuggestionResponse],
    responses=ERROR_RESPONSES,
    tags=["Settlements"],
)
def get_settlement_suggestions(
    group_id: str,
    service: Service,
) -> list[SettlementSuggestionResponse]:
    return [suggestion_response(item) for item in service.settlement_suggestions(group_id)]


@router.get(
    "/groups/{group_id}/settlements",
    response_model=list[SettlementResponse],
    responses=ERROR_RESPONSES,
    tags=["Settlements"],
)
def list_settlements(group_id: str, service: Service) -> list[SettlementResponse]:
    return [settlement_response(item) for item in service.list_settlements(group_id)]


@router.post(
    "/groups/{group_id}/settlements",
    response_model=SettlementResponse,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
    tags=["Settlements"],
)
def create_settlement(
    group_id: str,
    payload: SettlementCreate,
    service: Service,
) -> SettlementResponse:
    return settlement_response(service.create_settlement(group_id, payload))


@router.delete(
    "/groups/{group_id}/settlements/{settlement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=ERROR_RESPONSES,
    tags=["Settlements"],
)
def delete_settlement(group_id: str, settlement_id: str, service: Service) -> Response:
    service.delete_settlement(group_id, settlement_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
