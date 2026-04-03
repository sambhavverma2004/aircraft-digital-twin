import pandas as pd

cols = ["engine_id", "cycle"] + [f"op{i}" for i in range(1,4)] + [f"s{i}" for i in range(1,22)]

def load_data(path):
    df = pd.read_csv(path, sep=" ", header=None)
    df = df.dropna(axis=1)
    df.columns = cols
    return df
def add_rul(df):
    max_cycle = df.groupby("engine_id")["cycle"].max()
    df["RUL"] = df.apply(lambda row: max_cycle[row.engine_id] - row.cycle, axis=1)
    return df