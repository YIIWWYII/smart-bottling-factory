from __future__ import annotations

import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib import request
from urllib.error import HTTPError


ROOT = Path(__file__).resolve().parents[1]
LOCAL_PYTHON_PACKAGES = Path(r"D:\HarmonyOS-Dev\python-packages")
HOST = "127.0.0.1"
PORT = int(os.getenv("AI_CENTER_SMOKE_PORT", "8091"))
BASE = f"http://{HOST}:{PORT}/api"
FAKE_BACKEND_PORT = int(os.getenv("AI_CENTER_FAKE_BACKEND_PORT", "18088"))
SMOKE_DATA_DIR = Path(r"D:\HarmonyOS-Dev\Temp\ai-center-smoke-data")


def http_json(
    method: str,
    path: str,
    payload: dict | None = None,
    timeout: float = 10.0,
    token: str = "LOCAL_DEMO",
    client_type: str = "ADMIN",
) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json;charset=UTF-8",
            "Authorization": f"Bearer {token}",
            "X-Client-Type": client_type,
        },
    )
    with request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)


def expect_http_error(method: str, path: str, status: int, token: str = "", client_type: str = "") -> None:
    try:
        http_json(method, path, None, token=token, client_type=client_type)
    except HTTPError as exc:
        if exc.code != status:
            raise AssertionError(f"expected HTTP {status}, got {exc.code}")
        return
    raise AssertionError(f"expected HTTP {status}, request succeeded")


