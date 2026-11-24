# 🔥 FlareX — Satellite-Powered Wildfire Intelligence

**Monitor. Analyse. Understand.**

FlareX is a satellite-powered wildfire intelligence platform that processes thermal observations from NASA's Fire Information for Resource Management System (FIRMS) to explore fire activity, identify geographical clusters, analyse thermal intensity, and generate preliminary screening alerts.

The platform combines satellite data processing, geospatial analysis, interactive visualisation, and analytical tools into a unified dashboard.

> 🚧 **Project status: Under active development**

---

## 🌍 Overview

Wildfires pose significant environmental, ecological, and economic challenges. Timely access to satellite observations can help identify areas experiencing unusual thermal activity and support further investigation.

FlareX aims to make satellite-based thermal observation data more accessible and interpretable through an interactive geospatial intelligence platform.

It currently focuses on:

- Monitoring satellite thermal observations.
- Exploring geographical patterns of detected thermal anomalies.
- Analysing Fire Radiative Power (FRP) and detection confidence.
- Identifying spatial concentrations using DBSCAN clustering.
- Generating preliminary screening alerts.
- Exploring historical observation patterns and analytical trends.

The long-term objective is to extend the platform with machine-learning-based forecasting capabilities.

## ✨ Features

### 1. Interactive Dashboard

- Overview of satellite thermal observations.
- Key observation statistics and FRP metrics.
- Recent detection activity.
- Quick access to platform modules.

### 2. Explore Map

- Interactive geographical visualisation of satellite observations.
- Observation locations displayed on a map.
- Confidence-based detection visualisation.
- Geographical exploration and filtering.

### 3. Risk Analysis

- Analysis of thermal observation characteristics.
- Exploration of detection intensity and spatial patterns.
- Geographical risk-screening insights.

### 4. Alerts & Notifications

- Spatial clustering of nearby thermal observations.
- Preliminary alerts based on observation count, FRP, and confidence.
- Severity categories:
  - Critical
  - Warning
  - Informational
- Search and filtering of generated alerts.

### 5. Data & Analytics

- Total observation count.
- Average, median, and maximum FRP.
- Confidence distribution.
- FRP intensity distribution.
- Seven-day observation comparison.
- Hourly satellite acquisition activity.
- Historical date-based analysis.

### 6. Authentication & User Profile

- User registration and login.
- Authentication-protected dashboard access.
- User profile interface.

---

## 🛰️ Data Source

FlareX uses satellite observation data from:

| Source               | Details                             |
| -------------------- | ----------------------------------- |
| Data provider        | NASA FIRMS                          |
| Satellite instrument | VIIRS                               |
| Satellite            | NOAA-21 (N21)                       |
| Data type            | Near Real-Time thermal observations |
| Historical data      | NASA FIRMS historical archive       |

