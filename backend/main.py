
from datetime import datetime, timedelta
from threading import Lock
from time import monotonic
from functools import wraps
import requests

import numpy as np
import pandas as pd

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.cluster import DBSCAN

if __package__:
    from .auth import router as auth_router
    from .database import Base, engine
    from .firms_service import (
        fetch_recent_observations,
        fetch_observations_for_date
    )
else:
    from auth import router as auth_router
    from database import Base, engine
    from firms_service import (
        fetch_recent_observations,
        fetch_observations_for_date
    )


# ==================================================
# 1. FASTAPI CONFIGURATION
# ==================================================

app = FastAPI(
    title="FlareX API",
    description="Live wildfire thermal observation intelligence API",
    version="2.0.0"
)

Base.metadata.create_all(bind=engine)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://flarex-lime.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# 2. LIVE DATA CONFIGURATION
# ==================================================

SOURCE = "NASA FIRMS - VIIRS NOAA-21 NRT"
DEFAULT_DAY_RANGE = 1

CACHE_TTL_SECONDS = 60
HISTORICAL_CACHE_TTL_SECONDS = 15 * 60

_cache = {}
_historical_cache = {}
_cache_lock = Lock()

EARTH_RADIUS_KM = 6371.0088
CLUSTER_DISTANCE_KM = 2.0

SEVERITY_ORDER = {
    "Critical": 0,
    "Warning": 1,
    "Informational": 2
}


# ==================================================
# 3. LIVE DATA FETCHING AND NORMALIZATION
# ==================================================

def get_live_snapshot(day_range=DEFAULT_DAY_RANGE, force_refresh=False):
    cache_key = day_range
    now = monotonic()

    with _cache_lock:
        cached = _cache.get(cache_key)

        if (
            cached
            and not force_refresh
            and now - cached["timestamp"] < CACHE_TTL_SECONDS
        ):
            return cached["observations"]

        try:
            observations = fetch_recent_observations(
                day_range=day_range
            )

            if not isinstance(observations, list):
                raise ValueError("NASA FIRMS returned an invalid response.")

            _cache[cache_key] = {
                "timestamp": monotonic(),
                "observations": observations
            }

            return observations

        except (RuntimeError, ValueError) as error:
            raise HTTPException(
                status_code=502,
                detail=f"NASA FIRMS data unavailable: {error}"
            ) from error


def get_historical_snapshot(selected_date):
    """Fetch and cache one NASA FIRMS historical date snapshot."""

    try:
        datetime.strptime(selected_date, "%Y-%m-%d")
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail="date must use YYYY-MM-DD format."
        ) from error

    now = monotonic()

    with _cache_lock:
        cached = _historical_cache.get(selected_date)

        if (
            cached
            and now - cached["timestamp"] < HISTORICAL_CACHE_TTL_SECONDS
        ):
            return cached["observations"], cached["source"]

    try:
        result = fetch_observations_for_date(selected_date)
        observations = result.get("observations", [])

        if not isinstance(observations, list):
            raise ValueError(
                "NASA FIRMS returned an invalid historical response."
            )

        source = result.get(
            "source",
            "NASA FIRMS Historical Archive"
        )

        with _cache_lock:
            _historical_cache[selected_date] = {
                "timestamp": monotonic(),
                "observations": observations,
                "source": source
            }

        return observations, source

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        ) from error

    except (RuntimeError, requests.RequestException) as error:
        raise HTTPException(
            status_code=502,
            detail=f"NASA FIRMS historical data unavailable: {error}"
        ) from error


