from pathlib import Path

import yaml

from app.main import create_app
from app.repositories.memory import InMemoryRepository


def test_exported_openapi_contract_matches_application_routes() -> None:
    contract_path = Path(__file__).resolve().parents[2] / "_docs" / "openapi.yaml"
    exported = yaml.safe_load(contract_path.read_text(encoding="utf-8"))
    generated = create_app(repository=InMemoryRepository(seed=False)).openapi()

    assert exported["openapi"] == "3.1.0"
    assert set(exported["paths"]) == set(generated["paths"])
    assert "/api/v1/groups/{group_id}/settlement-suggestions" in exported["paths"]
    assert exported["components"]["schemas"]["ExpenseWrite"]["properties"]["amount"][
        "type"
    ] == "string"
