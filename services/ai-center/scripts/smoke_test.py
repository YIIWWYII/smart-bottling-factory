from __future__ import annotations

import base64
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib import request


ROOT = Path(__file__).resolve().parents[1]
LOCAL_PYTHON_PACKAGES = Path(r"D:\HarmonyOS-Dev\python-packages")
HOST = "127.0.0.1"
PORT = int(os.getenv("AI_CENTER_SMOKE_PORT", "8091"))
BASE = f"http://{HOST}:{PORT}/api"


def http_json(method: str, path: str, payload: dict | None = None, timeout: float = 10.0) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json;charset=UTF-8", "Authorization": "Bearer LOCAL_DEMO"},
    )
    with request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)


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
    return subprocess.Popen(
        [sys.executable, "-m", "ai_center", "--host", HOST, "--port", str(PORT)],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


class WebSocketClient:
    def __init__(self, path: str) -> None:
        self.sock = socket.create_connection((HOST, PORT), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request_text = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {HOST}:{PORT}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
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


def assert_envelope(result: dict, label: str) -> dict:
    if not result.get("success"):
        raise AssertionError(f"{label} failed: {result}")
    return result["data"]


def main() -> None:
    process = start_server()
    try:
        wait_health()
        print("health OK")

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
        conversation = assert_envelope(http_json("POST", "/assistant/conversations", {"context": context}), "create")
        conversation_id = conversation["conversationId"]
        print(f"conversation OK {conversation_id}")

        ws = WebSocketClient(f"/api/assistant/events?conversationId={conversation_id}")
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
            )

        sender = threading.Thread(target=send_slow)
        sender.start()
        started = None
        delta = None
        for _ in range(20):
            event = ws.recv_json()
            if event["type"] == "ai.conversation.started":
                started = event
            if event["type"] == "ai.conversation.delta":
                delta = event
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
        ws.close()
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


if __name__ == "__main__":
    main()
