from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation import health_sequence, engine_state

app = FastAPI()

# ✅ FIX CORS (CRITICAL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all (for dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "API running"}


@app.get("/health")
def get_health(engine_id: int = 1):
    # ensure engine exists
    if engine_id not in engine_state:
        engine_state[engine_id] = 0

    idx = engine_state[engine_id]

    health = health_sequence[idx]

    # move forward
    if idx < len(health_sequence) - 1:
        engine_state[engine_id] += 1

    return {"health": float(health)}


@app.get("/reset")
def reset(engine_id: int = 1):
    engine_state[engine_id] = 0
    return {"status": "reset"}