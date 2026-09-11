from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class GroupModel(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    group_type: Mapped[str] = mapped_column(String(20), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    members: Mapped[list["MemberModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="MemberModel.created_at",
        lazy="selectin",
    )
    expenses: Mapped[list["ExpenseModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ExpenseModel.created_at",
        lazy="selectin",
    )
    settlements: Mapped[list["SettlementModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="SettlementModel.created_at",
        lazy="selectin",
    )
    activities: Mapped[list["ActivityModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ActivityModel.created_at",
        lazy="selectin",
    )


class MemberModel(Base):
    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint("group_id", "name_key", name="uq_member_group_name_key"),
        Index("ix_members_group_created", "group_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    name_key: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    group: Mapped[GroupModel] = relationship(back_populates="members")


class ExpenseModel(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_group_date", "group_id", "expense_date"),
        Index("ix_expenses_group_payer", "group_id", "paid_by_member_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    paid_by_member_id: Mapped[str] = mapped_column(
        ForeignKey("members.id", ondelete="RESTRICT"), nullable=False
    )
    split_method: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    group: Mapped[GroupModel] = relationship(back_populates="expenses")
    payer: Mapped[MemberModel] = relationship(foreign_keys=[paid_by_member_id])
    shares: Mapped[list["ExpenseShareModel"]] = relationship(
        back_populates="expense",
        cascade="all, delete-orphan",
        order_by="ExpenseShareModel.position",
        lazy="selectin",
    )


class ExpenseShareModel(Base):
    __tablename__ = "expense_shares"
    __table_args__ = (Index("ix_expense_shares_member", "member_id"),)

    expense_id: Mapped[str] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    member_id: Mapped[str] = mapped_column(
        ForeignKey("members.id", ondelete="RESTRICT"), primary_key=True
    )
    input_value: Mapped[str] = mapped_column(String(30), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    expense: Mapped[ExpenseModel] = relationship(back_populates="shares")
    member: Mapped[MemberModel] = relationship(foreign_keys=[member_id])


class SettlementModel(Base):
    __tablename__ = "settlements"
    __table_args__ = (Index("ix_settlements_group_date", "group_id", "settlement_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    from_member_id: Mapped[str] = mapped_column(
        ForeignKey("members.id", ondelete="RESTRICT"), nullable=False
    )
    to_member_id: Mapped[str] = mapped_column(
        ForeignKey("members.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    group: Mapped[GroupModel] = relationship(back_populates="settlements")
    sender: Mapped[MemberModel] = relationship(foreign_keys=[from_member_id])
    receiver: Mapped[MemberModel] = relationship(foreign_keys=[to_member_id])


class ActivityModel(Base):
    __tablename__ = "activities"
    __table_args__ = (Index("ix_activities_group_created", "group_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    detail: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    group: Mapped[GroupModel] = relationship(back_populates="activities")
