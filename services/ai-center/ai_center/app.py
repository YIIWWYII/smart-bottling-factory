from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from functools import wraps
from typing import Any
from urllib import error, request

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


API_PREFIX = "/api"
SOURCE_MARK = "LOCAL DEMO / SIMULATION"
KNOWLEDGE_VERSION = "SIMULATION-KB-2026.07"
DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8088/hdc/api"


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

    async def history(self, conversation_id: str | None = None) -> list[dict[str, Any]]:
        async with self._lock:
            events = deepcopy(self._history)
        if conversation_id is None:
            return events
        return [event for event in events if event.get("conversationId") == conversation_id]


class AiCenterState:
    def __init__(self) -> None:
        self.conversations: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, list[dict[str, Any]]] = {}
        self.active_messages: dict[str, dict[str, Any]] = {}
        self.knowledge_submissions: dict[str, dict[str, Any]] = {}
        self.decisions: dict[str, dict[str, Any]] = {}
        self.recognitions: dict[str, dict[str, Any]] = {}
        self.command_intents: dict[str, dict[str, Any]] = {}
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

    @app.get(f"{API_PREFIX}/health")
    async def health() -> dict[str, Any]:
        return envelope(
            {
                "service": "ai-center",
                "status": "UP",
                "port": int(os.getenv("AI_CENTER_PORT", "8091")),
                "apiPrefix": API_PREFIX,
                "source": SOURCE_MARK,
                "time": now_iso(),
            }
        )

    @app.websocket(f"{API_PREFIX}/assistant/events")
    async def assistant_events(websocket: WebSocket) -> None:
        conversation_filter = websocket.query_params.get("conversationId")
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
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await state.events.disconnect(websocket)
        except Exception:
            await state.events.disconnect(websocket)

    @app.get(f"{API_PREFIX}/assistant/events/history")
    async def assistant_event_history(conversationId: str | None = None) -> dict[str, Any]:
        return envelope({"events": await state.events.history(conversationId), "source": SOURCE_MARK})

    @app.get(f"{API_PREFIX}/assistant/conversations")
    async def list_conversations() -> dict[str, Any]:
        items = sorted(state.conversations.values(), key=lambda item: item["createdAt"], reverse=True)
        return envelope({"items": items, "source": SOURCE_MARK})

    @app.post(f"{API_PREFIX}/assistant/conversations")
    async def create_conversation(request_body: dict[str, Any]) -> dict[str, Any]:
        context = request_body.get("context") if isinstance(request_body.get("context"), dict) else {}
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
        submission_id = new_id("know")
        body = await request.body()
        submission = {
            "knowledgeId": submission_id,
            "status": "PENDING_REVIEW",
            "indexStatus": "NOT_INDEXED",
            "source": SOURCE_MARK,
            "note": "LOCAL DEMO: file/body accepted as a review placeholder; not indexed until approved.",
            "size": len(body),
            "createdAt": now_iso(),
        }
        state.knowledge_submissions[submission_id] = submission
        return envelope(submission)

    @app.get(f"{API_PREFIX}/knowledge/submissions/{{knowledge_id}}")
    async def knowledge_submission(knowledge_id: str) -> dict[str, Any]:
        item = state.knowledge_submissions.get(knowledge_id)
        if item is None:
            return error_envelope("knowledge submission not found", 404)
        return envelope(item)

    @app.get(f"{API_PREFIX}/admin/knowledge/reviews")
    async def list_reviews() -> dict[str, Any]:
        return envelope({"items": list(state.knowledge_submissions.values()), "source": SOURCE_MARK})

    @app.get(f"{API_PREFIX}/admin/knowledge/reviews/{{knowledge_id}}")
    async def get_review(knowledge_id: str) -> dict[str, Any]:
        return await knowledge_submission(knowledge_id)

    @app.post(f"{API_PREFIX}/admin/knowledge/reviews/{{knowledge_id}}/{{action}}")
    async def review_action(knowledge_id: str, action: str, request_body: dict[str, Any] | None = None) -> dict[str, Any]:
        item = state.knowledge_submissions.get(knowledge_id)
        if item is None:
            item = {
                "knowledgeId": knowledge_id,
                "createdAt": now_iso(),
                "source": SOURCE_MARK,
            }
            state.knowledge_submissions[knowledge_id] = item
        status_by_action = {
            "approve": ("INDEXED", "APPROVED"),
            "reject": ("REJECTED", "REJECTED"),
            "revoke": ("REVOKED", "REVOKED"),
        }
        if action not in status_by_action:
            return error_envelope("unsupported review action", 400)
        index_status, status = status_by_action[action]
        item.update(
            {
                "status": status,
                "indexStatus": index_status,
                "reviewNote": (request_body or {}).get("note", "LOCAL DEMO review action"),
                "reviewedAt": now_iso(),
            }
        )
        return envelope(item)

    @app.api_route(f"{API_PREFIX}/ai-integration/facts", methods=["GET", "POST"])
    async def local_backend_facts() -> dict[str, Any]:
        return envelope(make_local_facts())

    @app.post(f"{API_PREFIX}/ai-integration/recognitions")
    async def accept_backend_recognition(request_body: dict[str, Any]) -> dict[str, Any]:
        recognition_id = new_id("recog")
        item = {"recognitionId": recognition_id, "status": "ACCEPTED", "payload": request_body, "source": SOURCE_MARK, "createdAt": now_iso()}
        state.recognitions[recognition_id] = item
        return envelope(item)

    @app.post(f"{API_PREFIX}/ai-integration/command-intents")
    async def accept_command_intent(request_body: dict[str, Any]) -> dict[str, Any]:
        intent_id = new_id("intent")
        item = {
            "intentId": intent_id,
            "status": "PENDING_BACKEND_GATE",
            "safeGate": "LOCAL DEMO: no device state changed; production backend must validate RBAC/manual locks/version/range/interlocks.",
            "payload": request_body,
            "source": SOURCE_MARK,
            "createdAt": now_iso(),
        }
        state.command_intents[intent_id] = item
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


