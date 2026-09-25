import json
import os
import time
import uuid
import urllib.error
import urllib.request
import tempfile 
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services.ollama_service import generate_response
from app.services.policy_engine import evaluate_request
from app.services.audit_logger import log_security_event
from app.services.ingestion_service import ingest_document
from app.services.rag_service import rag_query
from app.services.vision_service import analyze_image 
from app.services.voice_service import transcribe_audio
from app.services.tts_service import generate_speech
from fastapi import Response


app = FastAPI(title="Sovereign AI Workbench")


# =========================================================
# CONFIGURATION
# =========================================================

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"
MODEL_NAME = "qwen3:4b"

APP_START_TIME = time.time()


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODELS
# =========================================================

class ChatRequest(BaseModel):
    message: str
    document_id: str | None = None


# =========================================================
# PATH HELPERS
# =========================================================

def get_backend_dir() -> Path:
    """
    Return the backend directory.

    main.py is located at:
        backend/app/main.py

    Therefore parents[1] is:
        backend/
    """
    return Path(__file__).resolve().parents[1]


def get_audit_file() -> Path:
    """
    Return the audit log path.
    """
    return get_backend_dir() / "logs" / "audit.jsonl"

# =========================================================
# DOCUMENT UPLOAD
# =========================================================

@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF or DOCX document and index it into Qdrant.
    """

    allowed_extensions = {".pdf", ".docx"}

    file_extension = Path(file.filename).suffix.lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    upload_directory = get_backend_dir() / "uploads"
    upload_directory.mkdir(parents=True, exist_ok=True)

    file_path = upload_directory / file.filename

    try:
        file_content = await file.read()

        with file_path.open("wb") as output_file:
            output_file.write(file_content)

        document_id = str(uuid.uuid4())

        chunk_count = ingest_document(
            str(file_path),
            document_id=document_id,
            filename=file.filename,
        )

        return {
            "success": True,
            "filename": file.filename,
            "document_id": document_id,
            "chunks": chunk_count,
            "message": "Document uploaded and indexed successfully.",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {exc}",
        )

    finally:
        if file_path.exists():
            file_path.unlink()


# =========================================================
# BASIC HEALTH
# =========================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "sovereign-ai-workbench",
    }


# =========================================================
# SYSTEM STATUS HELPERS
# =========================================================

def check_policy_engine():
    """
    Verify that the policy engine is loaded and callable.
    """
    try:
        if not callable(evaluate_request):
            return {
                "status": "unhealthy",
                "message": "Policy engine is not callable.",
            }

        return {
            "status": "healthy",
            "message": "Policy engine loaded and ready.",
        }

    except Exception as exc:
        return {
            "status": "unhealthy",
            "message": f"Policy engine check failed: {exc}",
        }


def check_security_boundary():
    """
    Verify that requests can be evaluated by the security policy.

    We use a harmless internal probe rather than sending
    anything to the model.
    """
    try:
        decision = evaluate_request("system health check")

        if decision is None:
            return {
                "status": "unhealthy",
                "message": "Policy engine returned no decision.",
            }

        return {
            "status": "enforced",
            "message": "Requests are evaluated before model execution.",
        }

    except Exception as exc:
        return {
            "status": "unhealthy",
            "message": f"Security boundary check failed: {exc}",
        }


def check_ollama():
    """
    Check whether the local Ollama gateway is reachable.
    """
    try:
        request = urllib.request.Request(
            OLLAMA_TAGS_URL,
            method="GET",
        )

        with urllib.request.urlopen(request, timeout=2) as response:
            if response.status != 200:
                return {
                    "status": "unhealthy",
                    "message": f"Ollama returned HTTP {response.status}.",
                }

            return {
                "status": "healthy",
                "message": "Local Ollama gateway is reachable.",
            }

    except urllib.error.URLError as exc:
        return {
            "status": "offline",
            "message": f"Ollama gateway is unreachable: {exc.reason}",
        }

    except Exception as exc:
        return {
            "status": "offline",
            "message": f"Ollama gateway check failed: {exc}",
        }


def check_model():
    """
    Verify that the configured local model exists in Ollama.
    """
    try:
        request = urllib.request.Request(
            OLLAMA_TAGS_URL,
            method="GET",
        )

        with urllib.request.urlopen(request, timeout=2) as response:
            if response.status != 200:
                return {
                    "status": "unavailable",
                    "message": "Unable to retrieve Ollama model list.",
                }

            payload = json.loads(response.read().decode("utf-8"))

        models = payload.get("models", [])

        installed_models = []

        for model in models:
            name = model.get("name")

            if name:
                installed_models.append(name)

        if MODEL_NAME in installed_models:
            return {
                "status": "ready",
                "message": f"{MODEL_NAME} is installed locally.",
                "model": MODEL_NAME,
            }

        return {
            "status": "unavailable",
            "message": f"{MODEL_NAME} is not installed.",
            "model": MODEL_NAME,
        }

    except urllib.error.URLError as exc:
        return {
            "status": "unavailable",
            "message": f"Unable to reach Ollama: {exc.reason}",
            "model": MODEL_NAME,
        }

    except Exception as exc:
        return {
            "status": "unavailable",
            "message": f"Model check failed: {exc}",
            "model": MODEL_NAME,
        }


def check_audit_logger():
    """
    Verify that the audit directory/file can be accessed.

    This does not write a fake audit event.
    """
    try:
        audit_file = get_audit_file()
        audit_directory = audit_file.parent

        audit_directory.mkdir(parents=True, exist_ok=True)

        if audit_file.exists():
            if not os.access(audit_file, os.W_OK):
                return {
                    "status": "unhealthy",
                    "message": "Audit log exists but is not writable.",
                }

            return {
                "status": "healthy",
                "message": "Audit log is writable.",
                "path": str(audit_file),
            }

        if not os.access(audit_directory, os.W_OK):
            return {
                "status": "unhealthy",
                "message": "Audit log directory is not writable.",
                "path": str(audit_file),
            }

        return {
            "status": "healthy",
            "message": "Audit log directory is writable.",
            "path": str(audit_file),
        }

    except Exception as exc:
        return {
            "status": "unhealthy",
            "message": f"Audit logger check failed: {exc}",
        }


# =========================================================
# LIVE SYSTEM STATUS
# =========================================================

@app.get("/system/status")
def system_status():

    policy = check_policy_engine()
    security_boundary = check_security_boundary()
    ollama = check_ollama()
    model = check_model()
    audit = check_audit_logger()

    checks = {
        "policy_engine": policy,
        "ollama_gateway": ollama,
        "model": model,
        "audit_logger": audit,
        "security_boundary": security_boundary,
    }

    operational = (
        policy["status"] == "healthy"
        and ollama["status"] == "healthy"
        and model["status"] == "ready"
        and audit["status"] == "healthy"
        and security_boundary["status"] == "enforced"
    )

    healthy_count = sum(
        [
            policy["status"] == "healthy",
            ollama["status"] == "healthy",
            model["status"] == "ready",
            audit["status"] == "healthy",
            security_boundary["status"] == "enforced",
        ]
    )

    if operational:
        overall_status = "operational"
    elif healthy_count > 0:
        overall_status = "degraded"
    else:
        overall_status = "offline"

    return {
        "status": overall_status,
        "service": "sovereign-ai-workbench",
        "model": MODEL_NAME,
        "uptime_seconds": round(time.time() - APP_START_TIME, 2),
        "healthy_components": healthy_count,
        "total_components": 5,
        "checks": checks,
    }


# =========================================================
# AUDIT TRAIL
# =========================================================

@app.get("/audit")
def get_audit_trail():
    """
    Return the security audit trail.
    """

    audit_file = get_audit_file()

    if not audit_file.exists():
        return {
            "events": [],
            "message": "Audit log file not found.",
            "path": str(audit_file),
        }

    events = []

    with audit_file.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            if not line:
                continue

            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    # Newest events first
    events.reverse()

    return {
        "events": events,
        "count": len(events),
    }


# =========================================================
# CHAT
# =========================================================

@app.post("/chat")
async def chat(request: ChatRequest):

    start_time = time.perf_counter()


    # -----------------------------------------------------
    # 1. SECURITY POLICY
    # -----------------------------------------------------

    decision = evaluate_request(request.message)

    # -----------------------------------------------------
    # 2. BLOCK DANGEROUS REQUEST
    # -----------------------------------------------------

    if not decision.allowed:

        request_id = log_security_event(
            message=request.message,
            allowed=False,
            risk_level=decision.risk_level,
            reason=decision.reason,
        )

        return {
            "response": "Request blocked by security policy.",
            "allowed": False,
            "risk_level": decision.risk_level,
            "reason": decision.reason,
            "request_id": request_id,
        }

    # -----------------------------------------------------
    # 3. LOCAL MODEL EXECUTION
    # -----------------------------------------------------

    try:
        response = await rag_query(
        request.message,
        document_id=request.document_id
        )
        response_time = time.perf_counter() - start_time
    

    except Exception as exc:
        print("🔥 MODEL EXECUTION ERROR:", repr(exc))
        

        request_id = log_security_event(
            message=request.message,
            allowed=True,
            risk_level=decision.risk_level,
            reason=f"Model execution failed: {exc}",
            model=MODEL_NAME,
        )

        return {
            "response": "Local model execution failed.",
            "allowed": True,
            "risk_level": decision.risk_level,
            "reason": f"Model execution failed: {exc}",
            "request_id": request_id,
        }

    # -----------------------------------------------------
    # 4. AUDIT
    # -----------------------------------------------------

    request_id = log_security_event(
        message=request.message,
        allowed=True,
        risk_level=decision.risk_level,
        reason=decision.reason,
        model=MODEL_NAME,
    )

    # -----------------------------------------------------
    # 5. RESPONSE
    # -----------------------------------------------------

    return {
        "response": response,
        "allowed": True,
        "risk_level": decision.risk_level,
        "reason": decision.reason,
        "request_id": request_id,
        "response_time": round(response_time, 2),
    }
@app.post("/vision/analyze")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
):
    allowed_extensions = {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
    }

    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PNG, JPG, JPEG, and WEBP "
                "images are supported."
            ),
        )

    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded image is empty.",
            )

        response = await analyze_image(
            image_bytes=image_bytes,
        )

        return {
            "response": response,
            "model": "qwen2.5vl:3b",
            "local": True,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("🔥 VISION MODEL ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=f"Vision analysis failed: {exc}",
        )
@app.post("/voice/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...)
):
    try:
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="Audio file is empty."
            )

        suffix = ".webm"

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        try:
            text = transcribe_audio(temp_path)

        finally:
            os.remove(temp_path)

        return {
            "text": text,
            "model": "faster-whisper-base",
            "local": True,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("🔥 VOICE TRANSCRIPTION ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=f"Voice transcription failed: {exc}"
        )

@app.post("/voice/speak")
async def speak_text(payload: dict):
    try:
        text = payload.get("text", "").strip()

        if not text:
            raise HTTPException(
                status_code=400,
                detail="Text cannot be empty.",
            )

        audio_bytes = generate_speech(text)

        return Response(
            content=audio_bytes,
            media_type="audio/aiff",
            headers={
                "Content-Disposition": "inline; filename=response.aiff"
            },
        )

    except HTTPException:
        raise

    except Exception as exc:
        print("🔥 TTS ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=f"Speech generation failed: {exc}",
        )