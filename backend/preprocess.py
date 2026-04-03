from sklearn.preprocessing import MinMaxScaler

def normalize(df):
    scaler = MinMaxScaler()
    sensor_cols = [col for col in df.columns if "s" in col]

    df[sensor_cols] = scaler.fit_transform(df[sensor_cols])
    return df
	
import numpy as np

def create_sequences(df, seq_len=30):
    X, y = [], []

    for engine_id in df.engine_id.unique():
        engine_data = df[df.engine_id == engine_id]

        for i in range(len(engine_data) - seq_len):
            X.append(engine_data.iloc[i:i+seq_len].drop(["RUL", "engine_id"], axis=1).values)
            y.append(engine_data.iloc[i+seq_len]["RUL"])

    return np.array(X), np.array(y)