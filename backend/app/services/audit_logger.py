import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_FILE = LOG_DIR / "audit.jsonl"


def log_security_event(
    message: str,
    allowed: bool,
    risk_level: str,
    reason: str,
    model: str | None = None,
) -> str:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    request_id = str(uuid4())

    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "action": "chat",
        "allowed": allowed,
        "risk_level": risk_level,
        "reason": reason,
        "model": model,
    }

    with LOG_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(event) + "\n")

    return request_id