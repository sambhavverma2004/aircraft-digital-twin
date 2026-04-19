"""
Real-time Step-wise Aircraft Engine Health Simulation
with Dual Engine Support and Explainable AI (SHAP)
"""

import pandas as pd
import numpy as np
import joblib
import pickle
import shap
from pathlib import Path


class EngineHealthSimulator:
    """
    Real-time engine health simulator with ML predictions
    """
    
    def __init__(self, model_path: str, data_path: str):
        """
        Initialize simulator with model and data
        
        Args:
            model_path: Path to rf_model.pkl
            data_path: Path to train_FD001.txt
        """
        # Load Random Forest model
        self.model = joblib.load(model_path)
        
        # Initialize SHAP explainer once (reused every timestep)
        self.explainer = shap.TreeExplainer(self.model)
        
        # Load dataset
        self.data = self._load_data(data_path)
        
        # Engine state tracking
        self.engine_state = {
            1: 0,  # Engine 1 current index
            2: 0   # Engine 2 current index
        }
        
        # Separate data by engine unit
        self.engine_data = {
            1: self.data[self.data['unit'] == 1].reset_index(drop=True),
            2: self.data[self.data['unit'] == 2].reset_index(drop=True)
        }
        
        # Calculate max RUL for normalization
        self.max_rul = self._calculate_max_rul()
        
        # Feature names for explainability
        self.feature_names = list(self.model.feature_names_in_)
        
        # Store current features (updated each step for SHAP access)
        self.current_features = None
        
        print(f"✅ Simulator initialized")
        print(f"   Engine 1: {len(self.engine_data[1])} timesteps")
        print(f"   Engine 2: {len(self.engine_data[2])} timesteps")
        print(f"   Max RUL: {self.max_rul}")
    
    def _load_data(self, data_path: str) -> pd.DataFrame:
        """Load and preprocess NASA CMAPSS data"""
        
        # Column names for CMAPSS dataset
        columns = ['unit', 'cycle'] + \
          [f'op_setting_{i}' for i in range(1, 4)] + \
          [f'sensor_{i}' for i in range(1, 22)]
        # Load data
        df = pd.read_csv(data_path, sep=r'\s+', header=None, names=columns)
        
        # Add RUL (Remaining Useful Life) column
        # RUL = max_cycle - current_cycle for each unit
        df['RUL'] = df.groupby('unit')['cycle'].transform('max') - df['cycle']
        
        return df
        
    def _calculate_max_rul(self) -> float:
        """Calculate maximum RUL across all engines for normalization"""
        return self.data['RUL'].max()
    
    def _extract_features(self, row):
        df = pd.DataFrame([row])
        features = df[self.model.feature_names_in_]
        return features.values
    
    def _predict_rul(self, features: np.ndarray) -> float:
        """Predict RUL using Random Forest model"""
        
        try:
            rul = self.model.predict(features)[0]
            print("Predicted RUL:", rul)
            return max(0, rul)  # Ensure non-negative
        except Exception as e:
            print(f"⚠️ Prediction error: {e}")
            return 0.0
    
    def _compute_health(self, rul: float) -> float:
        """
        Convert RUL to health score (0-1)
        
        Health = RUL / max_RUL
        """
        health = rul / self.max_rul if self.max_rul > 0 else 0
        return np.clip(health, 0.0, 1.0)
    
    def _get_status(self, health: float) -> str:
        """Determine engine status from health value"""
        if health > 0.7:
            return "OPTIMAL"
        elif health > 0.4:
            return "DEGRADED"
        elif health > 0.2:
            return "WARNING"
        else:
            return "CRITICAL"
    
    def _get_explanation(self, features, top_n=3):
        """
        Compute SHAP-based dynamic feature contributions for this timestep.
        Returns top_n features sorted by absolute SHAP value.
        """
        try:
            # Ensure correct shape for SHAP: (1, n_features)
            if features.ndim == 1:
                features = features.reshape(1, -1)

            shap_values = self.explainer.shap_values(features)

            # For RandomForestRegressor, shap_values shape is (1, n_features)
            # For RandomForestClassifier, it may be a list — handle both
            if isinstance(shap_values, list):
                # Classifier: use values for the positive class (index 1)
                values = shap_values[1][0]
            else:
                # Regressor: shape is (1, n_features)
                values = shap_values[0]

            shap_list = [
                {
                    "feature": self.feature_names[i],
                    "importance": float(values[i])
                }
                for i in range(len(self.feature_names))
            ]

            # Sort by absolute SHAP contribution (dynamic per timestep)
            shap_list.sort(key=lambda x: abs(x["importance"]), reverse=True)

            return shap_list[:top_n]

        except Exception as e:
            print("SHAP error:", e)
            return []

    def get_next_health(self, engine_id: int) -> dict:
        """
        Get next health prediction for specified engine
        
        Args:
            engine_id: 1 or 2
            
        Returns:
            dict with health, status, RUL, and explanation
        """
        if engine_id not in [1, 2]:
            raise ValueError(f"Invalid engine_id: {engine_id}. Must be 1 or 2.")
        
        # Get current index for this engine
        current_idx = self.engine_state[engine_id]
        engine_df = self.engine_data[engine_id]
        
        # Check if we've reached the end
        if current_idx >= len(engine_df):
            # Restart from beginning (loop)
            current_idx = 0
            self.engine_state[engine_id] = 0
        
        # Get current row
        row = engine_df.iloc[current_idx]
        
        # Extract features
        features = self._extract_features(row)
        
        # Store current features for SHAP access
        self.current_features = features
        
        # Predict RUL
        predicted_rul = self._predict_rul(features)
        
        # Compute health
        health = self._compute_health(predicted_rul)
        
        # Get status
        status = self._get_status(health)
        
        # Get SHAP-based dynamic explanation
        explanation = self._get_explanation(features, top_n=3)
        
        # Increment index for next call
        self.engine_state[engine_id] += 1
        
        return {
            "health": health,
            "status": status,
            "rul": predicted_rul,
            "cycle": int(row['cycle']),
            "explanation": explanation
        }
    
    def get_dual_engine_health(self) -> dict:
        """
        Get health for both engines simultaneously
        
        Returns:
            dict with left_engine, right_engine, and explanations
        """
        left_data = self.get_next_health(engine_id=1)
        right_data = self.get_next_health(engine_id=2)
        
        return {
            "left_engine": left_data["health"],
            "right_engine": right_data["health"],
            "left_status": left_data["status"],
            "right_status": right_data["status"],
            "left_rul": left_data["rul"],
            "right_rul": right_data["rul"],
            "left_cycle": left_data["cycle"],
            "right_cycle": right_data["cycle"],
            "explanation": {
                "left": left_data["explanation"],
                "right": right_data["explanation"]
            }
        }
    
    def reset(self):
        """Reset both engines to initial state"""
        self.engine_state = {1: 0, 2: 0}
        print("✅ Engines reset to initial state")
    
    def reset_engine(self, engine_id: int):
        """Reset specific engine"""
        if engine_id in [1, 2]:
            self.engine_state[engine_id] = 0
            print(f"✅ Engine {engine_id} reset")
    
    def get_engine_info(self) -> dict:
        """Get current state information"""
        return {
            "engine_1_index": self.engine_state[1],
            "engine_2_index": self.engine_state[2],
            "engine_1_total": len(self.engine_data[1]),
            "engine_2_total": len(self.engine_data[2]),
            "engine_1_progress": f"{self.engine_state[1]}/{len(self.engine_data[1])}",
            "engine_2_progress": f"{self.engine_state[2]}/{len(self.engine_data[2])}"
        }