def build_conversation_title(context: dict[str, Any]) -> str:
    source_app = context.get("sourceApp", "UNKNOWN")
    stage = context.get("stageCode") or context.get("pageRoute") or "factory"
    return f"{source_app} assistant - {stage}"


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
        "citations": make_citations(context),
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
        }
    )
    chunks = build_answer_chunks(question, context)
    content_parts: list[str] = []
    delay = 0.2 if "slow" in question.lower() or "慢" in question else 0.03
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
                }
            )
            state.active_messages.pop(assistant_message_id, None)
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
        }
    )
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
                }
            )
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


def build_answer_chunks(question: str, context: dict[str, Any]) -> list[str]:
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
        text = (
            f"[LOCAL DEMO][SIMULATION] 当前回答基于页面上下文、可见选择对象和模拟知识库生成。范围：{scope}。"
            f"生产事实来源：{facts['source']}，stateVersion={facts.get('stateVersion')}。"
            f"问题摘要：{question[:120]}。"
            "若是实时状态问题，请以回答中的 dataGeneratedAt/stateVersion 为准；若是工艺知识问题，请以后续引用版本为准。"
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


def make_citations(context: dict[str, Any]) -> list[dict[str, Any]]:
    stage = context.get("stageCode", "GENERAL")
    return [
        {
            "citationId": "sim-cite-process-001",
            "title": "LOCAL DEMO 工艺知识片段",
            "source": "SIMULATION knowledge base",
            "version": KNOWLEDGE_VERSION,
            "excerpt": "模拟知识：PLA 瓶生产后需冷却、清洗、风洗并通过气体安全检测后进入灌装。",
            "entity": {"entityType": "STAGE", "entityId": stage, "stageCode": stage},
        }
    ]


def fetch_backend_facts(context: dict[str, Any]) -> dict[str, Any]:
    backend_base = os.getenv("PRODUCTION_BACKEND_BASE_URL", DEFAULT_BACKEND_BASE_URL).rstrip("/")
    payload = {
        "context": context,
        "requestedAt": now_iso(),
        "source": "AI_CENTER_READ_ONLY_TOOL",
    }
    try:
        req = request.Request(
            f"{backend_base}/ai-integration/facts",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json;charset=UTF-8"},
        )
        with request.urlopen(req, timeout=0.7) as response:
            return {"source": f"PRODUCTION_BACKEND {backend_base}", "status": response.status, "stateVersion": context.get("stateVersion")}
    except (error.URLError, TimeoutError, OSError):
        return make_local_facts(context)


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
