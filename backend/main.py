from pathlib import Path

import numpy as np
from functools import lru_cache
import pandas as pd
from auth import router as auth_router, User
from database import Base, engine
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sklearn.cluster import DBSCAN


# ==================================================
# 1. FASTAPI CONFIGURATION
# ==================================================

app = FastAPI(
    title="FlareX API",
    description="Wildfire thermal detection and intelligence API",
    version="1.1.0"
)
# Initialize authentication database tables
Base.metadata.create_all(bind=engine)

# Register authentication routes
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# 2. DATASET LOADING
# ==================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CSV_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "DL_FIRE_J2V-C2_837818"
    / "fire_nrt_J2V-C2_837818.csv"
)

if not CSV_PATH.exists():
    raise FileNotFoundError(
        f"FIRMS dataset not found: {CSV_PATH}"
    )

df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip().str.lower()

print(f"FlareX loaded {len(df)} FIRMS detections.")


# ==================================================
# 3. DATA PREPARATION
# ==================================================

def prepare_dataframe():

    data = df.copy()

    required = [
        "latitude",
        "longitude",
        "frp",
        "confidence"
    ]

    missing = [
        column for column in required
        if column not in data.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    for column in ["latitude", "longitude", "frp"]:
        data[column] = pd.to_numeric(
            data[column],
            errors="coerce"
        )

    data = data.dropna(
        subset=["latitude", "longitude", "frp"]
    ).copy()

    data = data[
        data["latitude"].between(-90, 90)
        & data["longitude"].between(-180, 180)
        & (data["frp"] >= 0)
    ].copy()

    data["confidence"] = (
        data["confidence"]
        .astype(str)
        .str.strip()
        .str.lower()
    )

    if "acq_date" in data.columns:

        date_values = data["acq_date"].astype(str)

        if "acq_time" in data.columns:

            time_values = (
                pd.to_numeric(
                    data["acq_time"],
                    errors="coerce"
                )
                .fillna(0)
                .astype(int)
                .astype(str)
                .str.zfill(4)
            )

            data["_datetime"] = pd.to_datetime(
                date_values + " " + time_values,
                format="%Y-%m-%d %H%M",
                errors="coerce"
            )

        else:
            data["_datetime"] = pd.to_datetime(
                date_values,
                errors="coerce"
            )

    else:
        data["_datetime"] = pd.NaT

    return data


# ==================================================
# 4. HOME ENDPOINT
# ==================================================

@app.get("/")
def home():

    return {
        "message": "FlareX API is running",
        "dataset": "NASA FIRMS CSV",
        "total_rows": int(len(df))
    }


# ==================================================
# 5. ANALYTICS OVERVIEW
# ==================================================

@app.get("/api/analytics/overview")
def get_overview():

    confidence = (
        df["confidence"]
        .astype(str)
        .str.strip()
        .str.lower()
        .value_counts()
        .to_dict()
    )

    frp = pd.to_numeric(
        df["frp"],
        errors="coerce"
    ).dropna()

    return {
        "total_detections": int(len(df)),
        "confidence": {
            "high": int(confidence.get("h", 0)),
            "nominal": int(confidence.get("n", 0)),
            "low": int(confidence.get("l", 0))
        },
        "frp": {
            "average": round(float(frp.mean()), 2) if not frp.empty else 0,
            "median": round(float(frp.median()), 2) if not frp.empty else 0,
            "maximum": round(float(frp.max()), 2) if not frp.empty else 0
        },
        "source": "NASA FIRMS CSV"
    }


# ==================================================
# 6. ALERT CONFIGURATION
# ==================================================

EARTH_RADIUS_KM = 6371.0088
CLUSTER_DISTANCE_KM = 2.0

SEVERITY_ORDER = {
    "Critical": 0,
    "Warning": 1,
    "Informational": 2
}


# ==================================================
# 7. ALERT GENERATION AND FILTERING
# ==================================================


@app.get("/api/alerts")
@lru_cache(maxsize=128)
def get_alerts(
    limit: int = Query(default=10, ge=1, le=50),
    severity: str = Query(default="All"),
    search: str = Query(default="")
):

    alerts_df = prepare_dataframe()

    if alerts_df.empty:
        return {
            "total_alerts": 0,
            "matched_alerts": 0,
            "returned": 0,
            "severity_counts": {
                "critical": 0,
                "warning": 0,
                "informational": 0
            },
            "alerts": [],
            "source": "NASA FIRMS CSV"
        }

    coordinates = np.radians(
        alerts_df[["latitude", "longitude"]].to_numpy()
    )

    clusterer = DBSCAN(
        eps=CLUSTER_DISTANCE_KM / EARTH_RADIUS_KM,
        min_samples=2,
        metric="haversine",
        algorithm="ball_tree"
    )

    alerts_df["_cluster"] = clusterer.fit_predict(coordinates)

    generated_alerts = []

    clustered_data = alerts_df[
        alerts_df["_cluster"] != -1
    ]

    for cluster_id, group in clustered_data.groupby("_cluster"):

        count = len(group)
        max_frp = float(group["frp"].max())
        average_frp = float(group["frp"].mean())

        confidence_values = group["confidence"]

        high_count = int((confidence_values == "h").sum())
        nominal_count = int((confidence_values == "n").sum())
        low_count = int((confidence_values == "l").sum())

        if max_frp >= 50 or (count >= 5 and max_frp >= 20):
            level = "Critical"
        elif count >= 3 or max_frp >= 10 or high_count >= 2:
            level = "Warning"
        else:
            level = "Informational"

        latest = group["_datetime"].max()

        satellites = []

        if "satellite" in group.columns:
            satellites = sorted(
                group["satellite"]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            )

        generated_alerts.append({
            "id": f"cluster-{int(cluster_id)}",
            "title": "Geographic hotspot cluster",
            "severity": level,
            "latitude": round(float(group["latitude"].mean()), 5),
            "longitude": round(float(group["longitude"].mean()), 5),
            "detection_count": int(count),
            "maximum_frp": round(max_frp, 2),
            "average_frp": round(average_frp, 2),
            "high_confidence_count": high_count,
            "confidence_distribution": {
                "high": high_count,
                "nominal": nominal_count,
                "low": low_count
            },
            "latest_detection": (
                latest.strftime("%Y-%m-%d %H:%M UTC")
                if pd.notna(latest)
                else "Unknown"
            ),
            "_sort_time": (
                latest.timestamp()
                if pd.notna(latest)
                else 0
            ),
            "satellites": satellites
        })

    isolated = alerts_df[
        (alerts_df["_cluster"] == -1)
        & (alerts_df["frp"] >= 20)
        & (alerts_df["confidence"] == "h")
    ]

    for index, row in isolated.iterrows():

        detection_time = row["_datetime"]

        satellite = (
            str(row["satellite"])
            if "satellite" in row.index and pd.notna(row["satellite"])
            else "Unknown"
        )

        generated_alerts.append({
            "id": f"detection-{index}",
            "title": "High-intensity isolated detection",
            "severity": "Warning",
            "latitude": round(float(row["latitude"]), 5),
            "longitude": round(float(row["longitude"]), 5),
            "detection_count": 1,
            "maximum_frp": round(float(row["frp"]), 2),
            "average_frp": round(float(row["frp"]), 2),
            "high_confidence_count": 1,
            "confidence_distribution": {
                "high": 1,
                "nominal": 0,
                "low": 0
            },
            "latest_detection": (
                detection_time.strftime("%Y-%m-%d %H:%M UTC")
                if pd.notna(detection_time)
                else "Unknown"
            ),
            "_sort_time": (
                detection_time.timestamp()
                if pd.notna(detection_time)
                else 0
            ),
            "satellites": [satellite]
        })

    generated_alerts.sort(
        key=lambda alert: (
            SEVERITY_ORDER[alert["severity"]],
            -alert["_sort_time"]
        )
    )

    total_alerts = len(generated_alerts)

    severity_counts = {
        "critical": sum(
            a["severity"] == "Critical"
            for a in generated_alerts
        ),
        "warning": sum(
            a["severity"] == "Warning"
            for a in generated_alerts
        ),
        "informational": sum(
            a["severity"] == "Informational"
            for a in generated_alerts
        )
    }

    valid_severities = [
        "All",
        "Critical",
        "Warning",
        "Informational"
    ]

    if severity not in valid_severities:
        severity = "All"

    filtered_alerts = generated_alerts

    if severity != "All":
        filtered_alerts = [
            alert
            for alert in filtered_alerts
            if alert["severity"] == severity
        ]

    query = search.strip().lower()

    if query:

        def matches(alert):

            searchable_values = [
                str(alert["id"]),
                str(alert["title"]),
                str(alert["severity"]),
                str(alert["latitude"]),
                str(alert["longitude"]),
                str(alert["maximum_frp"]),
                str(alert["average_frp"]),
                str(alert["detection_count"]),
                str(alert["latest_detection"]),
                " ".join(alert["satellites"]),
                str(alert["high_confidence_count"])
            ]

            return any(
                query in value.lower()
                for value in searchable_values
            )

        filtered_alerts = [
            alert
            for alert in filtered_alerts
            if matches(alert)
        ]

    matched_alerts = len(filtered_alerts)

    visible_alerts = []

    for alert in filtered_alerts[:limit]:

        public_alert = {
            key: value
            for key, value in alert.items()
            if key != "_sort_time"
        }

        visible_alerts.append(public_alert)

    return {
        "total_alerts": total_alerts,
        "matched_alerts": matched_alerts,
        "returned": len(visible_alerts),
        "severity_counts": severity_counts,
        "active_filter": severity,
        "search": search,
        "alerts": visible_alerts,
        "cluster_distance_km": CLUSTER_DISTANCE_KM,
        "source": "NASA FIRMS CSV",
        "rules": {
            "critical": (
                "Maximum FRP >= 50 MW, or at least 5 "
                "detections with maximum FRP >= 20 MW"
            ),
            "warning": (
                "At least 3 detections, or maximum FRP >= 10 MW, "
                "or at least 2 high-confidence detections"
            ),
            "informational": "Other geographic clusters",
            "isolated_detection": (
                "High-confidence isolated detection "
                "with FRP >= 20 MW"
            )
        },
        "note": (
            "These are screening alerts generated from satellite "
            "thermal detections. They are not confirmed wildfire "
            "incidents. A geographic cluster is not necessarily "
            "a single fire."
        )
    }


# ==================================================
# 8. DATA & METHODS ANALYTICS
# ==================================================

@app.get("/api/analytics/charts")
def get_analytics_charts():

    data = prepare_dataframe()

    if data.empty:
        return {
            "total_observations": 0,
            "confidence_distribution": [],
            "frp_distribution": [],
            "daily_activity": [],
            "hourly_activity": [],
            "source": "NASA FIRMS CSV"
        }

    confidence_counts = (
        data["confidence"]
        .value_counts()
        .to_dict()
    )

    confidence_distribution = [
        {"category": "High", "count": int(confidence_counts.get("h", 0))},
        {"category": "Nominal", "count": int(confidence_counts.get("n", 0))},
        {"category": "Low", "count": int(confidence_counts.get("l", 0))}
    ]

    frp_bins = [
        (0, 1, "0–1 MW"),
        (1, 5, "1–5 MW"),
        (5, 10, "5–10 MW"),
        (10, 20, "10–20 MW"),
        (20, 50, "20–50 MW"),
        (50, float("inf"), "50+ MW")
    ]

    frp_distribution = []

    for lower, upper, label in frp_bins:

        if upper == float("inf"):
            count = int((data["frp"] >= lower).sum())
        else:
            count = int(
                (
                    (data["frp"] >= lower)
                    & (data["frp"] < upper)
                ).sum()
            )

        frp_distribution.append({
            "range": label,
            "observations": count
        })

    valid_dates = data.dropna(
        subset=["_datetime"]
    ).copy()

    daily_activity = []

    if not valid_dates.empty:

        valid_dates["date"] = (
            valid_dates["_datetime"].dt.strftime("%Y-%m-%d")
        )

        daily_counts = (
            valid_dates.groupby("date")
            .size()
            .sort_index()
        )

        daily_activity = [
            {
                "date": str(date),
                "detections": int(count)
            }
            for date, count in daily_counts.items()
        ]

    hourly_activity = []

    if "acq_time" in data.columns:

        acquisition_time = pd.to_numeric(
            data["acq_time"],
            errors="coerce"
        ).dropna()

        hours = acquisition_time.astype(int) // 100

        hourly_counts = (
            hours[hours.between(0, 23)]
            .value_counts()
            .sort_index()
        )

        hourly_activity = [
            {
                "hour": f"{int(hour):02d}:00",
                "detections": int(count)
            }
            for hour, count in hourly_counts.items()
        ]

    frp = data["frp"]

    return {
        "total_observations": int(len(data)),
        "confidence_distribution": confidence_distribution,
        "frp_distribution": frp_distribution,
        "daily_activity": daily_activity,
        "hourly_activity": hourly_activity,
        "frp_summary": {
            "average": round(float(frp.mean()), 2),
            "median": round(float(frp.median()), 2),
            "maximum": round(float(frp.max()), 2)
        },
        "source": "NASA FIRMS CSV",
        "note": (
            "Acquisition timestamps represent satellite observation "
            "times, not necessarily the actual time a fire started. "
            "Hourly values are grouped by the dataset's acquisition "
            "time field."
        )
    }


# ==================================================
# 9. INDIVIDUAL DETECTIONS FOR EXPLORE MAP
# ==================================================

@app.get("/api/detections")
def get_detections(
    limit: int = Query(default=10000, ge=1, le=15000),
    confidence: str = Query(default="All"),
    min_frp: float = Query(default=0, ge=0),
    max_frp: float = Query(default=10000, ge=0),
    date: str = Query(default="")
):

    data = prepare_dataframe()

    if confidence.lower() != "all":

        confidence_map = {
            "high": "h",
            "nominal": "n",
            "low": "l"
        }

        selected = confidence_map.get(confidence.lower())

        if selected:
            data = data[data["confidence"] == selected]

    data = data[
        (data["frp"] >= min_frp)
        & (data["frp"] <= max_frp)
    ]

    if date:
        data = data[
            data["_datetime"].dt.strftime("%Y-%m-%d") == date
        ]

    data = data.sort_values(
        "_datetime",
        ascending=False,
        na_position="last"
    )

    total = len(data)
    data = data.head(limit)

    detections = []

    for index, row in data.iterrows():

        detection_date = row["_datetime"]

        detections.append({
            "id": int(index),
            "latitude": round(float(row["latitude"]), 5),
            "longitude": round(float(row["longitude"]), 5),
            "frp": round(float(row["frp"]), 2),
            "confidence": str(row["confidence"]),
            "date": (
                detection_date.strftime("%Y-%m-%d")
                if pd.notna(detection_date)
                else "Unknown"
            ),
            "time": (
                detection_date.strftime("%H:%M")
                if pd.notna(detection_date)
                else "Unknown"
            ),
            "satellite": str(row.get("satellite", "Unknown")),
            "instrument": str(row.get("instrument", "Unknown")),
            "daynight": str(row.get("daynight", "Unknown"))
        })

    return {
        "total_detections": int(total),
        "returned": len(detections),
        "filters": {
            "confidence": confidence,
            "min_frp": min_frp,
            "max_frp": max_frp,
            "date": date
        },
        "detections": detections,
        "source": "NASA FIRMS CSV"
    }