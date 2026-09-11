from abc import ABC, abstractmethod

from app.domain import GroupRecord


class GroupRepository(ABC):
    @abstractmethod
    def list(self) -> list[GroupRecord]:
        """Return every group as detached aggregates."""

    @abstractmethod
    def get(self, group_id: str) -> GroupRecord | None:
        """Return one detached group aggregate, if it exists."""

    @abstractmethod
    def save(self, group: GroupRecord) -> GroupRecord:
        """Create or replace a group and return a detached copy."""

    @abstractmethod
    def clear(self) -> None:
        """Remove all records. Intended for tests and deterministic seeding."""

    def close(self) -> None:
        """Release repository resources when the application shuts down."""
        return None
