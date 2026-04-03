import os
import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error

# ===== PATHS =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "train_FD001.txt")
MODEL_PATH = os.path.join(BASE_DIR, "model", "rf_model.pkl")

os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

# ===== LOAD DATA =====
cols = ['unit', 'cycle'] + \
       [f'op_setting_{i}' for i in range(1, 4)] + \
       [f'sensor_{i}' for i in range(1, 22)]

df = pd.read_csv(DATA_PATH, sep=' ', header=None)
df = df.drop(columns=[26,27])
df.columns = cols

print("Data loaded:", df.shape)

# ===== RUL CREATION =====
rul = df.groupby('unit')['cycle'].max().reset_index()
rul.columns = ['unit', 'max_cycle']

df = df.merge(rul, on='unit')
df['RUL'] = df['max_cycle'] - df['cycle']

# ===== REMOVE CONSTANT FEATURES =====
df = df.loc[:, df.nunique() > 1]

# ===== FEATURES =====
X = df.drop(columns=['unit','max_cycle','RUL'])
y = df['RUL']

print("Feature shape:", X.shape)

# ===== ENGINE-WISE SPLIT (CRITICAL) =====
units = df['unit'].unique()
train_units, test_units = train_test_split(units, test_size=0.2, random_state=42)

train_df = df[df['unit'].isin(train_units)]
test_df  = df[df['unit'].isin(test_units)]

X_train = train_df.drop(columns=['unit','max_cycle','RUL'])
y_train = train_df['RUL']

X_test  = test_df.drop(columns=['unit','max_cycle','RUL'])
y_test  = test_df['RUL']

# ===== RANDOM FOREST (EXACT NOTEBOOK STYLE) =====
rf_reg = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

print("Training RF...")
rf_reg.fit(X_train, y_train)

# ===== PREDICT =====
y_pred = rf_reg.predict(X_test)

# ===== METRICS =====
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae = mean_absolute_error(y_test, y_pred)

print(f"RMSE: {rmse:.2f}")
print(f"MAE: {mae:.2f}")

# ===== SAVE MODEL =====
joblib.dump(rf_reg, MODEL_PATH)

print(f"Model saved at: {MODEL_PATH}")