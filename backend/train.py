import os
import torch
import pandas as pd

from model import LSTMModel
from data_loader import load_data, add_rul
from preprocess import normalize, create_sequences

# ===== PATH SETUP =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(BASE_DIR, "data", "train_FD001.txt")
MODEL_PATH = os.path.join(BASE_DIR, "model", "model.pth")

os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

# ===== LOAD DATA =====
print("Loading data...")
df = load_data(DATA_PATH)

print("Adding RUL...")
df = add_rul(df)

print("Normalizing...")
df = normalize(df)

print("Creating sequences...")
X, y = create_sequences(df, seq_len=30)
y = y / 130.0

print(f"X shape: {X.shape}, y shape: {y.shape}")

# ===== MODEL =====
from torch.utils.data import TensorDataset, DataLoader

# Convert to tensors
X = torch.tensor(X, dtype=torch.float32)
y = torch.tensor(y, dtype=torch.float32).view(-1, 1)

dataset = TensorDataset(X, y)
loader = DataLoader(dataset, batch_size=64, shuffle=True)

model = LSTMModel(input_size=X.shape[2])
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
loss_fn = torch.nn.MSELoss()

print("Training started...")

for epoch in range(50):
    total_loss = 0

    for batch_X, batch_y in loader:
        pred = model(batch_X)
        loss = loss_fn(pred, batch_y)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print(f"Epoch {epoch+1}, Loss: {total_loss / len(loader)}")
# ===== SAVE MODEL =====
torch.save(model.state_dict(), MODEL_PATH)

print(f"Model saved at: {MODEL_PATH}")