def wait_health(timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            health = http_json("GET", "/health", None, timeout=1.0)
            if health["data"]["status"] == "UP":
                return
        except Exception as exc:
            last_error = exc
            time.sleep(0.25)
    raise RuntimeError(f"AI center did not become healthy: {last_error}")


def start_server() -> subprocess.Popen:
    env = os.environ.copy()
    python_paths = [str(ROOT)]
    if LOCAL_PYTHON_PACKAGES.exists():
        python_paths.append(str(LOCAL_PYTHON_PACKAGES))
    env["PYTHONPATH"] = os.pathsep.join(python_paths)
    env["AI_CENTER_PORT"] = str(PORT)
    env["AI_CENTER_DATA_DIR"] = str(SMOKE_DATA_DIR)
    env["PRODUCTION_BACKEND_BASE_URL"] = f"http://{HOST}:{FAKE_BACKEND_PORT}/api"
    env["PRODUCTION_BACKEND_SERVICE_TOKEN"] = "SMOKE_SERVICE_TOKEN"
    return subprocess.Popen(
        [sys.executable, "-m", "ai_center", "--host", HOST, "--port", str(PORT)],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


class WebSocketClient:
    def __init__(self, path: str, token: str = "LOCAL_DEMO", client_type: str = "DISPLAY") -> None:
        self.sock = socket.create_connection((HOST, PORT), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request_text = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {HOST}:{PORT}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            f"Authorization: Bearer {token}\r\n"
            f"X-Client-Type: {client_type}\r\n\r\n"
        )
        self.sock.sendall(request_text.encode("ascii"))
        response = self.sock.recv(4096).decode("latin1")
        if "101 Switching Protocols" not in response:
            raise RuntimeError(f"websocket handshake failed: {response}")

    def recv_json(self, timeout: float = 10.0) -> dict:
        self.sock.settimeout(timeout)
        first = self.sock.recv(2)
        if len(first) < 2:
            raise RuntimeError("websocket closed")
        _fin_opcode, second = first
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self.sock.recv(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self.sock.recv(8))[0]
        payload = b""
        while len(payload) < length:
            payload += self.sock.recv(length - len(payload))
        return json.loads(payload.decode("utf-8"))

    def close(self) -> None:
        self.sock.close()


class FakeBackendState:
    facts_calls: int = 0
    command_calls: int = 0


class FakeBackendHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}
        if self.path == "/api/ai-integration/facts":
            FakeBackendState.facts_calls += 1
            self.write_json(
                {
                    "code": 0,
                    "message": "OK",
                    "success": True,
                    "data": {
                        "source": "FAKE_PRODUCTION_BACKEND",
                        "stateVersion": 99001,
                        "dataGeneratedAt": "2026-07-30T00:00:00Z",
                        "payloadEcho": payload,
                    },
                }
            )
            return
        if self.path == "/api/ai-integration/command-intents":
            FakeBackendState.command_calls += 1
            self.write_json(
                {
                    "code": 0,
                    "message": "ACCEPTED",
                    "success": True,
                    "data": {
                        "commandId": "cmd-smoke-001",
                        "status": "PENDING",
                        "source": "FAKE_PRODUCTION_BACKEND",
                    },
                }
            )
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def write_json(self, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json;charset=UTF-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def start_fake_backend() -> HTTPServer:
    server = HTTPServer((HOST, FAKE_BACKEND_PORT), FakeBackendHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def assert_envelope(result: dict, label: str) -> dict:
    if not result.get("success"):
        raise AssertionError(f"{label} failed: {result}")
    return result["data"]


def main() -> None:
    if SMOKE_DATA_DIR.exists():
        shutil.rmtree(SMOKE_DATA_DIR)
    SMOKE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    fake_backend = start_fake_backend()
    process = start_server()
    try:
        wait_health()
        print("health OK")

        expect_http_error("GET", "/admin/ai/config", 401, token="", client_type="ADMIN")
        expect_http_error("GET", "/admin/ai/config", 403, token="DISPLAY_DEMO", client_type="DISPLAY")
        print("security negative auth/rbac OK")

        config = assert_envelope(http_json("GET", "/admin/ai/config"), "get ai config")
        if config["config"]["provider"] != "LOCAL_DEMO":
            raise AssertionError(f"unexpected default provider: {config}")
        if "hasApiKey" not in config["config"]:
            raise AssertionError(f"config did not mask key metadata: {config}")
        print("ai config read OK")

        updated_config = assert_envelope(
            http_json(
                "PUT",
                "/admin/ai/config",
                {
                    "provider": "LOCAL_DEMO",
                    "modelName": "local-demo-assistant",
                    "apiKey": "secret-key-for-smoke-test",
                    "requestTimeoutSeconds": 5,
                    "ragTopK": 4,
                    "chunkSize": 600,
                    "chunkOverlap": 80,
                },
            ),
            "update ai config",
        )
        if updated_config["config"]["apiKey"] == "secret-key-for-smoke-test" or not updated_config["config"]["hasApiKey"]:
            raise AssertionError(f"api key was not masked: {updated_config}")
        print("ai config update/mask OK")

        connection = assert_envelope(http_json("POST", "/admin/ai/config/test"), "test ai config")
        if connection["status"] != "LOCAL_DEMO_READY":
            raise AssertionError(f"local demo provider test failed: {connection}")
        print("ai connection test OK")

        auth_failed = assert_envelope(
            http_json(
                "POST",
                "/admin/ai/config/test",
                {"provider": "OPENAI_COMPATIBLE", "baseUrl": "http://127.0.0.1:65534", "apiKey": ""},
            ),
            "test auth failure classification",
        )
        if auth_failed["errorCode"] != "AUTH_FAILED":
            raise AssertionError(f"auth failure was not classified: {auth_failed}")
        print("ai auth failure classification OK")

        rag_not_ready = assert_envelope(
            http_json("POST", "/admin/ai/config/test", {"knowledgeIndexEnabled": False}),
            "test rag readiness classification",
        )
        if rag_not_ready["errorCode"] != "RAG_NOT_READY":
            raise AssertionError(f"rag readiness was not classified: {rag_not_ready}")
        print("ai rag readiness classification OK")

        test_question = assert_envelope(
            http_json("POST", "/admin/ai/config/test-question", {"question": "local demo ping"}),
            "test ai question",
        )
        if "LOCAL DEMO" not in test_question["answer"]:
            raise AssertionError(f"test question did not return local demo mark: {test_question}")
        print("ai test question OK")

        rag_status = assert_envelope(http_json("GET", "/admin/ai/rag/status"), "rag status")
        if rag_status["documentCount"] < 1:
            raise AssertionError(f"rag status missing demo documents: {rag_status}")
        documents = assert_envelope(http_json("GET", "/admin/ai/rag/documents"), "rag documents")
        if not documents["items"]:
            raise AssertionError(f"rag documents empty: {documents}")
        print("rag status/documents OK")

        uploaded = assert_envelope(
            http_json(
                "POST",
                "/knowledge/submissions",
                {
                    "title": "Smoke uploaded uncategorized SOP",
                    "sourceOrganization": "LOCAL DEMO",
                    "sourceVersion": "smoke-v1",
                    "category": "",
                    "scopeApps": [],
                    "tags": ["smoke", "rag"],
                    "description": "LOCAL DEMO smoke upload",
                    "content": "Smoke RAG document for operator filling guide and PLA safety inspection.",
                    "submittedBy": "smoke-submitter",
                },
            ),
            "knowledge upload",
        )
        if uploaded["category"] != "UNCLASSIFIED" or "ALL" not in uploaded["scopeApps"]:
            raise AssertionError(f"uncategorized upload did not default to global scope: {uploaded}")
        review_id = uploaded["reviewId"]
        review = assert_envelope(http_json("GET", f"/admin/knowledge/reviews/{review_id}"), "knowledge review")
        if review["submission"]["reviewId"] != review_id:
            raise AssertionError(f"review lookup failed: {review}")
        classified = assert_envelope(
            http_json(
                "POST",
                f"/admin/ai/rag/documents/{uploaded['documentId']}/classification",
                {"category": "WORK_INSTRUCTION", "scopeApps": ["WORKSTATION", "ADMIN"], "tags": ["operator"]},
            ),
            "rag classification",
        )
        if classified["category"] != "WORK_INSTRUCTION" or "WORKSTATION" not in classified["scopeApps"]:
            raise AssertionError(f"classification update failed: {classified}")
        approved = assert_envelope(
            http_json(
                "POST",
                f"/admin/knowledge/reviews/{review_id}/approve",
                {"comment": "smoke approve"},
                token="REVIEW_DEMO",
                client_type="ADMIN",
            ),
            "knowledge approve",
        )
        if approved["status"] != "INDEXED" or approved["indexStatus"] != "READY":
            raise AssertionError(f"approval/indexing failed: {approved}")
        print("rag upload/classification/review OK")

        self_review = http_json(
            "POST",
            "/knowledge/submissions",
            {
                "title": "Self review block",
                "content": "self review should be blocked",
                "submittedBy": "local-admin",
            },
        )
        self_review_id = assert_envelope(self_review, "self review upload")["reviewId"]
        expect_http_error("POST", f"/admin/knowledge/reviews/{self_review_id}/approve", 403, token="LOCAL_DEMO", client_type="ADMIN")
        expect_http_error("POST", "/admin/knowledge/reviews/not-exists/approve", 404, token="REVIEW_DEMO", client_type="ADMIN")
        print("knowledge negative review rules OK")

        context = {
            "contextVersion": 1,
            "sourceApp": "DISPLAY",
            "pageRoute": "/factoryOverview",
            "capturedAt": "2026-07-28T00:00:00Z",
            "lineId": "LINE-01",
            "stageCode": "FILLING",
            "stateVersion": 26072801,
            "selection": {
                "action": "SELECT",
                "entityType": "DEVICE",
                "entityId": "FILLER-01",
                "displayText": "灌装机 01",
                "source": "ARKUI",
                "pageRoute": "/factoryStage/FILLING",
                "selectedAt": "2026-07-28T00:00:00Z",
                "fields": [{"code": "status", "label": "状态", "displayValue": "RUNNING"}],
            },
        }
        conversation = assert_envelope(http_json("POST", "/assistant/conversations", {"context": context}, client_type="DISPLAY"), "create")
        conversation_id = conversation["conversationId"]
        print(f"conversation OK {conversation_id}")

        ws = WebSocketClient(f"/api/assistant/events?conversationId={conversation_id}", token="LOCAL_DEMO", client_type="DISPLAY")
        ready = ws.recv_json()
        if ready["type"] != "ai.connection.ready":
            raise AssertionError(f"unexpected ready event: {ready}")
        print("websocket ready OK")

        send_result_holder: dict[str, dict] = {}

        def send_slow() -> None:
            send_result_holder["result"] = http_json(
                "POST",
                f"/assistant/conversations/{conversation_id}/messages",
                {
                    "question": "slow 当前灌装设备状态怎么样，是否可以把流量改为 120？",
                    "questionType": "SELECTION",
                    "context": context,
                },
                timeout=20.0,
                client_type="DISPLAY",
            )

        sender = threading.Thread(target=send_slow)
        sender.start()
        started = None
        delta = None
        for _ in range(20):
            event = ws.recv_json()
            if event["type"] == "ai.conversation.started":
                started = event
                if "aggregateVersion" not in event:
                    raise AssertionError(f"stream event missing aggregateVersion: {event}")
            if event["type"] == "ai.conversation.delta":
                delta = event
                if delta["aggregateVersion"] <= started["aggregateVersion"]:
                    raise AssertionError(f"aggregateVersion was not monotonic: started={started}, delta={delta}")
                break
        if started is None or delta is None:
            raise AssertionError("did not receive started and delta events")
        print("stream events OK")

        message_id = started["messageId"]
        stop = assert_envelope(
            http_json("POST", f"/assistant/conversations/{conversation_id}/messages/{message_id}/stop"),
            "stop",
        )
        if not stop["stopped"]:
            raise AssertionError(f"stop was not acknowledged: {stop}")
        stopped_event = ws.recv_json()
        if stopped_event["type"] != "ai.conversation.stopped":
            raise AssertionError(f"unexpected stopped event: {stopped_event}")
        sender.join(timeout=10.0)
        print("stop OK")

        retry = assert_envelope(
            http_json("POST", f"/assistant/conversations/{conversation_id}/messages/{message_id}/retry", timeout=20.0),
            "retry",
        )
        if "LOCAL DEMO" not in retry["content"]:
            raise AssertionError(f"retry missing source mark: {retry}")
        print("retry OK")

        history = assert_envelope(http_json("GET", f"/assistant/conversations/{conversation_id}/messages"), "history")
        assistant_messages = [item for item in history["messages"] if item["role"] == "ASSISTANT"]
        if not assistant_messages or not any(item["status"] in ("STOPPED", "COMPLETED") for item in assistant_messages):
            raise AssertionError(f"HTTP compensation history invalid: {history}")
        print("http compensation OK")

        facts = assert_envelope(
            http_json("POST", "/ai-integration/facts", {"context": context}, client_type="ADMIN"),
            "facts",
        )
        command_intent = assert_envelope(
            http_json("POST", "/ai-integration/command-intents", {"deviceCode": "FILLER-01", "parameterCode": "flow_rate"}),
            "command intent",
        )
        if "PRODUCTION_BACKEND" not in command_intent["source"] or FakeBackendState.facts_calls < 1 or FakeBackendState.command_calls < 1:
            raise AssertionError(f"backend tool calls were not closed: facts={facts}, intent={command_intent}")
        print("production backend facts/command-intent calls OK")

        revoked = assert_envelope(
            http_json(
                "POST",
                f"/admin/knowledge/reviews/{review_id}/revoke",
                {"comment": "smoke revoke"},
                token="REVIEW_DEMO",
                client_type="ADMIN",
            ),
            "knowledge revoke",
        )
        if revoked["status"] != "REVOKED":
            raise AssertionError(f"revoke failed: {revoked}")
        post_revoke_context = dict(context)
        post_revoke_context["sourceApp"] = "DISPLAY"
        post_revoke_conv = assert_envelope(http_json("POST", "/assistant/conversations", {"context": post_revoke_context}, client_type="DISPLAY"), "post revoke create")
        post_revoke_answer = assert_envelope(
            http_json(
                "POST",
                f"/assistant/conversations/{post_revoke_conv['conversationId']}/messages",
                {"question": "operator filling guide", "questionType": "FREE_TEXT", "context": post_revoke_context},
                timeout=20.0,
                client_type="DISPLAY",
            ),
            "post revoke answer",
        )
        if any(item["entity"]["entityId"] == uploaded["documentId"] for item in post_revoke_answer["citations"]):
            raise AssertionError(f"revoked document was still cited: {post_revoke_answer}")
        print("revoke excludes RAG citation OK")

        ws.close()

        process.terminate()
        process.communicate(timeout=5)
        process = start_server()
        wait_health()
        persisted_review = assert_envelope(
            http_json("GET", f"/admin/knowledge/reviews/{review_id}", token="REVIEW_DEMO", client_type="ADMIN"),
            "persisted review",
        )
        if persisted_review["submission"]["status"] != "REVOKED":
            raise AssertionError(f"persisted review state lost after restart: {persisted_review}")
        print("persistence restart OK")
        print("SMOKE TEST PASSED")
    finally:
        process.terminate()
        try:
            stdout, _ = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, _ = process.communicate(timeout=5)
        if process.returncode not in (0, -15, 1):
            print(stdout)
        fake_backend.shutdown()


if __name__ == "__main__":
    main()
