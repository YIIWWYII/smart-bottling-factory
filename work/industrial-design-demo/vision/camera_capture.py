"""USB capture only. Run on the computer physically connected to the cameras."""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import cv2

devices = {}
device_locks = [threading.Lock() for _ in range(8)]

class Camera:
    def __init__(self, index):
        self.last_access = time.monotonic()
        self.jpeg = None
        self.sequence = 0
        self.frames = threading.Condition()
        self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW) if __import__('os').name == 'nt' else cv2.VideoCapture(index)
        if not self.cap.isOpened():
            self.cap.release()
            raise ValueError('相机无法打开，可能被其他程序占用')
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        # DirectShow renegotiates the subtype when dimensions/FPS change. Set MJPG last.
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        self.format = ''.join(chr((int(self.cap.get(cv2.CAP_PROP_FOURCC)) >> (8*i)) & 255) for i in range(4))
        self.reported_fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.last_frame = 0
        self.started = time.monotonic()
        self.alive = True
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        try:
            while time.monotonic() - self.last_access < 20:
                ok, frame = self.cap.read()
                if not ok:
                    self.jpeg = None
                    break
                ok, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ok:
                    with self.frames:
                        self.jpeg = encoded.tobytes()
                        self.sequence += 1
                        self.last_frame = time.monotonic()
                        self.frames.notify_all()
        finally:
            self.cap.release()
            self.alive = False
            with self.frames:
                self.frames.notify_all()

def camera(index):
    if index not in range(8):
        raise ValueError('设备编号无效')
    with device_locks[index]:
        existing = devices.get(index)
        if not existing or not existing.alive:
            devices[index] = Camera(index)
        devices[index].last_access = time.monotonic()
        return devices[index]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        try:
            if path == '/health':
                return self.json({'status':'ready','contract':'bottleworks-capture-v1','cameras':[{'id':i,'format':c.format,'reportedFps':c.reported_fps,'frames':c.sequence,'fps':round(c.sequence/max(.001,time.monotonic()-c.started),1),'frameAge':round(time.monotonic()-c.last_frame,1) if c.last_frame else None,'alive':c.alive} for i,c in list(devices.items())]})
            if path == '/cameras':
                found = []
                for index in range(8):
                    try:
                        c = camera(index)
                        found.append({'id':str(index),'name':f'USB 相机 {index + 1}', 'previewPath':f'/cameras/{index}/stream'})
                    except ValueError:
                        pass
                return self.json({'devices':found,'binding':'index','note':'编号可能在拔插或重启后变化，请通过预览核对机位。'})
            parts = path.strip('/').split('/')
            if len(parts) != 3 or parts[0] != 'cameras' or parts[2] not in ('stream','snapshot'):
                return self.json({'error':'接口不存在'},404)
            c = camera(int(parts[1]))
            deadline = time.monotonic()+4
            while c.jpeg is None and c.alive and time.monotonic()<deadline:
                time.sleep(.1)
            if not c.jpeg:
                return self.json({'error':'没有采集到画面'},503)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin','*')
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Type','image/jpeg' if parts[2]=='snapshot' else 'multipart/x-mixed-replace; boundary=frame')
            self.end_headers()
            if parts[2]=='snapshot':
                self.wfile.write(c.jpeg)
                return
            self.connection.settimeout(15)
            sequence = -1
            while c.alive:
                c.last_access=time.monotonic()
                with c.frames:
                    c.frames.wait_for(lambda: c.sequence != sequence or not c.alive, timeout=1)
                    if not c.alive:
                        break
                    if c.sequence == sequence:
                        continue
                    sequence = c.sequence
                    data=c.jpeg
                if data:
                    self.wfile.write(b'--frame\r\nContent-Type: image/jpeg\r\nContent-Length: '+str(len(data)).encode()+b'\r\n\r\n'+data+b'\r\n')
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError):
            pass
        except ValueError as e:
            self.json({'error':str(e)},400)

    def json(self, data, status=200):
        raw=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8097)
    args=parser.parse_args()
    print(f'USB capture: http://{args.host}:{args.port}',flush=True)
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