**NASA FIRMS:** [https://firms.modaps.eosdis.nasa.gov/](https://firms.modaps.eosdis.nasa.gov/)

### Observation Attributes

| Attribute        | Description                         |
| ---------------- | ----------------------------------- |
| Latitude         | Geographic latitude                 |
| Longitude        | Geographic longitude                |
| Brightness       | Observed brightness temperature     |
| Scan             | Spatial scan dimension              |
| Track            | Spatial track dimension             |
| Acquisition Date | Date of satellite observation       |
| Acquisition Time | Satellite acquisition time          |
| Satellite        | Satellite identifier                |
| Confidence       | FIRMS detection confidence category |
| FRP              | Fire Radiative Power                |
| Day/Night        | Observation period                  |

---

## ⚙️ Technical Architecture

FlareX follows a frontend-backend architecture.

```text
                 NASA FIRMS
                     |
                     v
             Satellite Observations
                     |
                     v
              FastAPI Backend
                     |
          +----------+----------+
          |          |          |
          v          v          v
      Processing  Clustering  Analytics
          |          |          |
          +----------+----------+
                     |
                     v
                  REST API
                     |
                     v
              React Frontend
                     |
          +----------+----------+
          |          |          |
          v          v          v
       Dashboard  Explore Map  Analytics
          |
          v
     Alerts & Risk Analysis
```

### Backend

The backend is built using FastAPI and handles:

- Satellite data retrieval.
- Data cleaning and validation.
- Observation processing.
- Spatial clustering.
- Analytical calculations.
- Alert generation.
- Authentication and API responses.

### Frontend

The frontend uses React and Vite to provide:

- Interactive dashboard components.
- Geographical data visualisation.
- Analytical charts.
- Observation filtering.
- Alert interfaces.
- Authentication and profile pages.

---

## 🧠 Data Processing & Analytical Methods

### 1. Data Preprocessing

The observation processing pipeline includes:

- Loading satellite observation records.
- Validating latitude and longitude.
- Checking FRP values.
- Normalising confidence categories.
- Parsing acquisition dates and times.
- Removing invalid records.

### 2. Spatial Clustering — DBSCAN

FlareX uses **Density-Based Spatial Clustering of Applications with Noise (DBSCAN)** to identify geographical concentrations of thermal observations.

The current screening configuration uses an approximate clustering distance of 2 km.

DBSCAN helps identify groups of nearby observations without requiring the number of clusters to be specified in advance.

### 3. Fire Radiative Power Analysis

Fire Radiative Power (FRP) is used to analyse the radiant energy associated with detected thermal anomalies.

FlareX calculates:

- Average FRP.
- Median FRP.
- Maximum FRP.
- FRP intensity distributions.

### 4. Preliminary Alert Generation

Screening alerts are generated using combinations of:

- Number of nearby observations.
- Maximum FRP.
- Average FRP.
- Detection confidence.

These rules are intended to highlight areas that may require further assessment.

> **Important:** A thermal anomaly or a group of nearby detections does not automatically represent a confirmed wildfire.

---

## 🛠️ Technology Stack

| Component                     | Technologies           |
| ----------------------------- | ---------------------- |
| Programming languages         | Python, JavaScript     |
| Frontend                      | React, Vite            |
| Backend                       | FastAPI                |
| Data processing               | Pandas, NumPy          |
| Machine learning / clustering | Scikit-learn, DBSCAN   |
| Geospatial visualisation      | Leaflet, React-Leaflet |
| Charts                        | Recharts               |
| Maps                          | OpenStreetMap          |
| Satellite data                | NASA FIRMS, VIIRS      |
| Database                      | SQLite, SQLAlchemy     |
| Authentication                | JWT                    |
| Version control               | Git, GitHub            |
| Deployment                    | Vercel, Render         |

---

## 📁 Project Structure

```text
FlareX/
│
├── backend/
│   ├── main.py
│   ├── data/
│   │   └── raw/
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── data/
│
├── notebooks/
│
│
│
├── .gitignore
├── requirements.txt
└── README.md
```

*The structure is representative; individual files and folders may change as development progresses.*

---

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Python 3.10 or later.
- Node.js and npm.
- Git.
- A NASA FIRMS account and API key.

### 1. Clone the Repository

```bash
git clone https://github.com/manya-147/FlareX.git
cd FlareX
```

### 2. Set Up the Backend

Create and activate a virtual environment:

**macOS / Linux**

```bash
python3 -m venv venv
source venv/bin/activate
```

Install backend dependencies using the requirements file configured for your backend:

```bash
pip install -r backend/requirements.txt
```

If your deployment uses a separate requirements file, install that file instead.

### 3. Configure Environment Variables

Create a `.env` file in the backend directory.

Add your NASA FIRMS API key:

```env
NASA_FIRMS_MAP_KEY=your_nasa_firms_api_key
```

Add any additional authentication or database configuration required by your backend.

### 4. Start the Backend

From the repository root:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

The API should be available at:

```text
http://localhost:8000
```

FastAPI interactive documentation:

```text
http://localhost:8000/docs
```

### 5. Set Up the Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a frontend `.env` file:

```env
VITE_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Open the local Vite URL displayed in your terminal, usually:

```text
http://localhost:5173
```

---

## 🔌 API Endpoints

The FastAPI backend exposes endpoints for observation retrieval, analytics, alerts, and authentication.

| Endpoint                           | Description                                          |
| ---------------------------------- | ---------------------------------------------------- |
| `GET /`                            | Backend status                                       |
| `GET /api/live-observations`       | Retrieve live satellite observations                 |
| `GET /api/historical-observations` | Retrieve observations for a selected historical date |
| `GET /api/analytics/overview`      | Overall observation statistics                       |
| `GET /api/analytics/charts`        | Analytical chart data                                |
| `GET /api/detections`              | Retrieve and filter thermal detections               |
| `GET /api/alerts`                  | Retrieve generated screening alerts                  |
| `/api/auth/*`                      | Authentication routes                                |

For available request parameters and response schemas, use the FastAPI interactive documentation at `/docs`.

---

## ☁️ Deployment

The project uses separate hosting services for the frontend and backend.

| Component | Hosting |
| --------- | ------- |
| Frontend  | Vercel  |
| Backend   | Render  |

### Frontend Environment Variable

Configure this in Vercel:

```env
VITE_API_URL=https://your-backend-name.onrender.com
```

### Backend Environment Variables

Configure secrets in Render:

```env
NASA_FIRMS_MAP_KEY=your_nasa_firms_api_key
```

Also configure any additional variables required by the backend.

After changing frontend environment variables, redeploy the frontend. After changing backend environment variables, restart or redeploy the backend service.

---

## 🗺️ Roadmap

FlareX is being developed in stages.

### Planned Development

- [ ] Further dataset auditing and feature engineering
- [ ] Advanced geographical and temporal analysis
- [ ] Historical fire activity modelling
- [ ] Actual fire occurrence prediction
- [ ] Satellite thermal observation probability prediction
- [ ] Seven-day location-based forecasting
- [ ] Model evaluation and validation
- [ ] Predictive analytics dashboard
- [ ] Further performance and deployment improvements

---

## ⚠️ Limitations & Disclaimer

FlareX is an analytical and research-oriented project.

- Satellite thermal anomalies are not necessarily confirmed wildfires.
- FRP measures radiant energy and should not be interpreted as a direct measure of burned area or fire severity.
- FIRMS confidence categories are detection classifications, not calibrated probabilities of fire occurrence.
- Spatial clustering identifies geographical proximity, not necessarily individual fire incidents.
- Screening alerts are preliminary indicators and require independent verification.
- Predictive machine-learning capabilities are planned and must undergo validation before operational use.

**FlareX is not an emergency response system and should not be used as a substitute for official fire alerts, ground verification, or firefighting guidance.**

---

## 👩‍💻 Project

**FlareX** is an independent technical project exploring the intersection of:

- Artificial Intelligence and Machine Learning
- Geospatial Intelligence
- Satellite Remote Sensing
- Data Analytics
- Environmental Monitoring

**Status:** Under active development 🚧

---

*Turning satellite observations into meaningful environmental intelligence.*
