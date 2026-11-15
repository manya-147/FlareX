
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Database,
} from 'lucide-react';
import './RiskAnalysis.css';

import { API_BASE_URL } from './api';

const API_URL = `${API_BASE_URL}/api/analytics/overview`;

function MetricCard({ icon: Icon, label, value, unit, description }) {
  return (
    <div className="risk-metric-card">
      <div className="risk-metric-icon">
        <Icon size={21} />
      </div>

      <p className="risk-metric-label">{label}</p>

      <h2 className="risk-metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </h2>

      <p className="risk-metric-description">{description}</p>
    </div>
  );
}

function RiskAnalysis({ selectedDate = '' }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (selectedDate) {
        params.set('date', selectedDate);
      }

      const url = params.toString()
        ? `${API_URL}?${params.toString()}`
        : API_URL;

      const response = await fetch(url, { signal });

      if (!response.ok) {
        let message = `API returned status ${response.status}`;

        try {
          const errorData = await response.json();
          if (errorData.detail) {
            message = errorData.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const data = await response.json();
      setOverview(data);
    } catch (err) {
      if (err.name === 'AbortError') return;

      console.error('FlareX API error:', err);
      setError(
        err.message ||
        'Unable to connect to the FlareX backend. Make sure the FastAPI server is running on port 8000.'
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    const controller = new AbortController();

    fetchOverview(controller.signal);

    return () => controller.abort();
  }, [fetchOverview]);

  const confidence = overview?.confidence ?? {};

  const confidenceData = [
    {
      label: 'High',
      value: confidence.high ?? 0,
      className: 'high',
    },
    {
      label: 'Nominal',
      value: confidence.nominal ?? 0,
      className: 'nominal',
    },
    {
      label: 'Low',
      value: confidence.low ?? 0,
      className: 'low',
    },
  ];

  const maxConfidence = Math.max(
    ...confidenceData.map((item) => item.value),
    1
  );

  const isHistorical = Boolean(selectedDate);

  const modeLabel = isHistorical
    ? `Historical observations · ${selectedDate}`
    : 'Live observations';

  if (loading && !overview) {
    return (
      <div className="risk-analysis-page">
        <div className="risk-loading">
          <RefreshCw className="spin" size={28} />
          <h2>
            Loading {isHistorical ? 'historical' : 'live'} observation analytics...
          </h2>
          <p>
            {isHistorical
              ? `Retrieving NASA FIRMS observations for ${selectedDate}`
              : 'Connecting to NASA FIRMS data'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="risk-analysis-page">
        <div className="risk-error">
          <AlertTriangle size={32} />
          <h2>Backend connection failed</h2>
          <p>{error}</p>

          <button
            onClick={() => fetchOverview()}
            className="risk-refresh-button"
          >
            <RefreshCw size={16} />
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="risk-analysis-page">
      {/* PAGE HEADER */}
      <div className="risk-page-header">
        <div>
          <div className="risk-eyebrow">
            <Activity size={15} />
            FLAREX INTELLIGENCE
          </div>

          <h1>Risk Analysis</h1>

          <p>
            Explore wildfire detection statistics and fire radiative power
            from satellite observations.
          </p>
        </div>

        <button
          className="risk-refresh-button"
          onClick={() => fetchOverview()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh data
        </button>
      </div>

      {/* DATA SOURCE */}
      <div className="risk-source-banner">
        <div className="risk-source-icon">
          <Database size={19} />
        </div>

        <div>
          <strong>
            {isHistorical
              ? 'Historical data connection'
              : 'Live backend connection'}
          </strong>

          <p>
            Source: {overview?.source || 'NASA FIRMS NOAA-21'}
          </p>

          <p>{modeLabel}</p>
        </div>

        <span className="risk-live-status">
          <span className="risk-status-dot" />
          {isHistorical ? 'Historical' : 'Connected'}
        </span>
      </div>

      {/* REFRESH ERROR */}
      {error && (
        <div className="risk-error">
          <AlertTriangle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* OVERVIEW */}
      <section className="risk-section">
        <div className="risk-section-heading">
          <div>
            <span className="risk-section-tag">01 / OVERVIEW</span>
            <h2>Detection overview</h2>
            <p>
              Statistics calculated from the {isHistorical ? 'selected date' : 'latest live'}
              {' '}satellite observations.
            </p>
          </div>
        </div>

        <div className="risk-metrics-grid">
          <MetricCard
            icon={Flame}
            label="Total detections"
            value={(overview?.total_detections ?? 0).toLocaleString()}
            description="Satellite thermal detections"
          />

          <MetricCard
            icon={TrendingUp}
            label="Average FRP"
            value={overview?.frp?.average ?? '—'}
            unit=" MW"
            description="Mean fire radiative power"
          />

          <MetricCard
            icon={BarChart3}
            label="Median FRP"
            value={overview?.frp?.median ?? '—'}
            unit=" MW"
            description="Middle FRP value"
          />

          <MetricCard
            icon={AlertTriangle}
            label="Maximum FRP"
            value={overview?.frp?.maximum ?? '—'}
            unit=" MW"
            description="Highest recorded FRP"
          />
        </div>
      </section>

      {/* CONFIDENCE */}
      <section className="risk-section">
        <div className="risk-section-heading">
          <div>
            <span className="risk-section-tag">02 / RELIABILITY</span>
            <h2>Detection confidence</h2>
            <p>
              Distribution of detections across FIRMS confidence categories.
            </p>
          </div>
        </div>

        <div className="risk-content-card">
          <div className="risk-confidence-header">
            <div>
              <h3>Confidence distribution</h3>
              <p>Number of detections in each category</p>
            </div>

            <ShieldCheck size={23} />
          </div>

          {confidenceData.map((item) => (
            <div className="risk-confidence-row" key={item.label}>
              <div className="risk-confidence-info">
                <span>{item.label} confidence</span>
                <strong>{item.value.toLocaleString()}</strong>
              </div>

              <div className="risk-progress-track">
                <div
                  className={`risk-progress-fill ${item.className}`}
                  style={{
                    width: `${(item.value / maxConfidence) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}

          <div className="risk-confidence-note">
            <AlertTriangle size={17} />
            <p>
              FIRMS confidence categories indicate detection confidence.
              They are not probabilities that a wildfire is occurring.
            </p>
          </div>
        </div>
      </section>

      {/* FRP INFORMATION */}
      <section className="risk-section">
        <div className="risk-section-heading">
          <div>
            <span className="risk-section-tag">03 / FIRE BEHAVIOUR</span>
            <h2>Fire radiative power</h2>
            <p>Understanding the intensity measurements in the dataset.</p>
          </div>
        </div>

        <div className="risk-content-card">
          <div className="risk-frp-heading">
            <div className="risk-frp-icon">
              <Flame size={24} />
            </div>

            <div>
              <h3>FRP statistics</h3>
              <p>Measured in megawatts (MW)</p>
            </div>
          </div>

          <div className="risk-frp-grid">
            <div>
              <span>Average</span>
              <strong>{overview?.frp?.average ?? '—'} MW</strong>
            </div>

            <div>
              <span>Median</span>
              <strong>{overview?.frp?.median ?? '—'} MW</strong>
            </div>

            <div>
              <span>Maximum</span>
              <strong>{overview?.frp?.maximum ?? '—'} MW</strong>
            </div>
          </div>

          <p className="risk-explanation">
            Fire Radiative Power (FRP) measures the rate at which energy is
            emitted by a detected thermal anomaly. It is an indicator of
            radiative intensity, not a direct measurement of burned area
            or proof of a confirmed wildfire.
          </p>
        </div>
      </section>

      {/* UPCOMING ANALYSIS */}
      <section className="risk-section">
        <div className="risk-section-heading">
          <div>
            <span className="risk-section-tag">04 / NEXT ANALYSIS</span>
            <h2>Intelligence modules</h2>
            <p>
              Additional analysis that can be built on top of the connected
              detection data.
            </p>
          </div>
        </div>

        <div className="risk-module-grid">
          <div className="risk-module-card">
            <Activity size={22} />
            <h3>Temporal trends</h3>
            <p>
              Analyse detection patterns over time using acquisition dates.
            </p>
            <span>Not connected yet</span>
          </div>

          <div className="risk-module-card">
            <Flame size={22} />
            <h3>Hotspot clustering</h3>
            <p>
              Identify geographic clusters using latitude and longitude.
            </p>
            <span>Not connected yet</span>
          </div>

          <div className="risk-module-card">
            <ShieldCheck size={22} />
            <h3>Geographic exposure</h3>
            <p>
              Use OpenStreetMap data to assess nearby forests, roads and
              settlements.
            </p>
            <span>OSM integration pending</span>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <div className="risk-disclaimer">
        <AlertTriangle size={18} />
        <p>
          <strong>Data interpretation:</strong> These statistics are calculated
          from satellite thermal detections. A thermal anomaly is not
          automatically a confirmed wildfire. Regional risk scores, exposure
          estimates and predictive analysis have not yet been implemented.
        </p>
      </div>
    </div>
  );
}

export default RiskAnalysis;
