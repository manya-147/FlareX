
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from "./api";
import Login from './Login.jsx';
import Signup from './Signup.jsx';
import { states, stateList, loadDistricts } from 'vardhan-maps/data';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

import Alerts from './Alerts.jsx';
import DataMethods from './DataMethods.jsx';
import ExploreMap from './ExploreMap';
import Profile from './Profile.jsx';
import RiskAnalysis from './RiskAnalysis';

import {
  Flame,
  House,
  Map as MapIcon,
  ChartNoAxesColumn,
  Bell,
  Layers,
  Search,
  UserRound,
  Satellite,
  ArrowRight,
  Wind,
  Plus,
  Minus,
  LocateFixed,
  RefreshCw,
  Activity,
  Clock3,
  AlertTriangle,
  Info
} from 'lucide-react';

import './App.css';

const API = API_BASE_URL;
const INDIA_CENTER = [22.5, 79];

const CONFIDENCE_COLORS = {
  h: '#ff5548',
  n: '#ff9d4d',
  l: '#f4d16b'
};

const SEVERITY_COLORS = {
  Critical: '#ff5548',
  Warning: '#ff9d4d',
  Informational: '#65cbb4'
};

const confidenceLabel = value => ({
  h: 'High',
  n: 'Nominal',
  l: 'Low'
}[value] || 'Unknown');

// Map controls connected to the actual Leaflet map
function HomeMapControls() {
  const map = useMap();

  return (
    <div className="home-map-controls">
      <button
        type="button"
        title="Zoom in"
        onClick={() => map.zoomIn()}
      >
        <Plus size={17} />
      </button>

      <button
        type="button"
        title="Zoom out"
        onClick={() => map.zoomOut()}
      >
        <Minus size={17} />
      </button>

      <button
        type="button"
        title="Reset India view"
        onClick={() => map.flyTo(INDIA_CENTER, 4, { duration: 0.8 })}
      >
        <LocateFixed size={17} />
      </button>
    </div>
  );
}

// Shared application shell
function AppLayout({ children, navigation, activePage, navigate, onLogout }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Flame size={38} fill="#ff7838" color="#ff7838" />

          <div>
            <h1>Flare<span>X</span></h1>
            <small>Wildfire Intelligence</small>
          </div>
        </div>

        <nav className="navigation">
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              className={activePage === label ? 'selected' : ''}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>
            Satellite-powered wildfire monitoring for a safer environment.
          </p>

          <div className="footer-line" />
        </div>
      </aside>

      <main
        className={`main-content ${
          ['Risk Analysis', 'Alerts'].includes(activePage)
            ? 'main-content-full'
            : ''
        }`}
      >
        {children}
      </main>
    </div>
  );
}

