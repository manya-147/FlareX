
import os
from pathlib import Path
from io import StringIO
from datetime import datetime, date

import requests
import pandas as pd
from dotenv import load_dotenv


# Load backend/.env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MAP_KEY = os.getenv("NASA_FIRMS_MAP_KEY")

# India bounding box: west, south, east, north
INDIA_BBOX = "68,6,98,36"

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
AVAILABILITY_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv"
)

# NOAA-21 VIIRS sources
LIVE_SOURCE = "VIIRS_NOAA21_NRT"
ARCHIVE_SOURCE = "VIIRS_NOAA21_SP"


def _check_api_key():
    if not MAP_KEY:
        raise ValueError(
            "NASA_FIRMS_MAP_KEY is missing from backend/.env"
        )


def _parse_firms_response(response):
    response.raise_for_status()

    data = pd.read_csv(StringIO(response.text))

    if "latitude" not in data.columns:
        raise ValueError(
            f"Unexpected FIRMS response: {response.text[:300]}"
        )

    return data.to_dict(orient="records")


def fetch_recent_observations(day_range=1):
    """
    Fetch recent VIIRS NOAA-21 NRT observations over India.
    day_range must be between 1 and 5.
    """
    _check_api_key()

    if not 1 <= day_range <= 5:
        raise ValueError("day_range must be between 1 and 5")

    url = (
        f"{BASE_URL}/{MAP_KEY}/"
        f"{LIVE_SOURCE}/{INDIA_BBOX}/{day_range}"
    )

    try:
        response = requests.get(url, timeout=45)
        return _parse_firms_response(response)

    except requests.RequestException as error:
        raise RuntimeError(
            f"NASA FIRMS live API request failed: {error}"
        ) from error



def get_noaa21_data_availability():
    """
    Retrieve NASA's available date ranges for NOAA-21 NRT and SP data.
    """
    _check_api_key()

    try:
        response = requests.get(
            f"{AVAILABILITY_URL}/{MAP_KEY}/all",
            timeout=30
        )
        response.raise_for_status()

        availability = pd.read_csv(StringIO(response.text))

        if availability.empty:
            raise RuntimeError(
                "NASA returned an empty data availability response."
            )

        # NASA's date-range response uses data_id, not source.
        availability.columns = [
            str(column).strip().lower()
            for column in availability.columns
        ]

        if "data_id" in availability.columns:
            availability = availability.rename(
                columns={"data_id": "source"}
            )

        required_columns = {"source", "min_date", "max_date"}

        if not required_columns.issubset(availability.columns):
            raise RuntimeError(
                "Unexpected NASA availability columns: "
                + ", ".join(availability.columns)
                + ". Response: "
                + response.text[:500]
            )

        return availability

    except requests.RequestException as error:
        raise RuntimeError(
            f"Could not check NASA data availability: {error}"
        ) from error


def fetch_observations_for_date(selected_date):
    """
    Fetch NOAA-21 observations for one exact historical date.

    Uses NRT when that date is available in NRT.
    Otherwise uses Standard Processing (SP) when available.
    """

    _check_api_key()

    try:
        requested_date = datetime.strptime(
            str(selected_date), "%Y-%m-%d"
        ).date()
    except ValueError as error:
        raise ValueError(
            "Date must be in YYYY-MM-DD format."
        ) from error

    if requested_date > date.today():
        raise ValueError("Future dates cannot be requested.")

    availability = get_noaa21_data_availability()

    # Normalize column names returned by NASA
    availability.columns = [
        str(column).strip().lower()
        for column in availability.columns
    ]

    required_columns = {"source", "min_date", "max_date"}
    if not required_columns.issubset(availability.columns):
        raise RuntimeError(
            "NASA availability response has an unexpected format."
        )

    available_source = None

    for source in (LIVE_SOURCE, ARCHIVE_SOURCE):
        rows = availability[
            availability["source"].astype(str).str.strip() == source
        ]

        for _, row in rows.iterrows():
            try:
                min_date = datetime.strptime(
                    str(row["min_date"])[:10], "%Y-%m-%d"
                ).date()
                max_date = datetime.strptime(
                    str(row["max_date"])[:10], "%Y-%m-%d"
                ).date()
            except (ValueError, TypeError):
                continue

            if min_date <= requested_date <= max_date:
                available_source = source
                break

        if available_source:
            break

    if not available_source:
        raise ValueError(
            f"NASA has no NOAA-21 data available for {requested_date}. "
            "Try another date."
        )

    url = (
        f"{BASE_URL}/{MAP_KEY}/"
        f"{available_source}/{INDIA_BBOX}/1/{requested_date}"
    )

    try:
        response = requests.get(url, timeout=45)
        observations = _parse_firms_response(response)

        return {
            "date": str(requested_date),
            "source": available_source,
            "total": len(observations),
            "observations": observations
        }

    except requests.RequestException as error:
        raise RuntimeError(
            f"NASA FIRMS historical request failed: {error}"
        ) from error
