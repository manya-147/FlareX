
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Clock3,
  Flame,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Satellite,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import './Alerts.css';

import { API_BASE_URL } from "./api";
const API_URL = `${API_BASE_URL}/api/alerts`;

function Alerts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedAlert, setExpandedAlert] = useState(null);

  // Fetch alerts whenever filters or search change
  useEffect(() => {
    const controller = new AbortController();

    const loadAlerts = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          limit: '10',
          severity: filter,
          search: search.trim(),
        });

        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Alerts API error:', err);
          setError(
            'Could not load alerts. Check that the FlareX backend is running.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Small delay prevents unnecessary requests while typing
    const timer = setTimeout(loadAlerts, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filter, search, refreshKey]);

  const alerts = data?.alerts ?? [];
  const counts = data?.severity_counts ?? {
    critical: 0,
    warning: 0,
    informational: 0,
  };

  const totalAlerts = data?.total_alerts ?? 0;
  const matchedAlerts = data?.matched_alerts ?? 0;

  const refreshAlerts = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const severityClass = (severity) =>
    (severity || 'informational').toLowerCase();

  return (
    <main className="alerts-page">

      {/* HEADER */}
      <header className="alerts-header">
        <div>
          <div className="alerts-eyebrow">
            <Bell size={15} />
            FLAREX MONITORING SYSTEM
          </div>

          <h1>Alerts & Notifications</h1>

          <p>
            Monitor and prioritise satellite thermal detection
            clusters identified by NASA FIRMS.
          </p>
        </div>

        <button
          className="alerts-refresh"
          onClick={refreshAlerts}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? 'alerts-spin' : ''}
          />
          Refresh
        </button>
      </header>

      {/* DATA SOURCE STATUS */}
      <div className="alerts-status-banner">
        <div className="alerts-status-icon">
          <Satellite size={20} />
        </div>

        <div>
          <strong>FIRMS data feed</strong>
          <p>{data?.source || 'NASA FIRMS CSV'}</p>
        </div>

        <span className="alerts-connected">
          <span />
          {loading
            ? 'Updating'
            : error
              ? 'Disconnected'
              : 'Connected'}
        </span>
      </div>

      {/* ERROR */}
      {error && (
        <div className="alerts-error">
          <AlertTriangle size={18} />
          {error}
          <button onClick={refreshAlerts}>Retry</button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="alerts-summary">

        <div className="alerts-summary-card">
          <div className="alerts-summary-icon orange">
            <Flame size={21} />
          </div>

          <span>Total screening alerts</span>
          <strong>{totalAlerts.toLocaleString()}</strong>
          <small>Generated from FIRMS detections</small>
        </div>

        <div className="alerts-summary-card">
          <div className="alerts-summary-icon red">
            <ShieldAlert size={21} />
          </div>

          <span>Critical priority</span>
          <strong>{counts.critical.toLocaleString()}</strong>
          <small>Highest screening priority</small>
        </div>

        <div className="alerts-summary-card">
          <div className="alerts-summary-icon yellow">
            <AlertTriangle size={21} />
          </div>

          <span>Warning priority</span>
          <strong>{counts.warning.toLocaleString()}</strong>
          <small>Requires further assessment</small>
        </div>

        <div className="alerts-summary-card">
          <div className="alerts-summary-icon teal">
            <Bell size={21} />
          </div>

          <span>Informational</span>
          <strong>{counts.informational.toLocaleString()}</strong>
          <small>Lower screening priority</small>
        </div>

      </section>

      {/* DETECTION FEED */}
      <section className="alerts-feed-section">

        <div className="alerts-feed-heading">
          <div>
            <span className="alerts-section-tag">
              DETECTION MONITOR
            </span>

            <h2>Detection feed</h2>

            <p>
              Review geographically clustered satellite observations
              and their screening priority.
            </p>
          </div>

          <div className="alerts-feed-total">
            {loading ? 'Updating...' : `${alerts.length} results`}
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="alerts-toolbar">

          <div className="alerts-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search coordinates, FRP, date or satellite..."
            />

            {search && (
              <button
                className="alerts-clear-search"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="alerts-filters">
            {[
              'All',
              'Critical',
              'Warning',
              'Informational',
            ].map((item) => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

        </div>

        {/* RESULTS */}
        <div className="alerts-list">

          {loading && !data ? (
            <div className="alerts-state">
              <RefreshCw className="alerts-spin" size={26} />
              <h3>Loading alerts...</h3>
              <p>Retrieving satellite detection data.</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="alerts-empty">
              <Search size={25} />
              <h3>No matching alerts</h3>
              <p>
                Try changing the severity filter or search term.
              </p>
            </div>
          ) : (

            alerts.map((alert) => {
              const severity = severityClass(alert.severity);
              const isExpanded = expandedAlert === alert.id;

              return (
                <article
                  className="alert-item"
                  key={alert.id}
                >

                  <div className={`alert-severity-icon ${severity}`}>
                    <Flame size={20} />
                  </div>

                  <div className="alert-main">

                    <div className="alert-title-row">
                      <h3>{alert.title}</h3>

                      <span className={`alert-badge ${severity}`}>
                        {alert.severity}
                      </span>
                    </div>

                    <div className="alert-details">

                      <span>
                        <MapPin size={14} />
                        {alert.latitude}, {alert.longitude}
                      </span>

                      <span>
                        <Clock3 size={14} />
                        {alert.latest_detection}
                      </span>

                      <span>
                        <Flame size={14} />
                        Max FRP: {alert.maximum_frp} MW
                      </span>

                      <span>
                        <Satellite size={14} />
                        {alert.detection_count} detections
                      </span>

                    </div>

                    <div className="alert-meta">
                      Average FRP: {alert.average_frp} MW
                      {' · '}
                      High-confidence detections:{' '}
                      {alert.high_confidence_count}
                    </div>

                    <button
                      className="alert-expand-button"
                      onClick={() =>
                        setExpandedAlert(
                          isExpanded ? null : alert.id
                        )
                      }
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                      <ChevronDown
                        size={15}
                        className={isExpanded ? 'rotated' : ''}
                      />
                    </button>

                    {isExpanded && (
                      <div className="alert-expanded">

                        <h4>Detection breakdown</h4>

                        <div className="alert-expanded-grid">
                          <div>
                            <small>High confidence</small>
                            <strong>
                              {alert.confidence_distribution?.high ?? 0}
                            </strong>
                          </div>

                          <div>
                            <small>Nominal confidence</small>
                            <strong>
                              {alert.confidence_distribution?.nominal ?? 0}
                            </strong>
                          </div>

                          <div>
                            <small>Low confidence</small>
                            <strong>
                              {alert.confidence_distribution?.low ?? 0}
                            </strong>
                          </div>
                        </div>

                        <p>
                          <strong>Satellites:</strong>{' '}
                          {alert.satellites?.length
                            ? alert.satellites.join(', ')
                            : 'Not available'}
                        </p>

                        <p>
                          <strong>Alert ID:</strong> {alert.id}
                        </p>

                        <a
                          href={`https://www.openstreetmap.org/?mlat=${alert.latitude}&mlon=${alert.longitude}#map=10/${alert.latitude}/${alert.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="alert-map-link"
                        >
                          View location on OpenStreetMap
                          <ExternalLink size={14} />
                        </a>

                      </div>
                    )}

                  </div>

                </article>
              );
            })

          )}

        </div>

        <div className="alerts-result-note">
          Showing {alerts.length} of {matchedAlerts.toLocaleString()} matching
          alerts
          {search.trim() ? ' for your search' : ''}
          {filter !== 'All' ? ` in ${filter}` : ''}.
        </div>

      </section>

      {/* DISCLAIMER */}
      <div className="alerts-disclaimer">
        <AlertTriangle size={19} />

        <p>
          <strong>Important:</strong> These are preliminary screening
          alerts generated by clustering NASA FIRMS satellite thermal
          detections. They are not confirmed wildfire incidents.
          Geographic proximity does not establish that detections
          belong to the same fire. Screening priority does not measure
          actual threat to people, property or infrastructure.
        </p>
      </div>

    </main>
  );
}

export default Alerts;