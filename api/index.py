import sys
from pathlib import Path

# Make the repository root importable so we can reuse the FastAPI app defined in main.py
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from main import app  # noqa: E402  FastAPI instance reused by Vercel