# ================================
# STANDALONE TESTING
# ================================

if __name__ == "__main__":
    import os
    
    # Paths (adjust as needed)
    BASE_DIR = Path("/Users/sambhavverma/Desktop/Aircraft")
    MODEL_PATH = BASE_DIR / "model" / "rf_model.pkl"
    DATA_PATH = BASE_DIR / "data" / "train_FD001.txt"
    
    # Check if files exist
    if not MODEL_PATH.exists():
        print(f"❌ Model not found at {MODEL_PATH}")
        exit(1)
    
    if not DATA_PATH.exists():
        print(f"❌ Data not found at {DATA_PATH}")
        exit(1)
    
    # Initialize simulator
    simulator = EngineHealthSimulator(
        model_path=str(MODEL_PATH),
        data_path=str(DATA_PATH)
    )
    
    # Test dual engine prediction
    print("\n" + "="*50)
    print("TESTING DUAL ENGINE PREDICTION (SHAP)")
    print("="*50)
    
    for i in range(5):
        result = simulator.get_dual_engine_health()
        
        print(f"\n--- Step {i+1} ---")
        print(f"Left Engine:  {result['left_engine']:.3f} ({result['left_status']})")
        print(f"Right Engine: {result['right_engine']:.3f} ({result['right_status']})")
        print(f"Left RUL:  {result['left_rul']:.1f}")
        print(f"Right RUL: {result['right_rul']:.1f}")
        
        if result['explanation']['left']:
            top = result['explanation']['left'][0]
            print(f"Left  Top SHAP: {top['feature']} → {top['importance']:+.4f}")
        if result['explanation']['right']:
            top = result['explanation']['right'][0]
            print(f"Right Top SHAP: {top['feature']} → {top['importance']:+.4f}")
    
    # Test reset
    print("\n" + "="*50)
    print("TESTING RESET")
    print("="*50)
    simulator.reset()
    print(simulator.get_engine_info())