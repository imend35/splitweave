from pathlib import Path

import yaml

from app.main import app


def main() -> None:
    output_path = Path(__file__).resolve().parents[2] / "_docs" / "openapi.yaml"
    output_path.write_text(
        yaml.safe_dump(app.openapi(), sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    print(f"OpenAPI contract written to {output_path}")


if __name__ == "__main__":
    main()