def prepare_live_dataframe(day_range=DEFAULT_DAY_RANGE, date=None):

    if date:
        observations, _ = get_historical_snapshot(date)
    else:
        observations = get_live_snapshot(day_range)

    if not observations:
        return pd.DataFrame(
            columns=[
                "latitude",
                "longitude",
                "frp",
                "confidence",
                "_datetime"
            ]
        )

    data = pd.DataFrame(observations)
    data.columns = data.columns.str.strip().str.lower()

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
        raise HTTPException(
            status_code=502,
            detail=f"NASA FIRMS response is missing fields: {missing}"
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

        dates = data["acq_date"].astype(str)

        if "acq_time" in data.columns:

            times = (
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
                dates + " " + times,
                format="%Y-%m-%d %H%M",
                errors="coerce"
            )

        else:
            data["_datetime"] = pd.to_datetime(
                dates,
                errors="coerce"
            )

    else:
        data["_datetime"] = pd.NaT

    return data.reset_index(drop=True)


def safe_string(value, default="Unknown"):
    if pd.isna(value):
        return default

    return str(value)


def confidence_counts(data):

    values = data["confidence"].value_counts().to_dict()

    return {
        "high": int(values.get("h", 0)),
        "nominal": int(values.get("n", 0)),
        "low": int(values.get("l", 0))
    }


def frp_summary(data):

    values = data["frp"].dropna()

    return {
        "average": (
            round(float(values.mean()), 2)
            if not values.empty else 0
        ),
        "median": (
            round(float(values.median()), 2)
            if not values.empty else 0
        ),
        "maximum": (
            round(float(values.max()), 2)
            if not values.empty else 0
        )
    }


def serialize_detection(index, row):

    detection_time = row["_datetime"]

    return {
        "id": int(index),
        "latitude": round(float(row["latitude"]), 5),
        "longitude": round(float(row["longitude"]), 5),
        "frp": round(float(row["frp"]), 2),
        "confidence": safe_string(
            row["confidence"],
            "unknown"
        ),
        "date": (
            detection_time.strftime("%Y-%m-%d")
            if pd.notna(detection_time)
            else safe_string(row.get("acq_date"), "Unknown")
        ),
        "time": (
            detection_time.strftime("%H:%M")
            if pd.notna(detection_time)
            else str(row.get("acq_time", "Unknown"))
        ),
        "satellite": safe_string(row.get("satellite")),
        "instrument": safe_string(row.get("instrument")),
        "daynight": safe_string(row.get("daynight"))
    }


# ==================================================
# 4. HOME / HEALTH CHECK
# ==================================================

@app.get("/")
def home():

    return {
        "message": "FlareX API is running",
        "mode": "LIVE",
        "source": SOURCE,
        "satellite": "VIIRS NOAA-21",
        "coverage": "India FIRMS area feed",
        "refresh_interval_minutes": 15,
        "data_type": "Satellite thermal observations",
        "note": (
            "Thermal observations are not necessarily "
            "confirmed wildfire incidents."
        )
    }


# ==================================================
# 5. LIVE OBSERVATIONS
# ==================================================

@app.get("/api/live-observations")
def get_live_observations(
    day_range: int = Query(default=1, ge=1, le=5),
    refresh: bool = Query(default=False)
):

    observations = get_live_snapshot(
        day_range=day_range,
        force_refresh=refresh
    )

    return {
        "total_observations": len(observations),
        "day_range_days": day_range,
        "observations": observations,
        "source": SOURCE,
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "note": (
            "Thermal satellite detections are not necessarily "
            "confirmed fire incidents. Acquisition time is not "
            "the same as fire start time."
        )
    }


# ==================================================
# 5A. HISTORICAL OBSERVATIONS
# ==================================================

@app.get("/api/historical-observations")
def get_historical_observations(
    date: str = Query(
        ...,
        description="Date in YYYY-MM-DD format"
    )
):

    observations, archive_source = get_historical_snapshot(date)

    return {
        "date": date,
        "total_observations": len(observations),
        "observations": observations,
        "source": f"NASA FIRMS - {archive_source}",
        "mode": "HISTORICAL",
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "note": (
            "Observations acquired on the selected date. "
            "These are satellite thermal anomalies, not "
            "necessarily confirmed wildfire incidents."
        )
    }


# ==================================================
# 6. ANALYTICS OVERVIEW
# ==================================================

@app.get("/api/analytics/overview")
def get_overview(
    date: str = Query(
        default="",
        description="Optional historical date YYYY-MM-DD"
    )
):

    data = prepare_live_dataframe(date=date or None)

    historical = bool(date)

    _, archive_source = (
        get_historical_snapshot(date)
        if historical else ([], "")
    )

    return {
        "total_detections": int(len(data)),
        "confidence": confidence_counts(data),
        "frp": frp_summary(data),
        "source": (
            f"NASA FIRMS - {archive_source}"
            if historical else SOURCE
        ),
        "mode": "HISTORICAL" if historical else "LIVE",
        "date": date or None
    }


# ==================================================
# 7. INDIVIDUAL DETECTIONS
# ==================================================

@app.get("/api/detections")
def get_detections(
    limit: int = Query(default=10000, ge=1, le=15000),
    confidence: str = Query(default="All"),
    min_frp: float = Query(default=0, ge=0),
    max_frp: float = Query(default=10000, ge=0),
    date: str = Query(default="")
):

    if min_frp > max_frp:
        raise HTTPException(
            status_code=400,
            detail="min_frp cannot be greater than max_frp."
        )

    data = prepare_live_dataframe(date=date or None)

    if confidence.lower() != "all":

        confidence_map = {
            "high": "h",
            "nominal": "n",
            "low": "l"
        }

        selected = confidence_map.get(confidence.lower())

        if selected:
            data = data[
                data["confidence"] == selected
            ]

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

    detections = [
        serialize_detection(index, row)
        for index, row in data.iterrows()
    ]

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
        "source": (
            f"NASA FIRMS - {get_historical_snapshot(date)[1]}"
            if date else SOURCE
        ),
        "mode": "HISTORICAL" if date else "LIVE"
    }


