from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        Exception.__init__(self, self.message)


def not_found(resource: str) -> DomainError:
    normalized = resource.upper().replace(" ", "_")
    return DomainError(
        f"{normalized}_NOT_FOUND",
        f"The {resource.lower()} could not be found.",
        404,
    )


def archived_group_error() -> DomainError:
    return DomainError(
        "GROUP_ARCHIVED",
        "Archived groups are read-only. Restore the group before making changes.",
        409,
    )
