import os
import joblib
import pandas as pd
import matplotlib.pyplot as plt

# ===== PATHS =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "rf_model.pkl")
DATA_PATH = os.path.join(BASE_DIR, "data", "train_FD001.txt")

# ===== LOAD MODEL =====
model = joblib.load(MODEL_PATH)

# ===== LOAD DATA (MATCH TRAINING EXACTLY) =====
cols = ['unit', 'cycle'] + \
       [f'op_setting_{i}' for i in range(1, 4)] + \
       [f'sensor_{i}' for i in range(1, 22)]

df = pd.read_csv(DATA_PATH, sep=' ', header=None)
df = df.drop(columns=[26, 27])
df.columns = cols

# ===== RUL CREATION =====
rul = df.groupby('unit')['cycle'].max().reset_index()
rul.columns = ['unit', 'max_cycle']

df = df.merge(rul, on='unit')
df['RUL'] = df['max_cycle'] - df['cycle']

# ===== REMOVE CONSTANT FEATURES =====
df = df.loc[:, df.nunique() > 1]

# ===== SELECT ONE ENGINE =====
engine_id = 1
engine_data = df[df["unit"] == engine_id]

X = engine_data.drop(columns=['unit', 'max_cycle', 'RUL'])
y_actual = engine_data['RUL'].values

# ===== RAW RF PREDICTION =====
y_pred = model.predict(X)

# ===== SMOOTHING =====
def smooth(values, window=5):
    smoothed = []
    for i in range(len(values)):
        start = max(0, i - window)
        smoothed.append(sum(values[start:i+1]) / (i - start + 1))
    return smoothed

y_smooth = smooth(y_pred)

# ===== ENFORCE MONOTONIC DECREASE =====
def enforce_decreasing(values):
    fixed = values.copy()
    for i in range(1, len(fixed)):
        if fixed[i] > fixed[i-1]:
            fixed[i] = fixed[i-1]
    return fixed

y_final = enforce_decreasing(y_smooth)

# ===== PLOT =====
plt.figure(figsize=(12,6))

plt.plot(y_actual, label="Actual RUL", linewidth=2)
plt.plot(y_pred, label="Raw RF", alpha=0.5)
plt.plot(y_smooth, label="Smoothed", linewidth=2)
plt.plot(y_final, label="Final (Stable)", linewidth=3)

plt.title("Stability Test - RUL Prediction")
plt.xlabel("Cycle")
plt.ylabel("RUL")

plt.legend()
plt.show()