function App() {
  const [visitedPages, setVisitedPages] = useState(['Home']);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authPage, setAuthPage] = useState('login');
  const [authNotice, setAuthNotice] = useState('');

  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districts, setDistricts] = useState([]);

  const [activePage, setActivePage] = useState('Home');
  const [mapLayer, setMapLayer] = useState('Detections');
  const [search, setSearch] = useState('');

  const [overview, setOverview] = useState(null);
  const [detections, setDetections] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Restore saved login session
  useEffect(() => {
    async function restoreSession() {
      const token =
        localStorage.getItem('flarex-token') ||
        sessionStorage.getItem('flarex-token');

      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Session expired');
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('flarex-token');
        localStorage.removeItem('flarex-user');
        sessionStorage.removeItem('flarex-token');
        sessionStorage.removeItem('flarex-user');
      } finally {
        setAuthChecked(true);
      }
    }

    restoreSession();
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError('');

      const options = { signal: controller.signal };

      try {
        const [overviewResponse, detectionResponse, alertResponse] =
          await Promise.all([
            fetch(`${API}/api/analytics/overview`, options),
            fetch(`${API}/api/detections?limit=1200`, options),
            fetch(`${API}/api/alerts?limit=10`, options)
          ]);

        if (!overviewResponse.ok) {
          throw new Error('Unable to load dashboard statistics.');
        }

        if (!detectionResponse.ok) {
          throw new Error('Unable to load satellite observations.');
        }

        if (!alertResponse.ok) {
          throw new Error('Unable to load geographic alerts.');
        }

        const [overviewData, detectionData, alertData] =
          await Promise.all([
            overviewResponse.json(),
            detectionResponse.json(),
            alertResponse.json()
          ]);

        if (!Array.isArray(detectionData.detections)) {
          throw new Error('Invalid detection data received.');
        }

        setOverview(overviewData);
        setDetections(detectionData.detections);
        setAlerts(Array.isArray(alertData.alerts) ? alertData.alerts : []);
        setLastUpdated(new Date());

      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('FlareX dashboard error:', err);
          setError(err.message || 'Unable to connect to FlareX API.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [user]);

  // Load districts when a state is selected
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setSelectedDistrict('');
      return;
    }

    const result = loadDistricts(selectedState);

    setDistricts(
      Array.isArray(result) ? result : result?.features || []
    );

    setSelectedDistrict('');
  }, [selectedState]);

  // Filter observations by selected state and district
  const geographicDetections = useMemo(() => {
    return detections.filter(item => {
      const coordinates = point([
        Number(item.longitude),
        Number(item.latitude)
      ]);

      if (selectedState) {
        const stateFeature = states.features.find(feature => {
          const name =
            feature.properties?.name ||
            feature.properties?.NAME_1 ||
            feature.properties?.st_nm;

          return name?.toLowerCase() === selectedState.toLowerCase();
        });

        if (
          !stateFeature ||
          !booleanPointInPolygon(coordinates, stateFeature)
        ) {
          return false;
        }
      }

      if (selectedDistrict) {
        const districtFeature = districts.find(feature =>
          feature.properties?.name === selectedDistrict
        );

        if (
          !districtFeature ||
          !booleanPointInPolygon(coordinates, districtFeature)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [detections, selectedState, selectedDistrict, districts]);

  // Search loaded observations
  const filteredDetections = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return geographicDetections;

    const matchedState = stateList.find(state =>
      state.name.toLowerCase().startsWith(query)
    );

    if (matchedState) {
      const stateFeature = states.features.find(feature => {
        const name =
          feature.properties?.name ||
          feature.properties?.NAME_1 ||
          feature.properties?.st_nm;

        return name?.toLowerCase() === matchedState.name.toLowerCase();
      });

      if (stateFeature) {
        return geographicDetections.filter(item => {
          const coordinates = point([
            Number(item.longitude),
            Number(item.latitude)
          ]);

          return booleanPointInPolygon(coordinates, stateFeature);
        });
      }
    }

    return geographicDetections.filter(item => {
      const values = [
        item.latitude,
        item.longitude,
        item.date,
        item.time,
        item.satellite,
        item.instrument,
        item.frp,
        item.confidence
      ];

      return values.join(' ').toLowerCase().includes(query);
    });
  }, [geographicDetections, search]);

  // Latest observations
  const recentDetections = useMemo(() => {
    return [...filteredDetections]
      .sort((a, b) => {
        const dateA = `${a.date} ${a.time}`;
        const dateB = `${b.date} ${b.time}`;
        return dateB.localeCompare(dateA);
      })
      .slice(0, 5);
  }, [filteredDetections]);

  const highRiskCount = alerts.filter(
    alert => ['Critical', 'Warning'].includes(alert.severity)
  ).length;

  // Navigation: mount a page the first time it is visited.
  // Keep it mounted afterward so its local state is preserved.
  function navigate(page) {
    setVisitedPages(prev =>
      prev.includes(page) ? prev : [...prev, page]
    );

    setActivePage(page);
  }

  function handleLogout() {
    localStorage.removeItem('flarex-token');
    localStorage.removeItem('flarex-user');
    sessionStorage.removeItem('flarex-token');
    sessionStorage.removeItem('flarex-user');

    setUser(null);
    setAuthPage('login');
    setAuthNotice('');
    setActivePage('Home');
    setVisitedPages(['Home']);
  }

  const navigation = [
    ['Home', House],
    ['Explore Map', MapIcon],
    ['Risk Analysis', ChartNoAxesColumn],
    ['Alerts', Bell],
    ['Data & Methods', Layers],
    ['Profile', UserRound]
  ];

  // Wait while checking a saved session
  if (!authChecked) {
    return <div className="auth-page">Loading FlareX...</div>;
  }

  // Show authentication before the dashboard
  if (!user) {
    if (authPage === 'signup') {
      return (
        <Signup
          onSignupSuccess={() => {
            setAuthPage('login');
            setAuthNotice('Account created successfully. Please sign in.');
          }}
          onSwitchToLogin={() => {
            setAuthPage('login');
            setAuthNotice('');
          }}
        />
      );
    }

    return (
      <Login
        notice={authNotice}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthNotice('');
          setActivePage('Home');
          setVisitedPages(['Home']);
        }}
        onSwitchToSignup={() => {
          setAuthPage('signup');
          setAuthNotice('');
        }}
      />
    );
  }

  // Main application: all visited pages remain mounted.
  return (
    <AppLayout
      navigation={navigation}
      activePage={activePage}
      navigate={navigate}
      onLogout={handleLogout}
    >

      {/* HOME PAGE */}
      {visitedPages.includes('Home') && (
        <div
          className="home-page"
          style={{ display: activePage === 'Home' ? 'block' : 'none' }}
        >
          {/* HERO */}
          <section className="hero-banner">
            <div className="topbar">
              <span>WILDFIRE MONITORING PLATFORM</span>

              <div className="top-actions">
                <div className="search">
                  <Search size={17} />

                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search observations..."
                  />

                  {search && (
                    <button
                      type="button"
                      className="home-search-clear"
                      onClick={() => setSearch('')}
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  className="notification-btn"
                  onClick={() => navigate('Alerts')}
                  title="View alerts"
                >
                  <Bell size={19} />
                </button>

                <button
                  className="round-button"
                  onClick={() => navigate('Profile')}
                  title="My Profile"
                >
                  <UserRound />
                </button>
              </div>
            </div>

            <div className="hero-text">
              <h2>Track. Understand. <span>Act.</span></h2>

              <p>
                Satellite data and geospatial intelligence
                to monitor wildfire activity across India.
              </p>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="home-error">
              <Info size={17} />

              <div>
                <strong>Dashboard connection issue</strong>
                <p>
                  {error} Make sure your FastAPI backend is running on port 8000.
                </p>
              </div>

              <button onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          )}

          {/* STATISTICS */}
          <section className="stats-grid">
            <button
              className="stat-card fire-card home-stat-button"
              onClick={() => navigate('Explore Map')}
            >
              <div className="stat-icon orange">
                <Flame size={29} />
              </div>

              <div>
                <p>Total Fire Detections</p>

                <h3>
                  {loading && !overview
                    ? '...'
                    : (overview?.total_detections ?? '—').toLocaleString()}
                </h3>

                <small>From loaded FIRMS dataset</small>
              </div>
            </button>

            <button
              className="stat-card risk-card home-stat-button"
              onClick={() => navigate('Alerts')}
            >
              <div className="stat-icon teal">
                <Layers size={28} />
              </div>

              <div>
                <p>Warning / Critical Alerts</p>

                <h3>
                  {loading && alerts.length === 0
                    ? '...'
                    : highRiskCount.toLocaleString()}
                </h3>

                <small>DBSCAN screening alerts</small>
              </div>
            </button>

            <div className="stat-card update-card">
              <div className="stat-icon purple">
                <Activity size={28} />
              </div>

              <div>
                <p>Average Fire Radiative Power</p>

                <h3>
                  {overview?.frp?.average ?? '—'}
                  <small> MW</small>
                </h3>

                <small>Across valid observations</small>
              </div>
            </div>
          </section>

          {/* DATA STATUS */}
          <div className="home-data-status">
            <span className="home-status-dot" />

            <span>Source: NASA FIRMS CSV</span>

            <span className="home-status-divider">|</span>

            <span>{overview?.source || 'Waiting for API'}</span>

            <span className="home-status-divider">|</span>

            <span>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : 'Not updated yet'}
            </span>
          </div>

          {/* MAIN DASHBOARD */}
          <section className="dashboard-grid">

            {/* MAP */}
            <div className="map-panel">
              <div className="map-heading">
                <div>
                  <h3>Explore Fire Activity</h3>
                  <p>Satellite observations across India</p>
                </div>

                <div className="map-tabs">
                  <button
                    className={mapLayer === 'Detections' ? 'active-tab' : ''}
                    onClick={() => setMapLayer('Detections')}
                  >
                    <Flame size={15} />
                    Detections
                  </button>

                  <button
                    className={mapLayer === 'Risk Zones' ? 'active-tab' : ''}
                    onClick={() => setMapLayer('Risk Zones')}
                  >
                    <Layers size={15} />
                    Risk Zones
                  </button>
                </div>
              </div>

              <div className="map-area home-leaflet-map">
                <MapContainer
                  center={INDIA_CENTER}
                  zoom={4}
                  minZoom={3}
                  maxZoom={13}
                  scrollWheelZoom={true}
                  zoomControl={false}
                  worldCopyJump={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <ZoomControl position="bottomright" />
                  <HomeMapControls />

                  {mapLayer === 'Detections' &&
                    filteredDetections.map(detection => {
                      const color =
                        CONFIDENCE_COLORS[detection.confidence] ||
                        CONFIDENCE_COLORS.n;

                      const radius = Math.min(
                        3 + Math.sqrt(Math.max(Number(detection.frp) || 0, 0)),
                        8
                      );

                      return (
                        <CircleMarker
                          key={detection.id}
                          center={[
                            Number(detection.latitude),
                            Number(detection.longitude)
                          ]}
                          radius={radius}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.78,
                            weight: 1
                          }}
                        >
                          <Popup>
                            <strong>Thermal Observation</strong>
                            <br />
                            FRP: {detection.frp} MW
                            <br />
                            Confidence: {confidenceLabel(detection.confidence)}
                            <br />
                            Date: {detection.date}
                            <br />
                            Satellite: {detection.satellite}
                          </Popup>
                        </CircleMarker>
                      );
                    })}

                  {mapLayer === 'Risk Zones' &&
                    alerts.map(alert => {
                      const color =
                        SEVERITY_COLORS[alert.severity] ||
                        SEVERITY_COLORS.Informational;

                      return (
                        <CircleMarker
                          key={alert.id}
                          center={[
                            Number(alert.latitude),
                            Number(alert.longitude)
                          ]}
                          radius={Math.min(
                            7 + Math.sqrt(Number(alert.detection_count) || 1) * 3,
                            18
                          )}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.35,
                            weight: 2
                          }}
                        >
                          <Popup>
                            <strong>{alert.title}</strong>
                            <br />
                            Severity: {alert.severity}
                            <br />
                            Detections: {alert.detection_count}
                            <br />
                            Maximum FRP: {alert.maximum_frp} MW
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                </MapContainer>

                <div className="home-map-label">
                  <span className="home-status-dot" />

                  {mapLayer === 'Detections'
                    ? `${filteredDetections.length.toLocaleString()} loaded observations`
                    : `${alerts.length.toLocaleString()} generated alerts`}
                </div>

                {loading && (
                  <div className="home-map-loading">
                    <RefreshCw size={14} />
                    Loading map data...
                  </div>
                )}
              </div>

              {/* MAP LEGEND */}
              <div className="map-legend home-map-legend">
                {mapLayer === 'Detections' ? (
                  <>
                    <strong>Fire Confidence</strong>
                    <p><i className="high" /> High</p>
                    <p><i className="medium" /> Nominal</p>
                    <p><i className="low" /> Low</p>
                  </>
                ) : (
                  <>
                    <strong>Alert Severity</strong>
                    <p><i className="high" /> Critical</p>
                    <p><i className="medium" /> Warning</p>
                    <p><i className="low" /> Informational</p>
                  </>
                )}
              </div>

              <button
                className="home-map-link"
                onClick={() => navigate('Explore Map')}
              >
                Open full Explore Map
                <ArrowRight size={15} />
              </button>
            </div>

            {/* RIGHT COLUMN */}
            <div className="right-column">

              {/* RECENT ACTIVITY */}
              <div className="panel alerts-panel">
                <div className="panel-title">
                  <h3>
                    <Bell color="#ff883f" />
                    Recent Activity
                  </h3>

                  <button
                    className="home-view-all"
                    onClick={() => navigate('Explore Map')}
                  >
                    View all
                  </button>
                </div>

                {recentDetections.length > 0 ? (
                  <div className="home-recent-list">
                    {recentDetections.map(item => (
                      <button
                        key={item.id}
                        className="home-recent-item"
                        onClick={() => navigate('Explore Map')}
                      >
                        <div
                          className="home-recent-icon"
                          style={{
                            color:
                              CONFIDENCE_COLORS[item.confidence] ||
                              CONFIDENCE_COLORS.n
                          }}
                        >
                          <Flame size={18} />
                        </div>

                        <div className="home-recent-info">
                          <strong>
                            {item.frp} MW thermal detection
                          </strong>

                          <p>
                            {Number(item.latitude).toFixed(3)}°,
                            {' '}
                            {Number(item.longitude).toFixed(3)}°
                          </p>

                          <span>
                            <Clock3 size={11} />
                            {item.date} · {item.time} UTC
                          </span>
                        </div>

                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-activity">
                    <div className="activity-icon">
                      <Satellite />
                    </div>

                    <div>
                      <strong>
                        {loading ? 'Loading observations...' : 'No observations found'}
                      </strong>

                      <p>
                        {search
                          ? 'Try another search term.'
                          : 'Recent satellite observations will appear here.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* QUICK ACTIONS */}
              <div className="panel actions-panel">
                <h3>Explore FlareX</h3>

                <button
                  className="quick-action"
                  onClick={() => navigate('Explore Map')}
                >
                  <div className="quick-icon orange">
                    <MapIcon />
                  </div>

                  <div>
                    <strong>Explore Map</strong>
                    <p>View individual detections and locations</p>
                  </div>

                  <ArrowRight />
                </button>

                <button
                  className="quick-action"
                  onClick={() => navigate('Risk Analysis')}
                >
                  <div className="quick-icon teal">
                    <ChartNoAxesColumn />
                  </div>

                  <div>
                    <strong>Risk Analysis</strong>
                    <p>Understand thermal activity patterns</p>
                  </div>

                  <ArrowRight />
                </button>

                <button
                  className="quick-action"
                  onClick={() => navigate('Alerts')}
                >
                  <div className="quick-icon orange">
                    <AlertTriangle />
                  </div>

                  <div>
                    <strong>Alerts</strong>
                    <p>Review generated geographic alerts</p>
                  </div>

                  <ArrowRight />
                </button>

                <button
                  className="quick-action"
                  onClick={() => navigate('Data & Methods')}
                >
                  <div className="quick-icon purple">
                    <Layers />
                  </div>

                  <div>
                    <strong>Data & Methods</strong>
                    <p>Explore satellite sources and methodology</p>
                  </div>

                  <ArrowRight />
                </button>
              </div>

              <div className="bottom-note">
                <Wind size={19} />
                <span>
                  Turning satellite observations into useful insights.
                </span>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="home-footer">
            <span>FLAREX WILDFIRE INTELLIGENCE</span>
            <span>NASA FIRMS DATA</span>
            <span>OPENSTREETMAP</span>
          </footer>
        </div>
      )}

      {/* EXPLORE MAP */}
      {visitedPages.includes('Explore Map') && (
        <div style={{ display: activePage === 'Explore Map' ? 'block' : 'none' }}>
          <ExploreMap
            search={search}
            onSearchChange={setSearch}
            selectedState={selectedState}
            onStateChange={setSelectedState}
            selectedDistrict={selectedDistrict}
            onDistrictChange={setSelectedDistrict}
          />
        </div>
      )}

      {/* RISK ANALYSIS */}
      {visitedPages.includes('Risk Analysis') && (
        <div style={{ display: activePage === 'Risk Analysis' ? 'block' : 'none' }}>
          <RiskAnalysis />
        </div>
      )}

      {/* ALERTS */}
      {visitedPages.includes('Alerts') && (
        <div style={{ display: activePage === 'Alerts' ? 'block' : 'none' }}>
          <Alerts />
        </div>
      )}

      {/* DATA & METHODS */}
      {visitedPages.includes('Data & Methods') && (
        <div style={{ display: activePage === 'Data & Methods' ? 'block' : 'none' }}>
          <DataMethods />
        </div>
      )}

      {/* PROFILE */}
      {visitedPages.includes('Profile') && (
        <div style={{ display: activePage === 'Profile' ? 'block' : 'none' }}>
          <Profile onLogout={handleLogout} user={user} />
        </div>
      )}

    </AppLayout>
  );
}

export default App;
