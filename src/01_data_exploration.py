import pandas as pd

# Load FIRMS dataset
file_path = "data/raw/DL_FIRE_J2V-C2_837818/fire_nrt_J2V-C2_837818.csv"

df = pd.read_csv(file_path)

# Display dataset information
print("\nFirst 5 rows:")
print(df.head())

print("\nDataset shape:")
print(df.shape)

print("\nColumn names:")
print(df.columns.tolist())

print("\nDataset information:")
df.info()

print("\nMissing values:")
print(df.isnull().sum())

# Statistical summary
print("\nStatistical Summary:")
print(df.describe())

# Data types
print("\nData Types:")
print(df.dtypes)

# Satellite distribution
print("\nSatellite Distribution:")
print(df["satellite"].value_counts())

# Confidence distribution
print("\nConfidence Distribution:")
print(df["confidence"].value_counts())