from __future__ import annotations

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the bottling factory AI center service.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8091, type=int)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    uvicorn.run("ai_center.app:create_app", host=args.host, port=args.port, factory=True, reload=args.reload)


if __name__ == "__main__":
    main()