# ==================================================
# 8. LIVE SCREENING ALERTS
# ==================================================

@app.get("/api/alerts")
def get_alerts(
    limit: int = Query(default=10, ge=1, le=50),
    severity: str = Query(default="All"),
    search: str = Query(default=""),
    date: str = Query(
        default="",
        description="Optional historical date YYYY-MM-DD"
    )
):

    data = prepare_live_dataframe(date=date or None)

    historical = bool(date)

    source = (
        f"NASA FIRMS - {get_historical_snapshot(date)[1]}"
        if historical else SOURCE
    )

    mode = "HISTORICAL" if historical else "LIVE"

    if len(data) < 2:

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
            "source": source,
            "mode": mode,
            "cluster_distance_km": CLUSTER_DISTANCE_KM
        }

    coordinates = np.radians(
        data[["latitude", "longitude"]].to_numpy()
    )

    clusterer = DBSCAN(
        eps=CLUSTER_DISTANCE_KM / EARTH_RADIUS_KM,
        min_samples=2,
        metric="haversine",
        algorithm="ball_tree"
    )

    data["_cluster"] = clusterer.fit_predict(coordinates)

    generated_alerts = []

    clustered_data = data[
        data["_cluster"] != -1
    ]

    for cluster_id, group in clustered_data.groupby("_cluster"):

        count = len(group)

        max_frp = float(group["frp"].max())

        average_frp = float(group["frp"].mean())

        counts = confidence_counts(group)

        high_count = counts["high"]

        if max_frp >= 50 or (count >= 5 and max_frp >= 20):
            level = "Critical"

        elif count >= 3 or max_frp >= 10 or high_count >= 2:
            level = "Warning"

        else:
            level = "Informational"

        latest = group["_datetime"].max()

        satellites = (
            sorted(
                group["satellite"]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            )
            if "satellite" in group.columns
            else []
        )

        generated_alerts.append({
            "id": f"cluster-{int(cluster_id)}",
            "title": "Geographic hotspot cluster",
            "severity": level,
            "latitude": round(
                float(group["latitude"].mean()), 5
            ),
            "longitude": round(
                float(group["longitude"].mean()), 5
            ),
            "detection_count": int(count),
            "maximum_frp": round(max_frp, 2),
            "average_frp": round(average_frp, 2),
            "high_confidence_count": high_count,
            "confidence_distribution": counts,
            "latest_detection": (
                latest.strftime("%Y-%m-%d %H:%M UTC")
                if pd.notna(latest)
                else "Unknown"
            ),
            "_sort_time": (
                latest.timestamp()
                if pd.notna(latest) else 0
            ),
            "satellites": satellites
        })

    isolated = data[
        (data["_cluster"] == -1)
        & (data["frp"] >= 20)
        & (data["confidence"] == "h")
    ]

    for index, row in isolated.iterrows():

        detection_time = row["_datetime"]

        satellite = safe_string(
            row.get("satellite")
        )

        generated_alerts.append({
            "id": f"detection-{index}",
            "title": "High-intensity isolated detection",
            "severity": "Warning",
            "latitude": round(
                float(row["latitude"]), 5
            ),
            "longitude": round(
                float(row["longitude"]), 5
            ),
            "detection_count": 1,
            "maximum_frp": round(
                float(row["frp"]), 2
            ),
            "average_frp": round(
                float(row["frp"]), 2
            ),
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
            alert["severity"] == "Critical"
            for alert in generated_alerts
        ),
        "warning": sum(
            alert["severity"] == "Warning"
            for alert in generated_alerts
        ),
        "informational": sum(
            alert["severity"] == "Informational"
            for alert in generated_alerts
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

    filtered = generated_alerts

    if severity != "All":

        filtered = [
            alert for alert in filtered
            if alert["severity"] == severity
        ]

    query = search.strip().lower()

    if query:

        def matches(alert):

            values = [
                alert["id"],
                alert["title"],
                alert["severity"],
                alert["latitude"],
                alert["longitude"],
                alert["maximum_frp"],
                alert["average_frp"],
                alert["detection_count"],
                alert["latest_detection"],
                " ".join(alert["satellites"]),
                alert["high_confidence_count"]
            ]

            return any(
                query in str(value).lower()
                for value in values
            )

        filtered = [
            alert for alert in filtered
            if matches(alert)
        ]

    visible_alerts = []

    for alert in filtered[:limit]:

        public_alert = {
            key: value
            for key, value in alert.items()
            if key != "_sort_time"
        }

        visible_alerts.append(public_alert)

    return {
        "total_alerts": total_alerts,
        "matched_alerts": len(filtered),
        "returned": len(visible_alerts),
        "severity_counts": severity_counts,
        "active_filter": severity,
        "search": search,
        "alerts": visible_alerts,
        "cluster_distance_km": CLUSTER_DISTANCE_KM,
        "source": source,
        "mode": mode,
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
                "High-confidence isolated detection with FRP >= 20 MW"
            )
        },
        "note": (
            "These are preliminary screening alerts generated from "
            "satellite thermal detections. They are not confirmed "
            "wildfire incidents. Geographic proximity does not prove "
            "that detections belong to one fire."
        )
    }


