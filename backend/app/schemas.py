from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.errors import DomainError
from app.services.calculations import money_from_cents, parse_money_to_cents


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
    )


class GroupType(StrEnum):
    TRIP = "trip"
    HOUSEHOLD = "household"
    FRIENDS = "friends"
    WORK = "work"
    OTHER = "other"


class Currency(StrEnum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"


class ExpenseCategory(StrEnum):
    FOOD_DRINK = "food_drink"
    GROCERIES = "groceries"
    TRANSPORT = "transport"
    ACCOMMODATION = "accommodation"
    UTILITIES = "utilities"
    ENTERTAINMENT = "entertainment"
    HEALTH = "health"
    SHOPPING = "shopping"
    OTHER = "other"


class SplitMethod(StrEnum):
    EQUAL = "equal"
    EXACT = "exact"
    PERCENTAGE = "percentage"
    SHARES = "shares"


Name = Annotated[str, Field(min_length=2, max_length=80)]
Description = Annotated[str, Field(max_length=300)]
MemberName = Annotated[str, Field(min_length=1, max_length=60)]
ExpenseTitle = Annotated[str, Field(min_length=2, max_length=120)]
ExpenseNote = Annotated[str, Field(max_length=500)]
SettlementNote = Annotated[str, Field(max_length=300)]


def _strip(value: Any) -> Any:
    return value.strip() if isinstance(value, str) else value


def _validated_money(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Money must be sent as a two-decimal string.")
    try:
        return money_from_cents(parse_money_to_cents(value))
    except DomainError as error:
        raise ValueError(error.message) from error


class GroupCreate(ApiModel):
    name: Name
    description: Description = ""
    group_type: GroupType
    currency: Currency
    member_names: list[MemberName] = Field(default_factory=list, max_length=100)

    _strip_name = field_validator("name", mode="before")(_strip)
    _strip_description = field_validator("description", mode="before")(_strip)

    @field_validator("member_names", mode="before")
    @classmethod
    def strip_member_names(cls, values: Any) -> Any:
        if isinstance(values, list):
            return [_strip(value) for value in values]
        return values


class GroupPatch(ApiModel):
    name: Name | None = None
    description: Description | None = None
    group_type: GroupType | None = None
    currency: Currency | None = None
    is_archived: bool | None = None

    _strip_name = field_validator("name", mode="before")(_strip)
    _strip_description = field_validator("description", mode="before")(_strip)

    @model_validator(mode="after")
    def at_least_one_change(self) -> "GroupPatch":
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update.")
        return self


class MemberCreate(ApiModel):
    name: MemberName

    _strip_name = field_validator("name", mode="before")(_strip)


class MemberPatch(ApiModel):
    name: MemberName | None = None
    is_active: bool | None = None

    _strip_name = field_validator("name", mode="before")(_strip)

    @model_validator(mode="after")
    def at_least_one_change(self) -> "MemberPatch":
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update.")
        return self


class ExpenseParticipantInput(ApiModel):
    member_id: str = Field(min_length=1)
    input_value: str = Field(default="1", min_length=1, max_length=30)
    position: int = Field(ge=0, le=999)

    _strip_member_id = field_validator("member_id", mode="before")(_strip)
    _strip_input_value = field_validator("input_value", mode="before")(_strip)


class ExpenseWrite(ApiModel):
    title: ExpenseTitle
    amount: str
    expense_date: date
    category: ExpenseCategory
    paid_by_member_id: str = Field(min_length=1)
    split_method: SplitMethod
    participants: list[ExpenseParticipantInput] = Field(min_length=1, max_length=100)
    note: ExpenseNote = ""

    _strip_title = field_validator("title", mode="before")(_strip)
    _strip_payer = field_validator("paid_by_member_id", mode="before")(_strip)
    _strip_note = field_validator("note", mode="before")(_strip)
    _validate_amount = field_validator("amount", mode="before")(_validated_money)

    @field_validator("expense_date")
    @classmethod
    def expense_date_not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Expense date cannot be in the future.")
        return value


class SettlementCreate(ApiModel):
    from_member_id: str = Field(min_length=1)
    to_member_id: str = Field(min_length=1)
    amount: str
    settlement_date: date
    note: SettlementNote = ""

    _strip_from_member = field_validator("from_member_id", mode="before")(_strip)
    _strip_to_member = field_validator("to_member_id", mode="before")(_strip)
    _strip_note = field_validator("note", mode="before")(_strip)
    _validate_amount = field_validator("amount", mode="before")(_validated_money)

    @field_validator("settlement_date")
    @classmethod
    def settlement_date_not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Settlement date cannot be in the future.")
        return value


class MemberResponse(ApiModel):
    id: str
    name: str
    color: str
    is_active: bool
    created_at: datetime


class ExpenseShareResponse(ApiModel):
    member_id: str
    input_value: str
    allocated_amount: str
    position: int


class ExpenseResponse(ApiModel):
    id: str
    group_id: str
    title: str
    amount: str
    expense_date: date
    category: ExpenseCategory
    paid_by_member_id: str
    split_method: SplitMethod
    shares: list[ExpenseShareResponse]
    note: str
    created_at: datetime
    updated_at: datetime


class SettlementResponse(ApiModel):
    id: str
    group_id: str
    from_member_id: str
    to_member_id: str
    amount: str
    settlement_date: date
    note: str
    created_at: datetime


class ActivityResponse(ApiModel):
    id: str
    kind: str
    title: str
    detail: str
    created_at: datetime


class GroupResponse(ApiModel):
    id: str
    name: str
    description: str
    group_type: GroupType
    currency: Currency
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    members: list[MemberResponse]
    expenses: list[ExpenseResponse]
    settlements: list[SettlementResponse]
    activities: list[ActivityResponse]


class GroupSummaryResponse(ApiModel):
    id: str
    name: str
    description: str
    group_type: GroupType
    currency: Currency
    is_archived: bool
    member_count: int
    expense_count: int
    total_spent: str
    unsettled: str
    member_preview: list[MemberResponse]
    updated_at: datetime


class MemberBalanceResponse(ApiModel):
    member_id: str
    member_name: str
    member_color: str
    is_active: bool
    position: int
    paid: str
    owed: str
    settlements_sent: str
    settlements_received: str
    net: str
    net_minor_units: str


class GroupBalancesResponse(ApiModel):
    total_spent: str
    unsettled: str
    balances: list[MemberBalanceResponse]


class SettlementSuggestionResponse(ApiModel):
    from_member_id: str
    from_member_name: str
    to_member_id: str
    to_member_name: str
    amount: str


class HealthResponse(ApiModel):
    status: str


class ErrorBody(ApiModel):
    code: str
    message: str
    details: list[dict[str, Any]]


class ErrorEnvelope(ApiModel):
    error: ErrorBody
