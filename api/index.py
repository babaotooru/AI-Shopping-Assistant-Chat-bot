"""Vercel Python entrypoint for FastAPI app."""

from backend.main import app

# Vercel looks for a top-level ASGI app object named `app`.