# ==================================================
# 9. DATA & METHODS ANALYTICS
# ==================================================

def get_weekly_comparison(selected_date):
    """
    Return seven daily observation counts ending on selected_date.

    The selected date is included, along with the previous six days.
    Unavailable archive dates are represented as None, not zero.
    """

    try:
        anchor_date = datetime.strptime(
            selected_date,
            "%Y-%m-%d"
        ).date()

    except (TypeError, ValueError) as error:

        raise HTTPException(
            status_code=400,
            detail="date must use YYYY-MM-DD format."
        ) from error

    weekly_comparison = []

    for offset in range(6, -1, -1):

        current_date = anchor_date - timedelta(days=offset)

        date_string = current_date.strftime("%Y-%m-%d")

        try:
            daily_data = prepare_live_dataframe(
                date=date_string
            )

            detections = int(len(daily_data))
            available = True

        except HTTPException as error:

            if error.status_code == 404:
                detections = None
                available = False

            else:
                raise

        weekly_comparison.append({
            "date": date_string,
            "detections": detections,
            "available": available
        })

    return weekly_comparison


@app.get("/api/analytics/charts")
def get_analytics_charts(
    date: str = Query(
        default="",
        description="Optional historical date YYYY-MM-DD"
    )
):

    # Selected date controls the KPI and distribution calculations.
    data = prepare_live_dataframe(
        date=date or None
    )

    historical = bool(date)

    source = (
        f"NASA FIRMS - {get_historical_snapshot(date)[1]}"
        if historical else SOURCE
    )

    mode = "HISTORICAL" if historical else "LIVE"

    # --------------------------------------------------
    # CONFIDENCE DISTRIBUTION
    # --------------------------------------------------

    confidence = confidence_counts(data)

    confidence_distribution = [
        {
            "category": "High",
            "count": confidence["high"]
        },
        {
            "category": "Nominal",
            "count": confidence["nominal"]
        },
        {
            "category": "Low",
            "count": confidence["low"]
        }
    ]

    # --------------------------------------------------
    # FRP DISTRIBUTION
    # --------------------------------------------------

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

            count = int(
                (data["frp"] >= lower).sum()
            )

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

    # --------------------------------------------------
    # DAILY ACTIVITY
    # --------------------------------------------------

    valid_dates = data.dropna(
        subset=["_datetime"]
    ).copy()

    daily_activity = []

    if not valid_dates.empty:

        valid_dates["date"] = (
            valid_dates["_datetime"]
            .dt.strftime("%Y-%m-%d")
        )

        daily_counts = (
            valid_dates.groupby("date")
            .size()
            .sort_index()
        )

        daily_activity = [
            {
                "date": str(date_value),
                "detections": int(count)
            }
            for date_value, count in daily_counts.items()
        ]

    # --------------------------------------------------
    # SEVEN-DAY COMPARISON
    # --------------------------------------------------

    comparison_anchor = (
        date or datetime.utcnow().strftime("%Y-%m-%d")
    )

    weekly_comparison = get_weekly_comparison(
        comparison_anchor
    )

    # --------------------------------------------------
    # HOURLY ACTIVITY
    # --------------------------------------------------

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

    # --------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------

    return {
        "total_observations": int(len(data)),

        "confidence_distribution": confidence_distribution,

        "frp_distribution": frp_distribution,

        "daily_activity": daily_activity,

        "weekly_comparison": weekly_comparison,

        "weekly_comparison_period": {
            "start_date": weekly_comparison[0]["date"],
            "end_date": weekly_comparison[-1]["date"]
        },

        "hourly_activity": hourly_activity,

        "frp_summary": frp_summary(data),

        "source": source,

        "mode": mode,

        "date": date or None,

        "note": (
            "Analytics are calculated from the selected NASA FIRMS "
            "observation snapshot. "
            "The weekly comparison uses seven individual daily "
            "historical archive snapshots. "
            "Acquisition times are satellite observation times, "
            "not necessarily fire start times. "
            "Hourly values use the FIRMS acquisition time field."
        )
    }
