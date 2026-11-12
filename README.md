#  FlareX — Satellite-Powered Wildfire Intelligence

**FlareX** is a satellite-powered wildfire intelligence platform designed to analyse fire activity, identify spatial patterns, monitor thermal anomalies, and provide geospatial insights for wildfire monitoring and risk assessment.

The project uses satellite observations from NASA FIRMS (Fire Information for Resource Management System) to process fire detections, analyse their characteristics, identify clusters of activity, and generate alerts.

The long-term goal is to integrate predictive machine learning models that estimate the likelihood of actual fire occurrence and satellite thermal observations over the next seven days for any selected geographical location.

> **Project Status:** Under Development 🚧

---

##  Project Objectives

- Monitor satellite-based fire and thermal anomaly detections.
- Analyse fire activity using geographical and temporal information.
- Identify clusters of fire detections using spatial clustering.
- Generate alerts based on fire activity and intensity.
- Visualise fire detections and analytical insights through an interactive dashboard.
- Develop predictive models for future fire occurrence and satellite observations.

##  Data Source

FlareX currently uses satellite observation data from:

- **NASA FIRMS** — Fire Information for Resource Management System.
- **VIIRS** — Visible Infrared Imaging Radiometer Suite.
- **Satellite:** N21.

The dataset contains the following information:

| Attribute | Description |
|---|---|
| Latitude | Geographic latitude |
| Longitude | Geographic longitude |
| Brightness | Observed brightness temperature |
| Scan | Spatial scan dimension |
| Track | Spatial track dimension |
| Acquisition Date | Date of observation |
| Acquisition Time | Time of observation |
| Satellite | Satellite identifier |
| Confidence | Detection confidence |
| FRP | Fire Radiative Power |
| Day/Night | Observation period |

### Dataset Overview

- Total observations: 7,127
- Total columns: 14
- Missing values: 0
- Mean Fire Radiative Power: 4.29 MW
- Median Fire Radiative Power: 2.15 MW
- Maximum Fire Radiative Power: 93.62 MW

##  Current Implementation

### 1. Data Processing and Preprocessing
- Loading and processing NASA FIRMS CSV data.
- Validating geographical coordinates and FRP values.
- Normalising confidence information.
- Parsing acquisition dates and timestamps.
- Removing invalid records.

### 2. Geospatial Analysis
- Processing geographical coordinates.
- Applying DBSCAN clustering to identify spatial concentrations of fire detections.
- Identifying nearby detections within an approximate 2 km clustering distance.
- Analysing spatial patterns in observed fire activity.

### 3. Analytics and Visualisation Backend

A FastAPI backend provides data to the frontend through dedicated API endpoints.

Current endpoints include:

- `/` — Backend status.
- `/api/analytics/overview` — Overall analytical statistics.
- `/api/analytics/charts` — Data for analytical charts.
- `/api/detections` — Fire detection records.
- `/api/alerts` — Generated fire activity alerts.

Authentication routes have also been integrated.

### 4. Alert Generation
- Generating screening alerts based on detected fire activity.
- Using spatial clustering and fire-related attributes to identify areas requiring attention.

**Note:** Current alerts are analytical screening indicators, not confirmed fire incidents or independently validated risk predictions.

##  Planned Machine Learning Component

The next major development phase involves integrating predictive machine learning models.

The intended prediction system will focus on two related but distinct outputs:

**1. Actual Fire Occurrence Prediction**
- Estimate the likelihood of fire occurrence at a selected location.
- Analyse historical fire activity and relevant geographical and temporal patterns.

**2. Satellite Thermal Observation Prediction**
- Estimate the probability of a satellite thermal anomaly being observed.
- Account for satellite observation patterns and detection characteristics.

### Prediction Scope
- User-selectable geographical locations.
- Seven-day prediction horizon.
- Separate outputs for fire occurrence and satellite thermal observation probability.

The dataset will undergo further auditing and preparation before model development and evaluation.

## Technology Stack

| Component | Technologies |
|---|---|
| Programming Language | Python, JavaScript |
| Frontend | React, Vite |
| Backend | FastAPI |
| Data Processing | Pandas, NumPy |
| Machine Learning | Scikit-learn |
| Clustering | DBSCAN |
| Data Source | NASA FIRMS, VIIRS |
| Visualisation | Interactive maps and analytical charts |
| Version Control | Git, GitHub |

##  Project Structure

The project is organised around a frontend and backend architecture.

```text
FlareX/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── main.py
│   ├── data/
│   │   └── raw/
│   │       └── DL_FIRE_J2V-C2_837818/
│   │           └── fire_nrt_J2V-C2_837818.csv
│   ├── requirements.txt
│   └── ...
│
├── .gitignore
└── README.md
```

*Note: This is a representative structure; adjust the paths to match the actual repository.*

##  Future Roadmap

- [ ] Further dataset auditing and feature engineering.
- [ ] Exploratory analysis for predictive modelling.
- [ ] Fire occurrence prediction model.
- [ ] Satellite thermal observation probability model.
- [ ] Seven-day location-based forecasting.
- [ ] Frontend improvements and prediction dashboard.
- [ ] Model evaluation and deployment.

##  Disclaimer

FlareX is an ongoing development project. Satellite thermal detections do not necessarily represent confirmed wildfires. Predictive capabilities are under development and should not be treated as operational emergency or firefighting guidance.

##  Project Development

FlareX is being developed as an independent technical project exploring satellite data processing, geospatial intelligence, machine learning, and wildfire monitoring.

**Status:** Work in Progress 🚧
