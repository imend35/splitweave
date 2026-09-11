from copy import deepcopy
from threading import RLock

from app.domain import GroupRecord
from app.repositories.base import GroupRepository
from app.seed import build_demo_group


class InMemoryRepository(GroupRepository):
    """Thread-safe process-local store used during the mock-backend phase."""

    def __init__(self, *, seed: bool = True) -> None:
        self._groups: dict[str, GroupRecord] = {}
        self._lock = RLock()
        if seed:
            self.save(build_demo_group())

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
