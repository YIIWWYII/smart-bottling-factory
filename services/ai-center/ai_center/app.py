from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
import uuid
from copy import deepcopy
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


API_PREFIX = "/api"
SOURCE_MARK = "LOCAL DEMO / SIMULATION"
KNOWLEDGE_VERSION = "SIMULATION-KB-2026.07"
DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8088/hdc/api"
DEFAULT_DATA_DIR = Path(os.getenv("AI_CENTER_DATA_DIR", r"D:\HarmonyOS-Dev\Data\ai-center"))
AUTH_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar("ai_center_auth_context", default=None)
DEFAULT_AI_CONFIG = {
    "provider": "LOCAL_DEMO",
    "modelName": "local-demo-assistant",
    "baseUrl": "",
    "apiKey": "",
    "temperature": 0.2,
    "maxTokens": 800,
    "requestTimeoutSeconds": 12,
    "retryCount": 1,
    "streamingEnabled": True,
    "embeddingModel": "local-demo-embedding",
    "vectorStoreType": "LOCAL_DEMO_MEMORY",
    "vectorStoreUrl": "",
    "ragTopK": 5,
    "chunkSize": 800,
    "chunkOverlap": 120,
    "knowledgeIndexEnabled": True,
}
DEFAULT_AUTH_TOKENS = {
    "LOCAL_DEMO": {
        "userId": "local-admin",
        "displayName": "LOCAL DEMO Admin",
        "role": "ADMIN",
        "sourceApps": ["DISPLAY", "WORKSTATION", "ADMIN"],
        "permissions": ["ASSISTANT_READ", "AI_CONFIG_MANAGE", "KNOWLEDGE_SUBMIT", "KNOWLEDGE_REVIEW", "DECISION_READ"],
        "stageCodes": ["ALL"],
    },
    "DISPLAY_DEMO": {
        "userId": "display-demo",
        "displayName": "LOCAL DEMO Display",
        "role": "VIEWER",
        "sourceApps": ["DISPLAY"],
        "permissions": ["ASSISTANT_READ", "DECISION_READ"],
        "stageCodes": ["ALL"],
    },
    "WORKSTATION_DEMO": {
        "userId": "workstation-demo",
        "displayName": "LOCAL DEMO Workstation",
        "role": "OPERATOR",
        "sourceApps": ["WORKSTATION"],
        "permissions": ["ASSISTANT_READ", "DECISION_READ"],
        "stageCodes": ["PRETREATMENT", "GAS_INSPECTION", "APPEARANCE_INSPECTION", "FILLING", "SECONDARY_INSPECTION", "PACKING"],
    },
    "REVIEW_DEMO": {
        "userId": "review-admin",
        "displayName": "LOCAL DEMO Reviewer",
        "role": "ADMIN",
        "sourceApps": ["ADMIN"],
        "permissions": ["ASSISTANT_READ", "AI_CONFIG_MANAGE", "KNOWLEDGE_SUBMIT", "KNOWLEDGE_REVIEW", "DECISION_READ"],
        "stageCodes": ["ALL"],
    },
}
PUBLIC_HTTP_PATHS = {f"{API_PREFIX}/health"}
ADMIN_PREFIXES = (
    f"{API_PREFIX}/admin/",
)
ASSISTANT_PREFIX = f"{API_PREFIX}/assistant/"
KNOWLEDGE_PREFIX = f"{API_PREFIX}/knowledge/"
DECISION_PREFIX = f"{API_PREFIX}/decisions"
VISION_PREFIX = f"{API_PREFIX}/vision/"
AI_INTEGRATION_PREFIX = f"{API_PREFIX}/ai-integration/"
DEFAULT_RAG_DOCUMENTS = [
    {
        "documentId": "doc-local-pla-safety",
        "submissionId": "doc-local-pla-safety",
        "reviewId": "review-doc-local-pla-safety",
        "title": "PLA bottle pretreatment safety SOP",
        "fileName": "pla-safety-sop.md",
        "contentType": "text/markdown",
        "category": "PROCESS_SAFETY",
        "scopeApps": ["ALL"],
        "tags": ["PLA", "VOC", "pretreatment"],
        "status": "INDEXED",
        "indexStatus": "READY",
        "version": KNOWLEDGE_VERSION,
        "sourceVersion": "LOCAL-DEMO-1",
        "chunkCount": 8,
        "source": SOURCE_MARK,
        "failureReason": "",
        "submittedBy": "LOCAL_DEMO",
        "submittedAt": "2026-07-28T00:00:00Z",
        "reviewedBy": "LOCAL_DEMO",
        "reviewedAt": "2026-07-28T00:00:00Z",
        "updatedAt": "2026-07-28T00:00:00Z",
    },
    {
        "documentId": "doc-local-filling-quality",
        "submissionId": "doc-local-filling-quality",
        "reviewId": "review-doc-local-filling-quality",
        "title": "Filling quality inspection guide",
        "fileName": "filling-quality-guide.md",
        "contentType": "text/markdown",
        "category": "QUALITY_INSPECTION",
        "scopeApps": ["DISPLAY", "WORKSTATION", "ADMIN", "AI_CENTER"],
        "tags": ["filling", "inspection", "quality"],
        "status": "INDEXED",
        "indexStatus": "READY",
        "version": KNOWLEDGE_VERSION,
        "sourceVersion": "LOCAL-DEMO-1",
        "chunkCount": 6,
        "source": SOURCE_MARK,
        "failureReason": "",
        "submittedBy": "LOCAL_DEMO",
        "submittedAt": "2026-07-28T00:00:00Z",
        "reviewedBy": "LOCAL_DEMO",
        "reviewedAt": "2026-07-28T00:00:00Z",
        "updatedAt": "2026-07-28T00:00:00Z",
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def envelope(data: Any, message: str = "OK", code: int = 0, success: bool = True) -> dict[str, Any]:
    return {"code": code, "message": message, "data": data, "success": success}


def error_envelope(message: str, code: int = 404) -> JSONResponse:
    return JSONResponse(status_code=code, content=envelope(None, message=message, code=code, success=False))


def context_state_version(context: dict[str, Any]) -> int | None:
    value = context.get("stateVersion")
    if isinstance(value, int):
        return value
    return None


class EventHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._history: list[dict[str, Any]] = []
        self._aggregate_versions: dict[str, int] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def publish(self, event: dict[str, Any]) -> None:
        event.setdefault("eventId", new_id("evt"))
        event.setdefault("createdAt", now_iso())
        event.setdefault("occurredAt", event["createdAt"])
        event.setdefault("schemaVersion", 1)
        if event.get("conversationId") and not event.get("aggregateId"):
            event["aggregateType"] = "AI_CONVERSATION"
            event["aggregateId"] = event["conversationId"]
        if event.get("aggregateType") and event.get("aggregateId") and not event.get("aggregateVersion"):
            key = f"{event['aggregateType']}:{event['aggregateId']}"
            self._aggregate_versions[key] = self._aggregate_versions.get(key, 0) + 1
            event["aggregateVersion"] = self._aggregate_versions[key]
        event.setdefault("source", SOURCE_MARK)
        async with self._lock:
            self._history.append(deepcopy(event))
            if len(self._history) > 500:
                self._history = self._history[-500:]
            clients = list(self._clients)
        stale: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(event)
            except Exception:
                stale.append(client)
        if stale:
            async with self._lock:
                for client in stale:
                    self._clients.discard(client)

    async def history(self, conversation_id: str | None = None, after_version: int = 0) -> list[dict[str, Any]]:
        async with self._lock:
            events = deepcopy(self._history)
        if conversation_id is None:
            return [event for event in events if int(event.get("aggregateVersion", 0) or 0) > after_version]
        return [
            event for event in events
            if event.get("conversationId") == conversation_id and int(event.get("aggregateVersion", 0) or 0) > after_version
        ]


class AiCenterState:
    def __init__(self) -> None:
        bundle = load_state_bundle()
        self.conversations: dict[str, dict[str, Any]] = bundle.get("conversations", {})
        self.messages: dict[str, list[dict[str, Any]]] = bundle.get("messages", {})
        self.active_messages: dict[str, dict[str, Any]] = {}
        self.rag_documents: dict[str, dict[str, Any]] = bundle.get(
            "ragDocuments",
            {item["documentId"]: index_document_chunks(deepcopy(item), DEFAULT_AI_CONFIG) for item in DEFAULT_RAG_DOCUMENTS},
        )
        self.knowledge_submissions: dict[str, dict[str, Any]] = {
            item["submissionId"]: document_to_submission(item) for item in self.rag_documents.values()
        }
        self.decisions: dict[str, dict[str, Any]] = bundle.get("decisions", {})
        self.recognitions: dict[str, dict[str, Any]] = bundle.get("recognitions", {})
        self.command_intents: dict[str, dict[str, Any]] = bundle.get("commandIntents", {})
        self.ai_config: dict[str, Any] = bundle.get("aiConfig", load_ai_config_from_env())
        self.events = EventHub()


def create_app() -> FastAPI:
    state = AiCenterState()
    app = FastAPI(title="Bottling Factory AI Center", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def auth_middleware(request_obj: Request, call_next):
        if request_obj.url.path in PUBLIC_HTTP_PATHS:
            return await call_next(request_obj)
        auth = authenticate_request_headers(request_obj.headers.get("authorization", ""), request_obj.headers.get("x-client-type", ""))
        if not auth["ok"]:
            return error_envelope(auth["message"], auth["status"])
        path = request_obj.url.path
        if not is_authorized_for_path(auth, path, request_obj.method):
            return error_envelope("forbidden by AI center RBAC or sourceApp scope", 403)
        token = AUTH_CONTEXT.set(auth)
        try:
            return await call_next(request_obj)
        finally:
            AUTH_CONTEXT.reset(token)

    @app.get(f"{API_PREFIX}/health")
    async def health() -> dict[str, Any]:
        return envelope(
            {
                "service": "ai-center",
                "status": "UP",
                "port": int(os.getenv("AI_CENTER_PORT", "8091")),
                "apiPrefix": API_PREFIX,
                "aiProvider": state.ai_config["provider"],
                "modelName": state.ai_config["modelName"],
                "source": SOURCE_MARK,
                "time": now_iso(),
            }
        )

    @app.get(f"{API_PREFIX}/admin/ai/config")
    async def get_ai_config() -> dict[str, Any]:
        return envelope({"config": mask_ai_config(state.ai_config), "source": SOURCE_MARK})

    @app.api_route(f"{API_PREFIX}/admin/ai/config", methods=["PUT", "POST"])
    async def update_ai_config(request_body: dict[str, Any]) -> dict[str, Any]:
        merged = deepcopy(state.ai_config)
        updates = normalize_ai_config(request_body)
        if is_masked_secret(updates.get("apiKey")):
            updates.pop("apiKey")
        merged.update(updates)
        state.ai_config = merged
        persist_state(state)
        return envelope(
            {
                "config": mask_ai_config(state.ai_config),
                "note": f"LOCAL DEMO: config is persisted to {state_file_path()} and .env remains the boot default fallback.",
                "source": SOURCE_MARK,
            }
        )

    @app.post(f"{API_PREFIX}/admin/ai/config/test")
    async def test_ai_config(request_body: dict[str, Any] | None = None) -> dict[str, Any]:
        test_config = deepcopy(state.ai_config)
        if request_body:
            candidate = request_body.get("config") if isinstance(request_body.get("config"), dict) else request_body
            test_config.update(normalize_ai_config(candidate))
        result = await run_ai_connection_test(test_config)
        return envelope(result, message=result["message"], code=0 if result["ok"] else 1)

    @app.post(f"{API_PREFIX}/admin/ai/config/test-question")
    async def test_ai_question(request_body: dict[str, Any] | None = None) -> dict[str, Any]:
        body = request_body or {}
        question = str(body.get("question", "Give a short LOCAL DEMO health answer.")).strip()
        test_config = deepcopy(state.ai_config)
        if isinstance(body.get("config"), dict):
            test_config.update(normalize_ai_config(body["config"]))
        started = time.perf_counter()
        result = await generate_model_or_demo_answer(test_config, question, body.get("context") if isinstance(body.get("context"), dict) else {})
        result["elapsedMs"] = int((time.perf_counter() - started) * 1000)
        return envelope(result, message=result["message"], code=0 if result["ok"] else 1)

    @app.get(f"{API_PREFIX}/admin/ai/rag/status")
    async def rag_status() -> dict[str, Any]:
        documents = list(state.rag_documents.values())
        failed = [item for item in documents if item.get("indexStatus") == "FAILED"]
        pending = [item for item in documents if item.get("indexStatus") in ("PENDING", "INDEXING")]
        return envelope(
            {
                "status": "READY" if not failed and not pending else "ATTENTION_REQUIRED",
                "knowledgeVersion": KNOWLEDGE_VERSION,
                "documentCount": len(documents),
                "indexedCount": len([item for item in documents if item.get("indexStatus") == "READY"]),
                "failedCount": len(failed),
                "pendingCount": len(pending),
                "vectorStoreType": state.ai_config["vectorStoreType"],
                "vectorStoreUrl": state.ai_config["vectorStoreUrl"],
                "embeddingModel": state.ai_config["embeddingModel"],
                "ragTopK": state.ai_config["ragTopK"],
                "chunkSize": state.ai_config["chunkSize"],
                "chunkOverlap": state.ai_config["chunkOverlap"],
                "knowledgeIndexEnabled": state.ai_config["knowledgeIndexEnabled"],
                "source": SOURCE_MARK,
            }
        )

    @app.get(f"{API_PREFIX}/admin/ai/rag/documents")
    async def rag_documents(scopeApp: str | None = None, category: str | None = None, status: str | None = None) -> dict[str, Any]:
        items = list(state.rag_documents.values())
        if scopeApp:
            items = [item for item in items if document_visible_to_app(item, scopeApp)]
        if category:
            items = [item for item in items if str(item.get("category", "")).upper() == category.upper()]
        if status:
            items = [item for item in items if str(item.get("status", "")).upper() == status.upper()]
        return envelope({"items": items, "source": SOURCE_MARK})

    @app.post(f"{API_PREFIX}/admin/ai/rag/documents")
    async def create_rag_document(request_body: dict[str, Any]) -> dict[str, Any]:
        document = create_rag_document_record(request_body, body_size=0)
        state.rag_documents[document["documentId"]] = document
        state.knowledge_submissions[document["submissionId"]] = document_to_submission(document)
        persist_state(state)
        return envelope(document)

    @app.get(f"{API_PREFIX}/admin/ai/rag/documents/{{document_id}}")
    async def rag_document(document_id: str) -> dict[str, Any]:
        document = state.rag_documents.get(document_id)
        if document is None:
            return error_envelope("rag document not found", 404)
        return envelope(document)

    @app.api_route(f"{API_PREFIX}/admin/ai/rag/documents/{{document_id}}/classification", methods=["PUT", "POST"])
    async def update_rag_document_classification(document_id: str, request_body: dict[str, Any]) -> dict[str, Any]:
        document = state.rag_documents.get(document_id)
        if document is None:
            return error_envelope("rag document not found", 404)
        apply_document_classification(document, request_body)
        document["updatedAt"] = now_iso()
        state.knowledge_submissions[document["submissionId"]] = document_to_submission(document)
        persist_state(state)
        return envelope(document)

    @app.post(f"{API_PREFIX}/admin/ai/rag/reindex")
    async def reindex_rag_documents() -> dict[str, Any]:
        if not state.ai_config["knowledgeIndexEnabled"]:
            return envelope(
                {
                    "status": "SKIPPED",
                    "reason": "knowledgeIndexEnabled=false",
                    "source": SOURCE_MARK,
                },
                message="knowledge indexing disabled",
                code=1,
            )
        for document in state.rag_documents.values():
            if document.get("status") in ("APPROVED", "INDEXED"):
                index_document_chunks(document, state.ai_config)
        persist_state(state)
        return envelope({"status": "LOCAL_DEMO_INDEXED", "items": list(state.rag_documents.values()), "source": SOURCE_MARK})

    @app.websocket(f"{API_PREFIX}/assistant/events")
    async def assistant_events(websocket: WebSocket) -> None:
        conversation_filter = websocket.query_params.get("conversationId")
        after_version = clamp_int(websocket.query_params.get("afterVersion"), 0, 1_000_000_000, 0)
        auth = authenticate_request_headers(websocket.headers.get("authorization", ""), websocket.headers.get("x-client-type", ""))
        if not auth["ok"] or "ASSISTANT_READ" not in auth.get("permissions", []):
            await websocket.close(code=1008)
            return
        await state.events.connect(websocket)
        try:
            await websocket.send_json(
                {
                    "eventId": new_id("evt"),
                    "type": "ai.connection.ready",
                    "conversationId": conversation_filter,
                    "createdAt": now_iso(),
                    "source": SOURCE_MARK,
                }
            )
            for event in await state.events.history(conversation_filter, after_version):
                await websocket.send_json(event)
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await state.events.disconnect(websocket)
        except Exception:
            await state.events.disconnect(websocket)

    @app.get(f"{API_PREFIX}/assistant/events/history")
    async def assistant_event_history(conversationId: str | None = None, afterVersion: int = 0) -> dict[str, Any]:
        return envelope({"events": await state.events.history(conversationId, afterVersion), "source": SOURCE_MARK})

    @app.get(f"{API_PREFIX}/assistant/conversations")
    async def list_conversations() -> dict[str, Any]:
        items = sorted(state.conversations.values(), key=lambda item: item["createdAt"], reverse=True)
        return envelope({"items": items, "source": SOURCE_MARK})

    @app.post(f"{API_PREFIX}/assistant/conversations")
    async def create_conversation(request_body: dict[str, Any]) -> dict[str, Any]:
        try:
            context = sanitize_context_for_auth(
                request_body.get("context") if isinstance(request_body.get("context"), dict) else {},
                current_auth(),
            )
        except PermissionError as exc:
            return error_envelope(str(exc), 403)
        conversation_id = new_id("conv")
        created_at = now_iso()
        title = build_conversation_title(context)
        conversation = {
            "conversationId": conversation_id,
            "title": title,
            "createdAt": created_at,
            "updatedAt": created_at,
            "context": context,
            "source": SOURCE_MARK,
        }
        state.conversations[conversation_id] = conversation
        state.messages[conversation_id] = []
        persist_state(state)
        await state.events.publish(
            {
                "type": "ai.conversation.created",
                "conversationId": conversation_id,
                "status": "CREATED",
                "title": title,
            }
        )
        return envelope({"conversationId": conversation_id, "title": title, "createdAt": created_at})

    @get_conversation_or_404(app, state, "GET", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/messages")
    async def list_messages(conversation_id: str) -> dict[str, Any]:
        return envelope(
            {
                "conversationId": conversation_id,
                "messages": state.messages.get(conversation_id, []),
                "source": SOURCE_MARK,
            }
        )

    @get_conversation_or_404(app, state, "GET", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/messages/{{message_id}}")
    async def get_message(conversation_id: str, message_id: str) -> dict[str, Any]:
        message = find_message(state, conversation_id, message_id)
        if message is None:
            return error_envelope("message not found", 404)
        return envelope(message)

    @get_conversation_or_404(app, state, "POST", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/messages")
    async def send_message(conversation_id: str, request_body: dict[str, Any]) -> dict[str, Any]:
        if isinstance(request_body.get("context"), dict):
            try:
                request_body["context"] = sanitize_context_for_auth(request_body["context"], current_auth())
            except PermissionError as exc:
                return error_envelope(str(exc), 403)
        return await create_assistant_message(state, conversation_id, request_body, retry_of=None)

    @get_conversation_or_404(app, state, "POST", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/stop")
    async def stop_conversation(conversation_id: str) -> dict[str, Any]:
        stopped = await stop_active_message(state, conversation_id, None)
        return envelope({"conversationId": conversation_id, "stopped": stopped, "source": SOURCE_MARK})

    @get_conversation_or_404(app, state, "POST", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/messages/{{message_id}}/stop")
    async def stop_message(conversation_id: str, message_id: str) -> dict[str, Any]:
        stopped = await stop_active_message(state, conversation_id, message_id)
        return envelope({"conversationId": conversation_id, "messageId": message_id, "stopped": stopped, "source": SOURCE_MARK})

    @get_conversation_or_404(app, state, "POST", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/retry")
    async def retry_conversation(conversation_id: str) -> dict[str, Any]:
        last_user = last_user_message(state, conversation_id)
        if last_user is None:
            return error_envelope("no user message to retry", 409)
        return await create_assistant_message(
            state,
            conversation_id,
            {
                "question": last_user.get("content", ""),
                "questionType": last_user.get("questionType", "FREE_TEXT"),
                "context": last_user.get("context", {}),
            },
            retry_of=None,
        )

    @get_conversation_or_404(app, state, "POST", f"{API_PREFIX}/assistant/conversations/{{conversation_id}}/messages/{{message_id}}/retry")
    async def retry_message(conversation_id: str, message_id: str) -> dict[str, Any]:
        source_message = find_message(state, conversation_id, message_id)
        if source_message is None:
            return error_envelope("message not found", 404)
        if source_message.get("role") == "USER":
            question = source_message.get("content", "")
            context = source_message.get("context", {})
        else:
            user_message = previous_user_message(state, conversation_id, message_id)
            if user_message is None:
                return error_envelope("no user message to retry", 409)
            question = user_message.get("content", "")
            context = user_message.get("context", {})
        return await create_assistant_message(
            state,
            conversation_id,
            {"question": question, "questionType": "FREE_TEXT", "context": context},
            retry_of=message_id,
        )

    @app.post(f"{API_PREFIX}/vision/inferences")
    async def vision_inference(request_body: dict[str, Any]) -> dict[str, Any]:
        recognition_id = new_id("vision")
        result = {
            "recognitionId": recognition_id,
            "bottleType": request_body.get("expectedBottleType", "PLA-500ML-ROUND"),
            "confidence": 0.87,
            "defects": [
                {"type": "CAP_SCRATCH", "severity": "LOW", "confidence": 0.62},
                {"type": "BODY_DEFORMATION", "severity": "NONE", "confidence": 0.91},
            ],
            "modelVersion": "SIMULATION-VISION-0.1",
            "evidenceRefs": ["LOCAL DEMO camera-frame-ref"],
            "source": SOURCE_MARK,
            "createdAt": now_iso(),
        }
        state.recognitions[recognition_id] = result
        persist_state(state)
        return envelope(result)

    @app.get(f"{API_PREFIX}/decisions")
    async def list_decisions() -> dict[str, Any]:
        return envelope({"items": list(state.decisions.values()), "source": SOURCE_MARK})

    @app.get(f"{API_PREFIX}/decisions/current")
    async def current_decision() -> dict[str, Any]:
        items = list(state.decisions.values())
        decision = items[-1] if items else make_demo_decision()
        return envelope(decision)

    @app.get(f"{API_PREFIX}/decisions/{{decision_id}}")
    async def get_decision(decision_id: str) -> dict[str, Any]:
        decision = state.decisions.get(decision_id)
        if decision is None:
            return error_envelope("decision not found", 404)
        return envelope(decision)

    @app.post(f"{API_PREFIX}/decisions/evaluate")
    async def evaluate_decision(request_body: dict[str, Any]) -> dict[str, Any]:
        decision = make_demo_decision(request_body)
        state.decisions[decision["decisionId"]] = decision
        persist_state(state)
        await state.events.publish(
            {
                "type": "ai.decision.evaluated",
                "conversationId": None,
                "decisionId": decision["decisionId"],
                "status": decision["status"],
            }
        )
        return envelope(decision)

    @app.api_route(f"{API_PREFIX}/knowledge/submissions", methods=["GET", "POST"])
    async def knowledge_submissions(request: Request) -> dict[str, Any]:
        if request.method == "GET":
            return envelope({"items": list(state.knowledge_submissions.values()), "source": SOURCE_MARK})
        upload = await parse_knowledge_upload_request(request)
        document = create_rag_document_record(upload["metadata"], body_size=upload["size"], file_info=upload)
        document["submittedBy"] = current_auth().get("userId", document.get("submittedBy", ""))
        state.rag_documents[document["documentId"]] = document
        submission = document_to_submission(document)
        state.knowledge_submissions[submission["submissionId"]] = submission
        persist_state(state)
        return envelope(submission)

    @app.get(f"{API_PREFIX}/knowledge/submissions/{{knowledge_id}}")
    async def knowledge_submission(knowledge_id: str) -> dict[str, Any]:
        item = state.knowledge_submissions.get(knowledge_id)
        if item is None:
            return error_envelope("knowledge submission not found", 404)
        return envelope(item)

    @app.get(f"{API_PREFIX}/admin/knowledge/reviews")
    async def list_reviews() -> dict[str, Any]:
        reviews = [document_to_review(item) for item in state.rag_documents.values()]
        return envelope({"items": reviews, "source": SOURCE_MARK})

    @app.get(f"{API_PREFIX}/admin/knowledge/reviews/{{knowledge_id}}")
    async def get_review(knowledge_id: str) -> dict[str, Any]:
        document = find_document_by_any_id(state, knowledge_id)
        if document is None:
            return error_envelope("knowledge review not found", 404)
        return envelope(document_to_review(document))

    @app.post(f"{API_PREFIX}/admin/knowledge/reviews/{{knowledge_id}}/{{action}}")
    async def review_action(knowledge_id: str, action: str, request_body: dict[str, Any] | None = None) -> dict[str, Any]:
        document = find_document_by_any_id(state, knowledge_id)
        if document is None:
            return error_envelope("knowledge review not found", 404)
        status_by_action = {
            "approve": ("READY", "INDEXED"),
            "reject": ("REJECTED", "REJECTED"),
            "revoke": ("REVOKED", "REVOKED"),
        }
        if action not in status_by_action:
            return error_envelope("unsupported review action", 400)
        reviewer_id = str(current_auth().get("userId", ""))
        if action == "approve" and reviewer_id and reviewer_id == document.get("submittedBy"):
            return error_envelope("submitter cannot approve own knowledge submission", 403)
        index_status, status = status_by_action[action]
        review_note = (request_body or {}).get("note") or (request_body or {}).get("comment") or "LOCAL DEMO review action"
        document["status"] = status
        document["indexStatus"] = index_status
        document["failureReason"] = "" if action == "approve" else review_note
        document["reviewNote"] = review_note
        document["reviewedBy"] = reviewer_id or (request_body or {}).get("reviewedBy", "LOCAL_DEMO_ADMIN")
        document["reviewedAt"] = now_iso()
        if action == "approve":
            index_document_chunks(document, state.ai_config)
        else:
            document["chunkCount"] = 0
            document["chunks"] = []
        document["updatedAt"] = now_iso()
        submission = document_to_submission(document)
        state.knowledge_submissions[submission["submissionId"]] = submission
        persist_state(state)
        return envelope(submission)

    @app.api_route(f"{API_PREFIX}/ai-integration/facts", methods=["GET", "POST"])
    async def local_backend_facts() -> dict[str, Any]:
        return envelope(make_local_facts())

    @app.post(f"{API_PREFIX}/ai-integration/recognitions")
    async def accept_backend_recognition(request_body: dict[str, Any]) -> dict[str, Any]:
        recognition_id = new_id("recog")
        item = {"recognitionId": recognition_id, "status": "ACCEPTED", "payload": request_body, "source": SOURCE_MARK, "createdAt": now_iso()}
        state.recognitions[recognition_id] = item
        persist_state(state)
        return envelope(item)

    @app.post(f"{API_PREFIX}/ai-integration/command-intents")
    async def accept_command_intent(request_body: dict[str, Any]) -> dict[str, Any]:
        intent_id = new_id("intent")
        backend_result = submit_command_intent_to_backend(request_body, current_auth())
        item = {
            "intentId": intent_id,
            "status": backend_result["status"],
            "safeGate": backend_result["safeGate"],
            "backendResponse": backend_result.get("backendResponse"),
            "payload": request_body,
            "source": backend_result["source"],
            "createdAt": now_iso(),
        }
        state.command_intents[intent_id] = item
        persist_state(state)
        return envelope(item)

    @app.get(f"{API_PREFIX}/ai-integration/commands/{{command_id}}")
    async def command_status(command_id: str) -> dict[str, Any]:
        item = state.command_intents.get(command_id)
        if item is None:
            item = {
                "commandId": command_id,
                "status": "LOCAL_DEMO_UNKNOWN",
                "ack": "SIMULATION: production backend was not queried in this mock endpoint.",
                "source": SOURCE_MARK,
            }
        return envelope(item)

    return app


def get_conversation_or_404(app: FastAPI, state: AiCenterState, method: str, path: str):
    def decorator(handler):
        @wraps(handler)
        async def wrapper(conversation_id: str, *args: Any, **kwargs: Any):
            if conversation_id not in state.conversations:
                return error_envelope("conversation not found", 404)
            return await handler(conversation_id, *args, **kwargs)

        app.add_api_route(path, wrapper, methods=[method])
        return wrapper

    return decorator


def state_file_path() -> Path:
    return DEFAULT_DATA_DIR / "state.json"


def ensure_data_dir() -> None:
    DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_state_bundle() -> dict[str, Any]:
    path = state_file_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def persist_state(state: AiCenterState) -> None:
    ensure_data_dir()
    bundle = {
        "schemaVersion": 1,
        "updatedAt": now_iso(),
        "source": SOURCE_MARK,
        "aiConfig": state.ai_config,
        "ragDocuments": state.rag_documents,
        "conversations": state.conversations,
        "messages": state.messages,
        "decisions": state.decisions,
        "recognitions": state.recognitions,
        "commandIntents": state.command_intents,
    }
    path = state_file_path()
    temp_path = path.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def authenticate_request_headers(authorization: str, client_type: str) -> dict[str, Any]:
    token = extract_bearer_token(authorization)
    if not token:
        return {"ok": False, "status": 401, "message": "missing Authorization bearer token"}
    principal = load_principal_for_token(token)
    if principal is None:
        return {"ok": False, "status": 401, "message": "invalid Authorization token"}
    source_app = client_type.strip().upper()
    if not source_app:
        source_app = principal["sourceApps"][0]
    if source_app not in principal["sourceApps"]:
        return {"ok": False, "status": 403, "message": "token is not allowed for requested X-Client-Type"}
    result = deepcopy(principal)
    result["ok"] = True
    result["status"] = 200
    result["token"] = token
    result["sourceApp"] = source_app
    return result


def extract_bearer_token(value: str) -> str:
    text = value.strip()
    if not text:
        return ""
    if text.lower().startswith("bearer "):
        return text[7:].strip()
    return text


def load_principal_for_token(token: str) -> dict[str, Any] | None:
    configured = os.getenv("AI_CENTER_AUTH_TOKENS", "")
    if configured.strip():
        try:
            parsed = json.loads(configured)
            if isinstance(parsed, dict) and token in parsed and isinstance(parsed[token], dict):
                return normalize_principal(parsed[token])
        except Exception:
            pass
    if token in DEFAULT_AUTH_TOKENS:
        return normalize_principal(DEFAULT_AUTH_TOKENS[token])
    return None


def normalize_principal(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "userId": str(raw.get("userId") or "unknown"),
        "displayName": str(raw.get("displayName") or raw.get("userId") or "unknown"),
        "role": str(raw.get("role") or "VIEWER").upper(),
        "sourceApps": normalize_scope_apps(raw.get("sourceApps") or raw.get("sourceApp") or []),
        "permissions": [str(item).upper() for item in raw.get("permissions", []) if str(item).strip()],
        "stageCodes": [str(item).upper() for item in raw.get("stageCodes", ["ALL"]) if str(item).strip()],
    }


def current_auth() -> dict[str, Any]:
    auth = AUTH_CONTEXT.get()
    return auth or normalize_principal(DEFAULT_AUTH_TOKENS["LOCAL_DEMO"])


def is_authorized_for_path(auth: dict[str, Any], path: str, method: str) -> bool:
    permissions = auth.get("permissions", [])
    source_app = str(auth.get("sourceApp", "")).upper()
    if path.startswith(ADMIN_PREFIXES):
        return source_app == "ADMIN" and (
            "AI_CONFIG_MANAGE" in permissions or "KNOWLEDGE_REVIEW" in permissions or "DECISION_READ" in permissions
        )
    if path.startswith(KNOWLEDGE_PREFIX):
        if method.upper() == "POST":
            return source_app == "ADMIN" and "KNOWLEDGE_SUBMIT" in permissions
        return source_app == "ADMIN" and ("KNOWLEDGE_SUBMIT" in permissions or "KNOWLEDGE_REVIEW" in permissions)
    if path.startswith(ASSISTANT_PREFIX):
        return "ASSISTANT_READ" in permissions
    if path.startswith(DECISION_PREFIX):
        return "DECISION_READ" in permissions or source_app == "ADMIN"
    if path.startswith(VISION_PREFIX):
        return source_app == "ADMIN" or "AI_INTERNAL" in permissions
    if path.startswith(AI_INTEGRATION_PREFIX):
        return source_app == "ADMIN" or "AI_INTERNAL" in permissions or "ASSISTANT_READ" in permissions
    return True


def sanitize_context_for_auth(context: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
    sanitized = deepcopy(context)
    requested_source = str(sanitized.get("sourceApp", "")).upper()
    source_app = str(auth.get("sourceApp", "")).upper()
    if requested_source and requested_source != source_app:
        raise PermissionError("context sourceApp does not match authenticated client")
    sanitized["sourceApp"] = source_app
    stage_code = str(sanitized.get("stageCode", "")).upper()
    allowed_stages = auth.get("stageCodes", [])
    if source_app == "WORKSTATION" and stage_code and "ALL" not in allowed_stages and stage_code not in allowed_stages:
        raise PermissionError("workstation token cannot access requested stage")
    sanitized["userRoleHint"] = auth.get("role", "")
    sanitized["authenticatedUserId"] = auth.get("userId", "")
    return sanitized


def build_conversation_title(context: dict[str, Any]) -> str:
    source_app = context.get("sourceApp", "UNKNOWN")
    stage = context.get("stageCode") or context.get("pageRoute") or "factory"
    return f"{source_app} assistant - {stage}"


def load_ai_config_from_env() -> dict[str, Any]:
    config = deepcopy(DEFAULT_AI_CONFIG)
    env_map = {
        "AI_PROVIDER": "provider",
        "AI_MODEL_NAME": "modelName",
        "AI_BASE_URL": "baseUrl",
        "AI_API_KEY": "apiKey",
        "AI_TEMPERATURE": "temperature",
        "AI_MAX_TOKENS": "maxTokens",
        "AI_REQUEST_TIMEOUT_SECONDS": "requestTimeoutSeconds",
        "AI_RETRY_COUNT": "retryCount",
        "AI_STREAMING_ENABLED": "streamingEnabled",
        "AI_EMBEDDING_MODEL": "embeddingModel",
        "AI_VECTOR_STORE_TYPE": "vectorStoreType",
        "AI_VECTOR_STORE_URL": "vectorStoreUrl",
        "AI_RAG_TOP_K": "ragTopK",
        "AI_CHUNK_SIZE": "chunkSize",
        "AI_CHUNK_OVERLAP": "chunkOverlap",
        "AI_KNOWLEDGE_INDEX_ENABLED": "knowledgeIndexEnabled",
    }
    raw: dict[str, Any] = {}
    for env_name, key in env_map.items():
        value = os.getenv(env_name)
        if value is not None:
            raw[key] = value
    config.update(normalize_ai_config(raw))
    return config


def normalize_ai_config(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    normalized: dict[str, Any] = {}
    text_keys = [
        "provider",
        "modelName",
        "baseUrl",
        "apiKey",
        "embeddingModel",
        "vectorStoreType",
        "vectorStoreUrl",
    ]
    for key in text_keys:
        if key in raw and raw[key] is not None:
            normalized[key] = str(raw[key]).strip()
    int_defaults = {
        "maxTokens": DEFAULT_AI_CONFIG["maxTokens"],
        "requestTimeoutSeconds": DEFAULT_AI_CONFIG["requestTimeoutSeconds"],
        "retryCount": DEFAULT_AI_CONFIG["retryCount"],
        "ragTopK": DEFAULT_AI_CONFIG["ragTopK"],
        "chunkSize": DEFAULT_AI_CONFIG["chunkSize"],
        "chunkOverlap": DEFAULT_AI_CONFIG["chunkOverlap"],
    }
    for key, default_value in int_defaults.items():
        if key in raw:
            normalized[key] = clamp_int(raw[key], 0, 120000, int(default_value))
    if "requestTimeoutSeconds" in normalized:
        normalized["requestTimeoutSeconds"] = clamp_int(normalized["requestTimeoutSeconds"], 3, 40, 12)
    if "retryCount" in normalized:
        normalized["retryCount"] = clamp_int(normalized["retryCount"], 0, 5, 1)
    if "ragTopK" in normalized:
        normalized["ragTopK"] = clamp_int(normalized["ragTopK"], 1, 30, 5)
    if "chunkSize" in normalized:
        normalized["chunkSize"] = clamp_int(normalized["chunkSize"], 100, 8000, 800)
    if "chunkOverlap" in normalized:
        normalized["chunkOverlap"] = clamp_int(normalized["chunkOverlap"], 0, 2000, 120)
    if "temperature" in raw:
        normalized["temperature"] = clamp_float(raw["temperature"], 0.0, 2.0, 0.2)
    for key in ["streamingEnabled", "knowledgeIndexEnabled"]:
        if key in raw:
            normalized[key] = parse_bool(raw[key])
    if "provider" in normalized:
        normalized["provider"] = normalized["provider"].upper() or "LOCAL_DEMO"
    return normalized


def clamp_int(value: Any, minimum: int, maximum: int, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, parsed))


def clamp_float(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, parsed))


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "enabled")


def mask_ai_config(config: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(config)
    result["apiKey"] = mask_secret(str(config.get("apiKey", "")))
    result["hasApiKey"] = bool(str(config.get("apiKey", "")).strip())
    return result


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "***"
    return f"{value[:3]}***{value[-4:]}"


def is_masked_secret(value: Any) -> bool:
    return isinstance(value, str) and "***" in value


def get_request_timeout_seconds(config: dict[str, Any]) -> int:
    return clamp_int(config.get("requestTimeoutSeconds"), 3, 40, 12)


async def parse_knowledge_upload_request(request_obj: Request) -> dict[str, Any]:
    body = await request_obj.body()
    content_type = request_obj.headers.get("content-type", "")
    if "multipart/form-data" in content_type.lower():
        return parse_multipart_upload(body, content_type)
    try:
        metadata = json.loads(body.decode("utf-8")) if body else {}
        if not isinstance(metadata, dict):
            metadata = {"description": str(metadata)}
    except Exception:
        metadata = {"description": body[:500].decode("utf-8", errors="ignore")}
    return {
        "metadata": metadata,
        "size": len(body),
        "fileName": metadata.get("fileName", "knowledge-inline.json"),
        "contentType": content_type or "application/json",
        "rawText": metadata.get("content") or metadata.get("description") or body[:4000].decode("utf-8", errors="ignore"),
    }


def parse_multipart_upload(body: bytes, content_type: str) -> dict[str, Any]:
    boundary_token = "boundary="
    boundary_index = content_type.find(boundary_token)
    if boundary_index < 0:
        return {"metadata": {}, "size": len(body), "fileName": "knowledge-upload.bin", "contentType": "application/octet-stream"}
    boundary = content_type[boundary_index + len(boundary_token) :].strip().strip('"')
    delimiter = ("--" + boundary).encode("utf-8")
    metadata: dict[str, Any] = {}
    file_name = "knowledge-upload.bin"
    file_content_type = "application/octet-stream"
    file_size = 0
    raw_text = ""
    for raw_part in body.split(delimiter):
        part = raw_part.strip(b"\r\n")
        if not part or part == b"--" or b"\r\n\r\n" not in part:
            continue
        header_blob, payload = part.split(b"\r\n\r\n", 1)
        headers = header_blob.decode("utf-8", errors="ignore")
        payload = payload.rstrip(b"\r\n-")
        if 'name="metadata"' in headers:
            try:
                parsed = json.loads(payload.decode("utf-8"))
                if isinstance(parsed, dict):
                    metadata = parsed
            except Exception:
                metadata = {"description": payload[:500].decode("utf-8", errors="ignore")}
        elif 'name="file"' in headers:
            file_size = len(payload)
            file_name = extract_multipart_filename(headers) or file_name
            file_content_type = extract_multipart_content_type(headers) or file_content_type
            raw_text = payload[:12000].decode("utf-8", errors="ignore")
    return {
        "metadata": metadata,
        "size": file_size if file_size > 0 else len(body),
        "fileName": file_name,
        "contentType": file_content_type,
        "rawText": raw_text or str(metadata.get("description", "")),
    }


def extract_multipart_filename(headers: str) -> str:
    marker = 'filename="'
    start = headers.find(marker)
    if start < 0:
        return ""
    start += len(marker)
    end = headers.find('"', start)
    return headers[start:end] if end > start else ""


def extract_multipart_content_type(headers: str) -> str:
    for line in headers.splitlines():
        if line.lower().startswith("content-type:"):
            return line.split(":", 1)[1].strip()
    return ""


def create_rag_document_record(metadata: dict[str, Any], body_size: int, file_info: dict[str, Any] | None = None) -> dict[str, Any]:
    file_info = file_info or {}
    document_id = str(metadata.get("documentId") or metadata.get("submissionId") or new_id("doc"))
    submitted_at = now_iso()
    document = {
        "documentId": document_id,
        "submissionId": str(metadata.get("submissionId") or document_id),
        "reviewId": str(metadata.get("reviewId") or f"review-{document_id}"),
        "title": str(metadata.get("title") or file_info.get("fileName") or "LOCAL DEMO uploaded document"),
        "fileName": str(file_info.get("fileName") or metadata.get("fileName") or "knowledge-upload.bin"),
        "contentType": str(file_info.get("contentType") or metadata.get("contentType") or "application/octet-stream"),
        "category": normalize_document_category(metadata.get("category")),
        "scopeApps": normalize_scope_apps(metadata.get("scopeApps") or metadata.get("scopeApp")),
        "tags": normalize_tags(metadata.get("tags")),
        "status": "PENDING_REVIEW",
        "indexStatus": "PENDING",
        "version": str(metadata.get("version") or KNOWLEDGE_VERSION),
        "sourceVersion": str(metadata.get("sourceVersion") or metadata.get("publishedVersion") or "UNVERSIONED"),
        "sourceOrganization": str(metadata.get("sourceOrganization") or "LOCAL DEMO upload"),
        "author": str(metadata.get("author") or ""),
        "publishedAt": str(metadata.get("publishedAt") or ""),
        "description": str(metadata.get("description") or ""),
        "size": body_size,
        "sha256": str(metadata.get("sha256") or hash_document_text(str(metadata.get("content") or file_info.get("rawText") or metadata.get("description") or ""))),
        "chunkCount": 0,
        "chunks": [],
        "rawText": str(metadata.get("content") or file_info.get("rawText") or metadata.get("description") or ""),
        "failureReason": "",
        "reviewNote": "",
        "submittedBy": str(metadata.get("submittedBy") or "LOCAL_DEMO_ADMIN"),
        "submittedAt": submitted_at,
        "reviewedBy": "",
        "reviewedAt": "",
        "updatedAt": submitted_at,
        "lineId": str(metadata.get("lineId") or ""),
        "stageCode": str(metadata.get("stageCode") or ""),
        "deviceCode": str(metadata.get("deviceCode") or ""),
        "bottleTypeCode": str(metadata.get("bottleTypeCode") or ""),
        "source": SOURCE_MARK,
        "note": "LOCAL DEMO: uploaded document waits for admin review before vector indexing.",
    }
    apply_document_classification(document, metadata)
    return document


def apply_document_classification(document: dict[str, Any], metadata: dict[str, Any]) -> None:
    if "category" in metadata:
        document["category"] = normalize_document_category(metadata.get("category"))
    if "scopeApps" in metadata or "scopeApp" in metadata:
        document["scopeApps"] = normalize_scope_apps(metadata.get("scopeApps") or metadata.get("scopeApp"))
    if "tags" in metadata:
        document["tags"] = normalize_tags(metadata.get("tags"))


def normalize_document_category(value: Any) -> str:
    category = str(value or "").strip().upper()
    return category if category else "UNCLASSIFIED"


def normalize_scope_apps(value: Any) -> list[str]:
    if value is None or value == "":
        return ["ALL"]
    raw_items = value if isinstance(value, list) else str(value).replace(";", ",").split(",")
    allowed = {"DISPLAY", "WORKSTATION", "ADMIN", "AI_CENTER", "ALL"}
    result: list[str] = []
    for item in raw_items:
        text = str(item).strip().upper()
        if text in allowed and text not in result:
            result.append(text)
    return result if result else ["ALL"]


def normalize_tags(value: Any) -> list[str]:
    if value is None:
        return []
    raw_items = value if isinstance(value, list) else str(value).replace(";", ",").split(",")
    result: list[str] = []
    for item in raw_items:
        text = str(item).strip()
        if text and text not in result:
            result.append(text)
    return result


def hash_document_text(text: str) -> str:
    if not text:
        return "LOCAL_DEMO_EMPTY_SHA256"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def index_document_chunks(document: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    if not config.get("knowledgeIndexEnabled", True):
        document["indexStatus"] = "FAILED"
        document["failureReason"] = "knowledgeIndexEnabled=false"
        document["chunks"] = []
        document["chunkCount"] = 0
        return document
    raw_text = str(document.get("rawText") or document.get("description") or document.get("title") or "")
    if not raw_text.strip():
        raw_text = (
            f"{document.get('title', 'Untitled')} {document.get('description', '')} "
            f"category={document.get('category', 'UNCLASSIFIED')} tags={','.join(normalize_tags(document.get('tags')))}"
        )
    chunks = split_document_chunks(raw_text, int(config.get("chunkSize", 800)), int(config.get("chunkOverlap", 120)))
    indexed_chunks: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        indexed_chunks.append(
            {
                "chunkId": f"{document.get('documentId', 'doc')}-chunk-{index + 1}",
                "ordinal": index + 1,
                "text": chunk,
                "lexicalTokens": lexical_tokens(chunk),
                "source": "LOCAL_DEMO_LEXICAL_VECTOR_ADAPTER",
            }
        )
    document["chunks"] = indexed_chunks
    document["chunkCount"] = len(indexed_chunks)
    document["status"] = "INDEXED"
    document["indexStatus"] = "READY"
    document["failureReason"] = ""
    document["indexedAt"] = now_iso()
    document["updatedAt"] = document["indexedAt"]
    document["source"] = SOURCE_MARK
    document["note"] = "LOCAL_DEMO: indexed by local lexical chunk adapter; replace vectorStoreType for production embeddings."
    return document


def split_document_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    normalized = " ".join(text.replace("\r", "\n").split())
    if not normalized:
        return []
    size = max(100, chunk_size)
    step = max(1, size - max(0, min(overlap, size - 1)))
    result: list[str] = []
    index = 0
    while index < len(normalized):
        result.append(normalized[index : index + size])
        index += step
    return result


def lexical_tokens(text: str) -> list[str]:
    cleaned = "".join(char.lower() if char.isalnum() else " " for char in text)
    tokens: list[str] = []
    for token in cleaned.split():
        if len(token) >= 2 and token not in tokens:
            tokens.append(token)
    return tokens[:80]


def search_rag_documents(state: AiCenterState, question: str, context: dict[str, Any]) -> list[dict[str, Any]]:
    source_app = str(context.get("sourceApp", "ALL"))
    query_tokens = lexical_tokens(question + " " + str(context.get("stageCode", "")) + " " + str(context.get("deviceCode", "")))
    scored: list[dict[str, Any]] = []
    for document in state.rag_documents.values():
        if document.get("status") != "INDEXED" or document.get("indexStatus") != "READY":
            continue
        if not document_visible_to_app(document, source_app):
            continue
        best_score = 0
        best_excerpt = ""
        for chunk in document.get("chunks", []):
            chunk_tokens = chunk.get("lexicalTokens", []) if isinstance(chunk, dict) else []
            score = len([token for token in query_tokens if token in chunk_tokens])
            if score >= best_score:
                best_score = score
                best_excerpt = str(chunk.get("text", "")) if isinstance(chunk, dict) else ""
        scored.append({"document": document, "score": best_score, "excerpt": best_excerpt})
    scored.sort(key=lambda item: int(item.get("score", 0)), reverse=True)
    return scored[: int(state.ai_config.get("ragTopK", 5))]


def document_visible_to_app(document: dict[str, Any], source_app: str) -> bool:
    scope_apps = normalize_scope_apps(document.get("scopeApps"))
    app = source_app.upper()
    return "ALL" in scope_apps or app in scope_apps or document.get("category") == "UNCLASSIFIED"


def find_document_by_any_id(state: AiCenterState, identifier: str) -> dict[str, Any] | None:
    if identifier in state.rag_documents:
        return state.rag_documents[identifier]
    for document in state.rag_documents.values():
        if identifier in (document.get("submissionId"), document.get("reviewId")):
            return document
    return None


def document_to_submission(document: dict[str, Any]) -> dict[str, Any]:
    scope_apps = normalize_scope_apps(document.get("scopeApps"))
    return {
        "submissionId": document.get("submissionId", document.get("documentId", "")),
        "knowledgeId": document.get("documentId", ""),
        "documentId": document.get("documentId", ""),
        "reviewId": document.get("reviewId", ""),
        "status": document.get("status", "PENDING_REVIEW"),
        "statusReason": document.get("failureReason") or document.get("reviewNote", ""),
        "fileName": document.get("fileName", ""),
        "contentType": document.get("contentType", ""),
        "size": int(document.get("size", 0) or 0),
        "sha256": document.get("sha256", "LOCAL_DEMO_NOT_HASHED"),
        "title": document.get("title", ""),
        "category": document.get("category", "UNCLASSIFIED"),
        "scopeApps": scope_apps,
        "scopeLabel": "全部端可读" if "ALL" in scope_apps else ",".join(scope_apps),
        "tags": normalize_tags(document.get("tags")),
        "sourceOrganization": document.get("sourceOrganization", ""),
        "author": document.get("author", ""),
        "publishedAt": document.get("publishedAt", ""),
        "sourceVersion": document.get("sourceVersion", ""),
        "description": document.get("description", ""),
        "scope": {
            "lineIds": [document["lineId"]] if document.get("lineId") else [],
            "stageCodes": [document["stageCode"]] if document.get("stageCode") else [],
            "deviceCodes": [document["deviceCode"]] if document.get("deviceCode") else [],
            "bottleTypeCodes": [document["bottleTypeCode"]] if document.get("bottleTypeCode") else [],
            "parameterCodes": [],
        },
        "submittedBy": document.get("submittedBy", ""),
        "submittedAt": document.get("submittedAt", ""),
        "reviewedBy": document.get("reviewedBy", ""),
        "reviewedAt": document.get("reviewedAt", ""),
        "reviewComment": document.get("reviewNote", ""),
        "knowledgeSourceId": document.get("documentId", ""),
        "publishedVersion": document.get("version", KNOWLEDGE_VERSION) if document.get("status") in ("APPROVED", "INDEXED") else "",
        "indexedAt": document.get("updatedAt", "") if document.get("indexStatus") == "READY" else "",
        "indexStatus": document.get("indexStatus", "PENDING"),
        "chunkCount": int(document.get("chunkCount", 0) or 0),
    }


def document_to_review(document: dict[str, Any]) -> dict[str, Any]:
    submission = document_to_submission(document)
    return {
        "reviewId": submission["reviewId"],
        "submission": submission,
        "preview": [
            {
                "blockId": f"{submission['submissionId']}-preview-1",
                "heading": "LOCAL DEMO parsed summary",
                "content": (
                    f"{submission['title']} belongs to category {submission['category']} and scope {submission['scopeLabel']}. "
                    "It is a local demo parsed block; production parsing/OCR/vectorization should replace this content."
                ),
                "pageNumber": 1,
            }
        ],
        "conflicts": [],
        "copyrightConfirmed": document.get("status") in ("APPROVED", "INDEXED"),
        "sourceVerified": bool(document.get("sourceOrganization")),
        "unitsVerified": True,
        "scopeVerified": bool(submission["scopeApps"]),
    }


async def run_ai_connection_test(config: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    if not config.get("knowledgeIndexEnabled", True):
        return {
            "ok": False,
            "status": "RAG_NOT_READY",
            "errorCode": "RAG_NOT_READY",
            "message": "RAG indexing is disabled in current config.",
            "elapsedMs": int((time.perf_counter() - started) * 1000),
            "config": mask_ai_config(config),
            "source": SOURCE_MARK,
        }
    if is_local_demo_provider(config):
        return {
            "ok": True,
            "status": "LOCAL_DEMO_READY",
            "message": "LOCAL DEMO model is ready; no external provider was called.",
            "elapsedMs": int((time.perf_counter() - started) * 1000),
            "config": mask_ai_config(config),
            "source": SOURCE_MARK,
        }
    if not str(config.get("baseUrl", "")).strip():
        return make_test_error("CONFIG_MISSING_BASE_URL", "Model baseUrl is required.", started, config)
    if not str(config.get("apiKey", "")).strip():
        return make_test_error("AUTH_FAILED", "API Key is required.", started, config)
    result = await generate_model_or_demo_answer(config, "Return exactly: AI_CONNECTION_OK", {})
    result["elapsedMs"] = int((time.perf_counter() - started) * 1000)
    result["config"] = mask_ai_config(config)
    if result["ok"]:
        result["status"] = "PROVIDER_READY"
        result["message"] = "AI provider returned a valid response."
    return result


async def generate_model_or_demo_answer(config: dict[str, Any], question: str, context: dict[str, Any]) -> dict[str, Any]:
    if is_local_demo_provider(config):
        return {
            "ok": True,
            "status": "LOCAL_DEMO_READY",
            "message": "LOCAL DEMO response generated.",
            "answer": build_local_demo_answer(question),
            "provider": config.get("provider"),
            "modelName": config.get("modelName"),
            "source": SOURCE_MARK,
        }
    try:
        answer = await asyncio.wait_for(
            asyncio.to_thread(call_openai_compatible_chat, config, question, context),
            timeout=get_request_timeout_seconds(config) + 1,
        )
        return {
            "ok": True,
            "status": "PROVIDER_READY",
            "message": "AI provider returned a valid response.",
            "answer": answer,
            "provider": config.get("provider"),
            "modelName": config.get("modelName"),
            "source": "AI_PROVIDER",
        }
    except asyncio.TimeoutError:
        return make_generation_error("NETWORK_TIMEOUT", "AI provider timed out before returning a response.", config)
    except Exception as exc:
        code, message = classify_ai_provider_error(exc)
        return make_generation_error(code, message, config)


def is_local_demo_provider(config: dict[str, Any]) -> bool:
    return str(config.get("provider", "LOCAL_DEMO")).upper() in ("", "LOCAL_DEMO", "SIMULATION", "MOCK")


def build_local_demo_answer(question: str) -> str:
    return (
        "[LOCAL DEMO][SIMULATION] This answer is generated by the local demo assistant, "
        "not by a production LLM provider. It uses page context, simulated production facts, "
        f"and simulated RAG citations. Question: {question[:120]}. "
    )


def call_openai_compatible_chat(config: dict[str, Any], question: str, context: dict[str, Any]) -> str:
    url = build_chat_completions_url(str(config.get("baseUrl", "")))
    payload = {
        "model": config.get("modelName", "gpt-compatible-model"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a read-only bottling factory assistant. "
                    "Never create commands, release manual locks, approve knowledge, or change production state."
                ),
            },
            {
                "role": "user",
                "content": f"Context JSON: {json.dumps(context, ensure_ascii=False)}\nQuestion: {question}",
            },
        ],
        "temperature": config.get("temperature", 0.2),
        "max_tokens": config.get("maxTokens", 800),
        "stream": False,
    }
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json;charset=UTF-8",
            "Authorization": f"Bearer {config.get('apiKey', '')}",
        },
    )
    with request.urlopen(req, timeout=get_request_timeout_seconds(config)) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        choices = parsed.get("choices") if isinstance(parsed, dict) else None
        if not choices:
            raise RuntimeError("MODEL_EMPTY_RESPONSE")
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not content:
            raise RuntimeError("MODEL_EMPTY_RESPONSE")
        return str(content).strip()


def build_chat_completions_url(base_url: str) -> str:
    value = base_url.strip().rstrip("/")
    if value.endswith("/chat/completions"):
        return value
    if value.endswith("/v1"):
        return f"{value}/chat/completions"
    return f"{value}/v1/chat/completions"


def classify_ai_provider_error(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, error.HTTPError):
        status = exc.code
        detail = safe_read_http_error(exc)
        if status in (401, 403):
            return "AUTH_FAILED", f"Authentication failed with HTTP {status}."
        if status == 404:
            return "MODEL_NOT_FOUND", "Model or endpoint was not found."
        if status == 429:
            return "RATE_LIMITED", "AI provider rate limit was reached."
        if status in (408, 504):
            return "NETWORK_TIMEOUT", f"AI provider timed out with HTTP {status}."
        return "PROVIDER_HTTP_ERROR", f"AI provider returned HTTP {status}. {detail}"[:300]
    if isinstance(exc, (error.URLError, TimeoutError, OSError)):
        return "NETWORK_TIMEOUT", "AI provider network request timed out or could not connect."
    message = str(exc)
    if "MODEL_EMPTY_RESPONSE" in message:
        return "MODEL_EMPTY_RESPONSE", "AI provider returned no answer content."
    return "PROVIDER_ERROR", message[:300] if message else "AI provider failed."


def safe_read_http_error(exc: error.HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8")
        return body[:200]
    except Exception:
        return ""


def make_test_error(code: str, message: str, started: float, config: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": False,
        "status": code,
        "errorCode": code,
        "message": message,
        "elapsedMs": int((time.perf_counter() - started) * 1000),
        "config": mask_ai_config(config),
        "source": SOURCE_MARK,
    }


def make_generation_error(code: str, message: str, config: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": False,
        "status": code,
        "errorCode": code,
        "message": message,
        "answer": "",
        "provider": config.get("provider"),
        "modelName": config.get("modelName"),
        "source": SOURCE_MARK,
    }


async def create_assistant_message(
    state: AiCenterState,
    conversation_id: str,
    request_body: dict[str, Any],
    retry_of: str | None,
) -> dict[str, Any]:
    question = str(request_body.get("question", "")).strip()
    if not question:
        return error_envelope("question is required", 400)
    context = request_body.get("context") if isinstance(request_body.get("context"), dict) else {}
    question_type = request_body.get("questionType", "FREE_TEXT")
    user_message = {
        "messageId": new_id("usr"),
        "role": "USER",
        "content": question,
        "status": "COMPLETED",
        "questionType": question_type,
        "context": context,
        "createdAt": now_iso(),
    }
    assistant_message_id = new_id("msg")
    assistant_message = {
        "messageId": assistant_message_id,
        "role": "ASSISTANT",
        "content": "",
        "status": "STREAMING",
        "answerMode": decide_answer_mode(question, context),
        "dataGeneratedAt": now_iso(),
        "stateVersion": context_state_version(context),
        "knowledgeVersion": KNOWLEDGE_VERSION,
        "citations": make_citations(state, context),
        "createdAt": now_iso(),
        "retryOf": retry_of,
        "source": SOURCE_MARK,
    }
    state.messages[conversation_id].extend([user_message, assistant_message])
    state.active_messages[assistant_message_id] = {"conversationId": conversation_id, "cancelled": False}
    await state.events.publish(
        {
            "type": "ai.conversation.started",
            "conversationId": conversation_id,
            "messageId": assistant_message_id,
            "status": "STREAMING",
            "dataGeneratedAt": assistant_message["dataGeneratedAt"],
            "stateVersion": assistant_message["stateVersion"],
            "knowledgeVersion": assistant_message["knowledgeVersion"],
            "citations": assistant_message["citations"],
        }
    )
    try:
        chunks = await asyncio.wait_for(
            build_answer_chunks(state, question, context),
            timeout=get_request_timeout_seconds(state.ai_config) + 1,
        )
    except asyncio.TimeoutError:
        assistant_message["status"] = "FAILED"
        assistant_message["content"] = (
            "[LOCAL DEMO][AI_PROVIDER_TIMEOUT] The AI provider did not return before the configured timeout. "
            "No command was created and no production state was changed. Please check model/baseUrl/apiKey/timeout in admin AI settings."
        )
        state.active_messages.pop(assistant_message_id, None)
        await state.events.publish(
            {
                "type": "ai.conversation.failed",
                "conversationId": conversation_id,
                "messageId": assistant_message_id,
                "status": "FAILED",
                "code": "AI_PROVIDER_TIMEOUT",
                "content": assistant_message["content"],
                "dataGeneratedAt": assistant_message["dataGeneratedAt"],
                "stateVersion": assistant_message["stateVersion"],
                "knowledgeVersion": assistant_message["knowledgeVersion"],
                "citations": assistant_message["citations"],
            }
        )
        persist_state(state)
        return envelope(to_message_result(assistant_message), message="AI provider timeout", code=1)
    content_parts: list[str] = []
    delay = 0.08 if "slow" in question.lower() or "慢" in question else 0.02
    for chunk in chunks:
        active = state.active_messages.get(assistant_message_id)
        if active is None or active.get("cancelled"):
            assistant_message["status"] = "STOPPED"
            assistant_message["content"] = "".join(content_parts) + "\n\n[LOCAL DEMO] 本次回答已停止，未创建任何命令。"
            await state.events.publish(
                {
                    "type": "ai.conversation.stopped",
                    "conversationId": conversation_id,
                    "messageId": assistant_message_id,
                    "status": "STOPPED",
                    "content": assistant_message["content"],
                    "dataGeneratedAt": assistant_message["dataGeneratedAt"],
                    "stateVersion": assistant_message["stateVersion"],
                    "knowledgeVersion": assistant_message["knowledgeVersion"],
                    "citations": assistant_message["citations"],
                }
            )
            state.active_messages.pop(assistant_message_id, None)
            persist_state(state)
            return envelope(to_message_result(assistant_message))
        content_parts.append(chunk)
        assistant_message["content"] = "".join(content_parts)
        await state.events.publish(
            {
                "type": "ai.conversation.delta",
                "conversationId": conversation_id,
                "messageId": assistant_message_id,
                "status": "STREAMING",
                "delta": chunk,
            }
        )
        await asyncio.sleep(delay)
    assistant_message["status"] = "COMPLETED"
    assistant_message["content"] = "".join(content_parts)
    state.conversations[conversation_id]["updatedAt"] = now_iso()
    state.active_messages.pop(assistant_message_id, None)
    await state.events.publish(
        {
            "type": "ai.conversation.completed",
            "conversationId": conversation_id,
            "messageId": assistant_message_id,
            "status": "COMPLETED",
            "content": assistant_message["content"],
            "dataGeneratedAt": assistant_message["dataGeneratedAt"],
            "stateVersion": assistant_message["stateVersion"],
            "knowledgeVersion": assistant_message["knowledgeVersion"],
            "citations": assistant_message["citations"],
        }
    )
    persist_state(state)
    return envelope(to_message_result(assistant_message))


async def stop_active_message(state: AiCenterState, conversation_id: str, message_id: str | None) -> bool:
    targets = []
    for active_id, active in state.active_messages.items():
        if active.get("conversationId") == conversation_id and (message_id is None or active_id == message_id):
            targets.append(active_id)
    for active_id in targets:
        state.active_messages[active_id]["cancelled"] = True
    if not targets and message_id is not None:
        message = find_message(state, conversation_id, message_id)
        if message is not None and message.get("status") == "STREAMING":
            message["status"] = "STOPPED"
            message["content"] = (message.get("content") or "") + "\n\n[LOCAL DEMO] 本次回答已停止。"
            await state.events.publish(
                {
                    "type": "ai.conversation.stopped",
                    "conversationId": conversation_id,
                    "messageId": message_id,
                    "status": "STOPPED",
                    "content": message["content"],
                    "dataGeneratedAt": message.get("dataGeneratedAt"),
                    "stateVersion": message.get("stateVersion"),
                    "knowledgeVersion": message.get("knowledgeVersion"),
                    "citations": message.get("citations", []),
                }
            )
            persist_state(state)
            return True
    return len(targets) > 0


def find_message(state: AiCenterState, conversation_id: str, message_id: str) -> dict[str, Any] | None:
    for message in state.messages.get(conversation_id, []):
        if message.get("messageId") == message_id:
            return message
    return None


def last_user_message(state: AiCenterState, conversation_id: str) -> dict[str, Any] | None:
    for message in reversed(state.messages.get(conversation_id, [])):
        if message.get("role") == "USER":
            return message
    return None


def previous_user_message(state: AiCenterState, conversation_id: str, message_id: str) -> dict[str, Any] | None:
    previous: dict[str, Any] | None = None
    for message in state.messages.get(conversation_id, []):
        if message.get("messageId") == message_id:
            return previous
        if message.get("role") == "USER":
            previous = message
    return previous


def to_message_result(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "messageId": message["messageId"],
        "content": message["content"],
        "answerMode": message["answerMode"],
        "dataGeneratedAt": message.get("dataGeneratedAt"),
        "stateVersion": message.get("stateVersion"),
        "knowledgeVersion": message.get("knowledgeVersion"),
        "citations": message.get("citations", []),
        "createdAt": message["createdAt"],
        "status": message.get("status"),
        "source": SOURCE_MARK,
    }


def decide_answer_mode(question: str, context: dict[str, Any]) -> str:
    if context.get("stateVersion") is not None and any(word in question for word in ["当前", "实时", "现在", "报警", "状态"]):
        return "REALTIME"
    if any(word.lower() in question.lower() for word in ["rag", "知识", "文档", "规范", "为什么"]):
        return "RAG"
    return "HYBRID"


async def build_answer_chunks(state: AiCenterState, question: str, context: dict[str, Any]) -> list[str]:
    facts = fetch_backend_facts(context)
    selection = context.get("selection") if isinstance(context.get("selection"), dict) else None
    scope = describe_scope(context, selection)
    if looks_like_control_request(question):
        text = (
            f"[LOCAL DEMO][SIMULATION] 我识别到这是控制/调参类问题，但助手问答通道是只读的，"
            f"不会创建命令、不会释放人工锁、不会改变生产状态。当前范围：{scope}。"
            "正式操作应由工位端或后台通过 HTTP 创建命令，生产后端再校验 RBAC、人工锁、版本、范围、联锁和边缘 ACK。"
        )
    else:
        model_result = await generate_model_or_demo_answer(state.ai_config, question, context)
        if model_result["ok"]:
            answer = model_result["answer"]
        else:
            answer = (
                f"[LOCAL DEMO][{model_result['errorCode']}] AI provider is unavailable, so this response falls back to local demo knowledge. "
                f"Reason: {model_result['message']}. "
            )
        text = (
            f"{answer}"
            f" Scope: {scope}. "
            f"Production facts source: {facts['source']}, stateVersion={facts.get('stateVersion')}. "
            f"Question summary: {question[:120]}. "
            "For realtime questions, verify dataGeneratedAt/stateVersion; for process knowledge, verify cited knowledgeVersion."
        )
    return split_chunks(text, 38)


def split_chunks(text: str, size: int) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)]


def describe_scope(context: dict[str, Any], selection: dict[str, Any] | None) -> str:
    parts = [
        f"sourceApp={context.get('sourceApp', 'UNKNOWN')}",
        f"pageRoute={context.get('pageRoute', '-')}",
    ]
    for key in ["lineId", "stageCode", "deviceCode", "traceCode"]:
        if context.get(key):
            parts.append(f"{key}={context[key]}")
    if selection:
        parts.append(f"selection={selection.get('entityType')}:{selection.get('entityId')}")
    return ", ".join(parts)


def looks_like_control_request(question: str) -> bool:
    keywords = ["改为", "调整", "设置", "下发", "启动", "停止", "暂停", "复位", "change", "set ", "start", "stop"]
    lowered = question.lower()
    return any(keyword in question or keyword in lowered for keyword in keywords)


def make_citations(state: AiCenterState, context: dict[str, Any]) -> list[dict[str, Any]]:
    stage = context.get("stageCode", "GENERAL")
    documents = search_rag_documents(state, str(context.get("selection", "")), context)
    return [
        {
            "citationId": "sim-cite-" + str(item["document"].get("documentId", "unknown")),
            "title": str(item["document"].get("title", "LOCAL DEMO knowledge document")),
            "source": str(item["document"].get("source", SOURCE_MARK)),
            "version": str(item["document"].get("version", KNOWLEDGE_VERSION)),
            "excerpt": (
                (str(item.get("excerpt", ""))[:220] or "LOCAL DEMO indexed RAG chunk. ") +
                f" category={item['document'].get('category', 'UNCLASSIFIED')}, " +
                f"scopeApps={','.join(normalize_scope_apps(item['document'].get('scopeApps')))}."
            ),
            "entity": {"entityType": "KNOWLEDGE_DOCUMENT", "entityId": item["document"].get("documentId", ""), "stageCode": stage},
        }
        for item in documents[:3]
    ]


def fetch_backend_facts(context: dict[str, Any]) -> dict[str, Any]:
    backend_base = os.getenv("PRODUCTION_BACKEND_BASE_URL", DEFAULT_BACKEND_BASE_URL).rstrip("/")
    query = {
        "sourceApp": str(context.get("sourceApp") or "AI_CENTER"),
        "lineId": str(context.get("lineId") or ""),
        "stageCode": str(context.get("stageCode") or ""),
        "deviceCode": str(context.get("deviceCode") or ""),
        "traceCode": str(context.get("traceCode") or ""),
    }
    query_text = parse.urlencode({key: value for key, value in query.items() if value})
    try:
        url = f"{backend_base}/ai-integration/facts"
        if query_text:
            url = f"{url}?{query_text}"
        req = build_backend_request(url, None, context, "GET")
        with request.urlopen(req, timeout=0.7) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            data = parsed.get("data") if isinstance(parsed, dict) and isinstance(parsed.get("data"), dict) else parsed
            if isinstance(data, dict):
                data["source"] = f"PRODUCTION_BACKEND {backend_base}"
                data.setdefault("status", response.status)
                data.setdefault("stateVersion", context.get("stateVersion"))
                return data
            return {"source": f"PRODUCTION_BACKEND {backend_base}", "status": response.status, "stateVersion": context.get("stateVersion")}
    except (error.URLError, TimeoutError, OSError):
        fallback = make_local_facts(context)
        fallback["source"] = "LOCAL_DEMO_FALLBACK: production backend facts unavailable"
        return fallback


def submit_command_intent_to_backend(payload: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
    backend_base = os.getenv("PRODUCTION_BACKEND_BASE_URL", DEFAULT_BACKEND_BASE_URL).rstrip("/")
    try:
        req = build_backend_request(f"{backend_base}/ai-integration/command-intents", payload, auth, "POST")
        with request.urlopen(req, timeout=2.5) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            return {
                "status": "PENDING_BACKEND_GATE",
                "safeGate": "PRODUCTION_BACKEND_ACCEPTED: waiting for backend safety validation and edge ACK.",
                "backendResponse": parsed,
                "source": f"PRODUCTION_BACKEND {backend_base}",
            }
    except (error.URLError, TimeoutError, OSError) as exc:
        return {
            "status": "LOCAL_DEMO_BACKEND_UNAVAILABLE",
            "safeGate": "LOCAL_DEMO_FALLBACK: production backend was not reachable; no command was created or executed.",
            "backendResponse": {"error": str(exc)[:240]},
            "source": SOURCE_MARK,
        }


def build_backend_request(
    url: str,
    payload: dict[str, Any] | None,
    subject: dict[str, Any],
    method: str,
) -> request.Request:
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        # Spring Boot validates this service credential from Authorization.
        "Authorization": f"Bearer {os.getenv('PRODUCTION_BACKEND_SERVICE_TOKEN', 'dev-ai-service-token')}",
        "X-Subject-User": str(subject.get("authenticatedUserId") or subject.get("userId") or "unknown"),
        "X-Client-Type": str(subject.get("sourceApp") or "AI_CENTER"),
    }
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    return request.Request(url, data=data, method=method, headers=headers)


def make_local_facts(context: dict[str, Any] | None = None) -> dict[str, Any]:
    context = context or {}
    return {
        "source": SOURCE_MARK,
        "lineId": context.get("lineId", "LINE-LOCAL-DEMO"),
        "stageCode": context.get("stageCode", "PRETREATMENT"),
        "stateVersion": context.get("stateVersion", int(time.time())),
        "dataGeneratedAt": now_iso(),
        "devices": [
            {"deviceCode": "GAS-SENSOR-01", "status": "RUNNING", "reading": "VOC 0.18ppm", "manualLocked": False},
            {"deviceCode": "FILLER-01", "status": "RUNNING", "reading": "flow 118ml/s", "manualLocked": True},
        ],
        "note": "LOCAL DEMO / SIMULATION facts; not production telemetry.",
    }


def make_demo_decision(request_body: dict[str, Any] | None = None) -> dict[str, Any]:
    request_body = request_body or {}
    decision_id = new_id("decision")
    return {
        "decisionId": decision_id,
        "status": "SUGGESTED",
        "source": SOURCE_MARK,
        "createdAt": now_iso(),
        "reason": "SIMULATION: bottle type and current facts suggest checking non-manual-locked parameters only.",
        "fieldPatches": [
            {
                "deviceCode": "GAS-SENSOR-01",
                "parameterCode": "sample_interval_ms",
                "suggestedValue": 500,
                "unit": "ms",
                "manualLocked": False,
            }
        ],
        "blockedChanges": [
            {
                "deviceCode": "FILLER-01",
                "parameterCode": "flow_rate",
                "reason": "manual override lock exists; AI cannot modify this field.",
            }
        ],
        "commandIntent": {
            "status": "NOT_SUBMITTED",
            "reason": "LOCAL DEMO only. Submit through production backend /ai-integration/command-intents after safety validation.",
        },
        "input": request_body,
    }
