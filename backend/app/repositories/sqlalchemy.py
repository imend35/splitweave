from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Engine, create_engine, delete, event, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload, sessionmaker
from sqlalchemy.pool import StaticPool

from app.domain import (
    ActivityRecord,
    ExpenseRecord,
    ExpenseShareRecord,
    GroupRecord,
    MemberRecord,
    SettlementRecord,
)
from app.errors import DomainError
from app.repositories.base import GroupRepository
from app.repositories.models import (
    ActivityModel,
    Base,
    ExpenseModel,
    ExpenseShareModel,
    GroupModel,
    MemberModel,
    SettlementModel,
)

CENT = Decimal("0.01")


def _money_from_cents(cents: int) -> Decimal:
    return (Decimal(cents) / Decimal(100)).quantize(CENT)


def _cents_from_money(amount: Decimal) -> int:
    return int(amount.quantize(CENT) * 100)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _enable_sqlite_foreign_keys(dbapi_connection, _) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class SQLAlchemyRepository(GroupRepository):
    """SQLAlchemy 2.x repository that stores and restores complete group aggregates."""

    def __init__(self, database_url: str, *, create_schema: bool = True) -> None:
        url = make_url(database_url)
        engine_options: dict = {"pool_pre_ping": True}
        if url.get_backend_name() == "sqlite":
            engine_options["connect_args"] = {"check_same_thread": False}
            if url.database in {None, "", ":memory:"}:
                engine_options["poolclass"] = StaticPool

        self.engine: Engine = create_engine(database_url, **engine_options)
        if url.get_backend_name() == "sqlite":
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self._sessions = sessionmaker(
            bind=self.engine,
            class_=Session,
            expire_on_commit=False,
        )
        if create_schema:
            Base.metadata.create_all(self.engine)

    def list(self) -> list[GroupRecord]:
        with self._sessions() as session:
            query = self._group_query().order_by(GroupModel.updated_at.desc())
            models = session.scalars(query).all()
            return [self._to_domain(model) for model in models]

    def get(self, group_id: str) -> GroupRecord | None:
        with self._sessions() as session:
            model = session.scalar(self._group_query().where(GroupModel.id == group_id))
            return self._to_domain(model) if model is not None else None

    def save(self, group: GroupRecord) -> GroupRecord:
        try:
            with self._sessions.begin() as session:
                session.merge(self._to_model(group))
        except IntegrityError as error:
            raise DomainError(
                "DATABASE_CONFLICT",
                "The change conflicts with data already stored for this group.",
                409,
            ) from error

        saved = self.get(group.id)
        if saved is None:
            raise RuntimeError("The saved group could not be reloaded.")
        return saved

    def clear(self) -> None:
        with self._sessions.begin() as session:
            session.execute(delete(GroupModel))

    def close(self) -> None:
        self.engine.dispose()

    @staticmethod
    def _group_query():
        return select(GroupModel).options(
            selectinload(GroupModel.members),
            selectinload(GroupModel.expenses).selectinload(ExpenseModel.shares),
            selectinload(GroupModel.settlements),
            selectinload(GroupModel.activities),
        )

    @staticmethod
    def _to_model(group: GroupRecord) -> GroupModel:
        members = [
            MemberModel(
                id=member.id,
                group_id=group.id,
                name=member.name,
                name_key=member.name.casefold(),
                color=member.color,
                is_active=member.is_active,
                created_at=member.created_at,
            )
            for member in group.members
        ]
        members_by_id = {member.id: member for member in members}
        expenses = [
            ExpenseModel(
                id=expense.id,
                group_id=group.id,
                title=expense.title,
                amount=_money_from_cents(expense.amount_cents),
                expense_date=expense.expense_date,
                category=expense.category,
                paid_by_member_id=expense.paid_by_member_id,
                payer=members_by_id[expense.paid_by_member_id],
                split_method=expense.split_method,
                note=expense.note,
                created_at=expense.created_at,
                updated_at=expense.updated_at,
                shares=[
                    ExpenseShareModel(
                        expense_id=expense.id,
                        member_id=share.member_id,
                        member=members_by_id[share.member_id],
                        input_value=share.input_value,
                        allocated_amount=_money_from_cents(share.allocated_cents),
                        position=share.position,
                    )
                    for share in expense.shares
                ],
            )
            for expense in group.expenses
        ]
        settlements = [
            SettlementModel(
                id=settlement.id,
                group_id=group.id,
                from_member_id=settlement.from_member_id,
                sender=members_by_id[settlement.from_member_id],
                to_member_id=settlement.to_member_id,
                receiver=members_by_id[settlement.to_member_id],
                amount=_money_from_cents(settlement.amount_cents),
                settlement_date=settlement.settlement_date,
                note=settlement.note,
                created_at=settlement.created_at,
            )
            for settlement in group.settlements
        ]
        return GroupModel(
            id=group.id,
            name=group.name,
            description=group.description,
            group_type=group.group_type,
            currency=group.currency,
            is_archived=group.is_archived,
            created_at=group.created_at,
            updated_at=group.updated_at,
            members=members,
            expenses=expenses,
            settlements=settlements,
            activities=[
                ActivityModel(
                    id=activity.id,
                    group_id=group.id,
                    kind=activity.kind,
                    title=activity.title,
                    detail=activity.detail,
                    created_at=activity.created_at,
                )
                for activity in group.activities
            ],
        )

    @staticmethod
    def _to_domain(group: GroupModel) -> GroupRecord:
        return GroupRecord(
            id=group.id,
            name=group.name,
            description=group.description,
            group_type=group.group_type,
            currency=group.currency,
            is_archived=group.is_archived,
            created_at=_as_utc(group.created_at),
            updated_at=_as_utc(group.updated_at),
            members=[
                MemberRecord(
                    id=member.id,
                    name=member.name,
                    color=member.color,
                    is_active=member.is_active,
                    created_at=_as_utc(member.created_at),
                )
                for member in group.members
            ],
            expenses=[
                ExpenseRecord(
                    id=expense.id,
                    group_id=expense.group_id,
                    title=expense.title,
                    amount_cents=_cents_from_money(expense.amount),
                    expense_date=expense.expense_date,
                    category=expense.category,
                    paid_by_member_id=expense.paid_by_member_id,
                    split_method=expense.split_method,
                    shares=[
                        ExpenseShareRecord(
                            member_id=share.member_id,
                            input_value=share.input_value,
                            allocated_cents=_cents_from_money(share.allocated_amount),
                            position=share.position,
                        )
                        for share in expense.shares
                    ],
                    note=expense.note,
                    created_at=_as_utc(expense.created_at),
                    updated_at=_as_utc(expense.updated_at),
                )
                for expense in group.expenses
            ],
            settlements=[
                SettlementRecord(
                    id=settlement.id,
                    group_id=settlement.group_id,
                    from_member_id=settlement.from_member_id,
                    to_member_id=settlement.to_member_id,
                    amount_cents=_cents_from_money(settlement.amount),
                    settlement_date=settlement.settlement_date,
                    note=settlement.note,
                    created_at=_as_utc(settlement.created_at),
                )
                for settlement in group.settlements
            ],
            activities=[
                ActivityRecord(
                    id=activity.id,
                    kind=activity.kind,
                    title=activity.title,
                    detail=activity.detail,
                    created_at=_as_utc(activity.created_at),
                )
                for activity in group.activities
            ],
        )
