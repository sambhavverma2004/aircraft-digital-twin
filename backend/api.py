"""
FastAPI Backend for Aircraft Engine Digital Twin
with Dual Engine Support and Explainable AI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import sys

# Import the simulator
from simulation import EngineHealthSimulator



# ================================
# CONFIGURATION
# ================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "model" / "rf_model.pkl"
DATA_PATH = BASE_DIR / "data" / "train_FD001.txt"


# ================================
# RESPONSE MODELS
# ================================

class FeatureImportance(BaseModel):
    feature: str
    importance: float


class HealthResponse(BaseModel):
    left_engine: float
    right_engine: float
    left_status: str
    right_status: str
    left_rul: float
    right_rul: float
    left_cycle: int
    right_cycle: int
    explanation: dict


class ResetResponse(BaseModel):
    message: str
    status: str


class InfoResponse(BaseModel):
    engine_1_index: int
    engine_2_index: int
    engine_1_total: int
    engine_2_total: int
    engine_1_progress: str
    engine_2_progress: str


# ================================
# FASTAPI APP
# ================================

app = FastAPI(
    title="Aircraft Engine Digital Twin API",
    description="Real-time ML-powered predictive maintenance with explainability",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================================
# GLOBAL SIMULATOR INSTANCE
# ================================

simulator = None


# ================================
# STARTUP EVENT
# ================================

@app.on_event("startup")
async def startup_event():
    """Initialize the simulator on startup"""
    global simulator
    
    print("🚀 Initializing Aircraft Engine Digital Twin System...")
    print("MODEL PATH:", MODEL_PATH)
    print("MODEL EXISTS:", MODEL_PATH.exists())

    print("DATA PATH:", DATA_PATH)
    print("DATA EXISTS:", DATA_PATH.exists())
    
    try:
        # Check if files exist
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
        
        if not DATA_PATH.exists():
            raise FileNotFoundError(f"Data not found at {DATA_PATH}")
        
        # Initialize simulator
        simulator = EngineHealthSimulator(
            model_path=str(MODEL_PATH),
            data_path=str(DATA_PATH)
        )
        
        print("✅ System initialized successfully")
        print(f"   Model: {MODEL_PATH.name}")
        print(f"   Data: {DATA_PATH.name}")
        
    except Exception as e:
        print(f"❌ Initialization failed: {e}")
        simulator = None


# ================================
# API ENDPOINTS
# ================================

@app.get("/")
async def root():
    """Root endpoint - API info"""
    return {
        "name": "Aircraft Engine Digital Twin API",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Real-time ML predictions",
            "Dual engine support",
            "Explainable AI",
            "Step-wise degradation simulation"
        ]
    }


@app.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Get real-time health predictions for both engines
    
    Returns:
        HealthResponse with dual engine health, status, RUL, and explanations
    """
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    try:
        # Get dual engine predictions
        result = simulator.get_dual_engine_health()
        
        return HealthResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/reset", response_model=ResetResponse)
async def reset_simulation():
    """
    Reset both engines to initial state
    
    Returns:
        ResetResponse with confirmation message
    """
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    try:
        simulator.reset()
        
        return ResetResponse(
            message="Both engines reset to initial state",
            status="success"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@app.post("/reset/{engine_id}", response_model=ResetResponse)
async def reset_engine(engine_id: int):
    """
    Reset specific engine (1 or 2)
    
    Args:
        engine_id: 1 for left engine, 2 for right engine
        
    Returns:
        ResetResponse with confirmation message
    """
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    if engine_id not in [1, 2]:
        raise HTTPException(status_code=400, detail="engine_id must be 1 or 2")
    
    try:
        simulator.reset_engine(engine_id)
        
        engine_name = "left" if engine_id == 1 else "right"
        
        return ResetResponse(
            message=f"{engine_name.capitalize()} engine reset to initial state",
            status="success"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@app.get("/info", response_model=InfoResponse)
async def get_info():
    """
    Get current simulation state information
    
    Returns:
        InfoResponse with engine indices and progress
    """
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    try:
        info = simulator.get_engine_info()
        return InfoResponse(**info)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Info retrieval failed: {str(e)}")


@app.get("/health/left")
async def get_left_engine_health():
    """Get health for left engine only"""
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    try:
        result = simulator.get_next_health(engine_id=1)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/health/right")
async def get_right_engine_health():
    """Get health for right engine only"""
    global simulator
    
    if simulator is None:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    
    try:
        result = simulator.get_next_health(engine_id=2)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ================================
# HEALTH CHECK
# ================================

@app.get("/ping")
async def ping():
    """Simple health check endpoint"""
    return {"status": "alive"}


# ================================
# RUN SERVER
# ================================

if __name__ == "__main__":
    import uvicorn
    
    print("="*60)
    print("  AIRCRAFT ENGINE DIGITAL TWIN API")
    print("  Real-time ML Predictions with Explainability")
    print("="*60)
    print()
    print("📡 Starting server...")
    print("🌐 API will be available at: http://127.0.0.1:8000")
    print("📚 Docs available at: http://127.0.0.1:8000/docs")
    print()
    
    uvicorn.run(
        "api:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )