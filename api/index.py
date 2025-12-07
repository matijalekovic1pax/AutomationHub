import os
import sys

# Ensure the root path is available for imports when deployed as a Vercel function
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from mangum import Mangum  # type: ignore
from main import app

# Expose the FastAPI app to Vercel's serverless runtime
handler = Mangum(app)
