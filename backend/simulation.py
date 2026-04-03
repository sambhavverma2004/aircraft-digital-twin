import numpy as np
import joblib
import pandas as pd

# Load model
model = joblib.load("../model/rf_model.pkl")
model_features = model.feature_names_in_
# Load and prepare ONE engine sequence (you already did this logic before)
def generate_health_sequence():
    df = pd.read_csv("../data/train_FD001.txt", sep=" ", header=None)
    df = df.dropna(axis=1)

    cols = ['unit', 'cycle'] + \
           [f'op_setting_{i}' for i in range(1, 4)] + \
           [f'sensor_{i}' for i in range(1, 22)]

    df.columns = cols

    engine = df[df['unit'] == 1].copy()

    max_cycle = engine['cycle'].max()
    engine['RUL'] = max_cycle - engine['cycle']

    # MATCH TRAINING FEATURES
    features = engine.drop(columns=['unit', 'RUL'])

# IMPORTANT: align with training features
    features = features[model_features]

    preds = model.predict(features)

    # smoothing
    preds = pd.Series(preds).rolling(window=5, min_periods=1).mean().to_numpy().copy()

    # monotonic decreasing
    for i in range(1, len(preds)):
        preds[i] = min(preds[i], preds[i-1])

    # normalize
    health = preds / max(preds)

    return health.tolist()


# Precompute once
health_sequence = generate_health_sequence()


# Engine state
engine_state = {
    1: 0
}