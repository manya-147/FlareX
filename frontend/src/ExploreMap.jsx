
import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap
} from 'react-leaflet';

import {
  Search,
  Flame,
  CalendarDays,
  RotateCcw,
  RefreshCw,
  MapPin,
  Activity,
  Layers3,
  Info,
  Crosshair,
  Satellite,
  Clock3,
  X,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { states, stateList, loadDistricts } from 'vardhan-maps/data';

import 'leaflet/dist/leaflet.css';
import './ExploreMap.css';

const API_URL = 'http://127.0.0.1:8000/api/detections';

const COLORS = {
  h: '#ff5548',
  n: '#ff9d4d',
  l: '#f4d16b'
};

const confidenceLabel = (value) => ({
  h: 'High',
  n: 'Nominal',
  l: 'Low'
}[value] || 'Unknown');

function intensityRange(value) {
  if (value === 'Low') return [0, 5];
  if (value === 'Medium') return [5, 20];
  if (value === 'High') return [20, 10000];
  return [0, 10000];
}


function MapFocusController({ selected, feature }) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      const lat = Number(selected.latitude);
      const lng = Number(selected.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      map.flyTo(
        [lat, lng],
        Math.max(map.getZoom(), 9),
        { duration: 1.1 }
      );

      return;
    }

    if (feature?.geometry) {
      const bounds = L.geoJSON(feature).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 8,
          animate: true
        });
      }
    }
  }, [selected, feature, map]);

  return null;
}


function detectionInsideFeature(detection, feature) {
  if (!feature?.geometry) return false;

  const latitude = Number(detection.latitude);
  const longitude = Number(detection.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  try {
    return booleanPointInPolygon(point([longitude, latitude]), feature);
  } catch {
    return false;
  }
}

export default function ExploreMap({
  search: sharedSearch,
  onSearchChange,
  selectedState: sharedState,
  onStateChange,
  selectedDistrict: sharedDistrict,
  onDistrictChange
}) {
  const [detections, setDetections] = useState([]);
  const [selected, setSelected] = useState(null);

  const [confidence, setConfidence] = useState('All');
  const [intensity, setIntensity] = useState('All');
  const [date, setDate] = useState('');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [localState, setLocalState] = useState('');
  const [localDistrict, setLocalDistrict] = useState('');

  const search = sharedSearch ?? localSearch;
  const setSearch = onSearchChange ?? setLocalSearch;

  const selectedState = sharedState ?? localState;
  const setSelectedState = onStateChange ?? setLocalState;

  const selectedDistrict = sharedDistrict ?? localDistrict;
  const setSelectedDistrict = onDistrictChange ?? setLocalDistrict;
  const [districts, setDistricts] = useState([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDetections() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          limit: '10000',
          confidence,
          date
        });

        const [minFrp, maxFrp] = intensityRange(intensity);

        params.set('min_frp', String(minFrp));
        params.set('max_frp', String(maxFrp));

        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();

        if (!Array.isArray(result.detections)) {
          throw new Error('Invalid detections response from API.');
        }

        setDetections(result.detections);
        setSelected(null);

      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load observations.');
          setDetections([]);
          setSelected(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDetections();

    return () => controller.abort();
  }, [confidence, intensity, date, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    setSelectedDistrict('');
    setDistricts([]);
    setGeoError('');

    if (!selectedState) return undefined;

    async function fetchDistricts() {
      setDistrictLoading(true);
      try {
        const result = await loadDistricts(selectedState);
        if (!cancelled) setDistricts(result);
      } catch (err) {
        if (!cancelled) {
          setGeoError(err.message || 'Could not load district boundaries.');
        }
      } finally {
        if (!cancelled) setDistrictLoading(false);
      }
    }

    fetchDistricts();
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  const selectedStateFeature = useMemo(
    () => states.features.find(
      feature => feature.properties?.name === selectedState
    ),
    [selectedState]
  );

  const selectedDistrictFeature = useMemo(
    () => districts.find(
      feature => feature.properties?.name === selectedDistrict
    ),
    [districts, selectedDistrict]
  );

  const geographicallyFiltered = useMemo(() => {
    if (!selectedStateFeature && !selectedDistrictFeature) return detections;

    return detections.filter(detection => {
      if (
        selectedStateFeature &&
        !detectionInsideFeature(detection, selectedStateFeature)
      ) return false;

      if (
        selectedDistrictFeature &&
        !detectionInsideFeature(detection, selectedDistrictFeature)
      ) return false;

      return true;
    });
  }, [detections, selectedStateFeature, selectedDistrictFeature]);

  
const visible = useMemo(() => {
  const query = search.trim().toLowerCase();

  if (!query) return geographicallyFiltered;

  // Search by Indian state name
  const matchedState = stateList.find(
    state => state.name.toLowerCase() === query
  );

  if (matchedState) {
    const stateFeature = states.features.find(
      feature =>
        feature.properties?.name?.toLowerCase() ===
        matchedState.name.toLowerCase()
    );

    if (stateFeature) {
      return geographicallyFiltered.filter(
        detection => detectionInsideFeature(detection, stateFeature)
      );
    }
  }

  // Otherwise search observation details
  return geographicallyFiltered.filter(item => {
    const values = [
      item.latitude,
      item.longitude,
      item.date,
      item.time,
      item.satellite,
      item.instrument,
      item.frp,
      confidenceLabel(item.confidence)
    ];

    return values.join(' ').toLowerCase().includes(query);
  });
}, [geographicallyFiltered, search]);

  const searchResults = useMemo(
    () => search.trim().length >= 2 ? visible.slice(0, 8) : [],
    [visible, search]
  );

  const stats = useMemo(() => {
    const high = visible.filter(
      item => item.confidence === 'h'
    ).length;

    const totalFrp = visible.reduce(
      (sum, item) => sum + (Number(item.frp) || 0),
      0
    );

    return {
      total: visible.length,
      high,
      averageFrp: visible.length
        ? (totalFrp / visible.length).toFixed(1)
        : '0.0'
    };
  }, [visible]);

  function resetFilters() {
    setConfidence('All');
    setIntensity('All');
    setDate('');
    setSearch('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelected(null);
  }

  function refreshData() {
    setRefreshKey(value => value + 1);
  }

  function selectDetection(detection) {
    setSelected(detection);
  }

  return (
    <main className="flare-explore">

      {/* PAGE HEADER */}
      <header className="fx-header">
        <div className="fx-heading">
          <div className="fx-eyebrow">
            <span className="fx-eyebrow-dot" />
            FLAREX / GEOSPATIAL INTELLIGENCE
          </div>

          <h1>Explore Fire Activity</h1>

          <p>
            Monitor satellite-detected thermal anomalies across geographic regions.
          </p>
        </div>

        <div className="fx-header-actions">
          <div className="fx-source-status">
            <span className="fx-live-dot" />
            NASA FIRMS DATA
          </div>

          <button className="fx-refresh" onClick={refreshData}>
            <RefreshCw size={15} />
            Refresh data
          </button>
        </div>
      </header>

      {/* SEARCH */}
      
{/* SEARCH */}
<div className="fx-search-row">
  <div className="fx-search">
    <Search size={17} />

    <input
      type="text"
      value={search}
      onChange={e => setSearch(e.target.value)}
      onFocus={() => setSearchOpen(true)}
      onKeyDown={e => {
        if (e.key === 'Escape') setSearchOpen(false);
      }}
      placeholder="Search coordinates, satellite, date, FRP..."
    />

    {search && (
      <button
        onClick={() => setSearch('')}
        aria-label="Clear search"
      >
        <X size={15} />
      </button>
    )}
  </div>

  <div className="fx-search-hint">
    <Crosshair size={14} />
    Search loaded observations
  </div>

  {searchOpen && search.trim().length >= 2 && (
    <div className="fx-search-results">
      <div className="fx-search-results-heading">
        <span>OBSERVATIONS</span>
        <strong>{visible.length} matches</strong>
      </div>

      {searchResults.length > 0 ? (
        <div className="fx-search-results-list">
          {searchResults.map((item, index) => (
            <button
              className="fx-search-result"
              key={item.id ?? `${item.latitude}-${item.longitude}-${index}`}
              onClick={() => {
                selectDetection(item);
                setSearchOpen(false);
              }}
            >
              <span className="fx-result-marker">
                <Flame size={16} />
              </span>

              <span className="fx-result-main">
                <strong>
                  {item.satellite || 'Satellite observation'} · {item.frp} MW
                </strong>

                <small>
                  {item.latitude}, {item.longitude}
                </small>

                <small>
                  {item.date} · {item.time || ''} UTC
                </small>
              </span>

              <span className="fx-result-confidence">
                {confidenceLabel(item.confidence)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="fx-search-no-results">
          No matching observations found.
        </p>
      )}

      {visible.length > searchResults.length && (
        <p className="fx-search-more">
          Showing the first {searchResults.length} matches.
        </p>
      )}
    </div>
  )}
</div>


      {/* STATISTICS */}
      <section className="fx-stats">

        <div className="fx-stat-card">
          <div className="fx-stat-icon orange">
            <Flame size={18} />
          </div>

          <div>
            <span>Visible observations</span>
            <strong>{stats.total.toLocaleString()}</strong>
          </div>
        </div>

        <div className="fx-stat-card">
          <div className="fx-stat-icon red">
            <Activity size={18} />
          </div>

          <div>
            <span>High confidence</span>
            <strong>{stats.high.toLocaleString()}</strong>
          </div>
        </div>

        <div className="fx-stat-card">
          <div className="fx-stat-icon teal">
            <Layers3 size={18} />
          </div>

          <div>
            <span>Average FRP</span>
            <strong>
              {stats.averageFrp}
              <small> MW</small>
            </strong>
          </div>
        </div>

        <div className="fx-stats-status">
          <span className="fx-live-dot" />
          {loading ? 'Updating data' : 'Dataset loaded'}
        </div>

      </section>

      {/* PERMANENT FILTER TOOLBAR */}
      <section className="fx-filter-toolbar">

        <div className="fx-filter-toolbar-heading">
          <div>
            <span className="fx-section-kicker">OBSERVATION CONTROLS</span>
            <h3>Filter map data</h3>
          </div>

          <button
            className="fx-reset-button"
            onClick={resetFilters}
          >
            <RotateCcw size={14} />
            Reset filters
          </button>
        </div>

        <div className="fx-filter-controls">
          <div className="fx-control">
            <label>
              <CalendarDays size={14} />
              Observation date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="fx-control">
            <label>
              <Activity size={14} />
              Confidence
            </label>
            <select
              value={confidence}
              onChange={e => setConfidence(e.target.value)}
            >
              <option value="All">All confidence levels</option>
              <option value="High">High</option>
              <option value="Nominal">Nominal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="fx-control">
            <label>
              <Flame size={14} />
              Fire intensity (FRP)
            </label>
            <select
              value={intensity}
              onChange={e => setIntensity(e.target.value)}
            >
              <option value="All">All intensities</option>
              <option value="Low">Low · 0–5 MW</option>
              <option value="Medium">Medium · 5–20 MW</option>
              <option value="High">High · 20+ MW</option>
            </select>
          </div>
        </div>

        <div className="fx-more-filters-row">
          <button
            type="button"
            className={`fx-more-filters-button ${moreFiltersOpen ? 'is-open' : ''}`}
            onClick={() => setMoreFiltersOpen(open => !open)}
            aria-expanded={moreFiltersOpen}
          >
            <SlidersHorizontal size={14} />
            More filters
            {(selectedState || selectedDistrict) && (
              <span className="fx-more-filters-active">Active</span>
            )}
            <ChevronDown size={14} className="fx-more-filters-chevron" />
          </button>
        </div>

        {moreFiltersOpen && (
          <div className="fx-more-filters-panel">
            <div className="fx-more-filters-intro">
              <strong>Geographic filters</strong>
              <span>Limit observations to an Indian state/UT and district.</span>
            </div>

            <div className="fx-filter-controls fx-geographic-controls">
              <div className="fx-control">
                <label>
                  <MapPin size={14} />
                  State / UT
                </label>
                <select
                  value={selectedState}
                  onChange={e => setSelectedState(e.target.value)}
                >
                  <option value="">All India</option>
                  {stateList.map(state => (
                    <option key={state.slug} value={state.name}>{state.name}</option>
                  ))}
                </select>
              </div>

              <div className="fx-control">
                <label>
                  <MapPin size={14} />
                  District / City
                </label>
                <select
                  value={selectedDistrict}
                  onChange={e => setSelectedDistrict(e.target.value)}
                  disabled={!selectedState || districtLoading || districts.length === 0}
                >
                  <option value="">
                    {!selectedState
                      ? 'Select a state first'
                      : districtLoading
                        ? 'Loading districts...'
                        : 'All districts'}
                  </option>
                  {districts
                    .slice()
                    .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
                    .map(district => (
                      <option
                        key={`${district.properties.state}-${district.properties.name}`}
                        value={district.properties.name}
                      >
                        {district.properties.name}
                      </option>
                    ))}
                </select>
                <small className="fx-control-note">District boundaries are available; separate city boundaries are not included in this dataset.</small>
              </div>
            </div>
          </div>
        )}

        <div className="fx-filter-explanation">
          Geographic filters use India state and district boundary polygons. {geoError || (districtLoading ? 'Loading district boundaries...' : `${geographicallyFiltered.length.toLocaleString()} observations within the selected geography.`)}
        </div>

      </section>

      {/* MAP */}
      <section className="fx-map-section">

        <div className="fx-map-heading">
          <div>
            <span className="fx-section-kicker">GEOGRAPHIC VISUALIZATION</span>
            <h3>Thermal activity map</h3>
            <p>Explore individual satellite-detected thermal observations.</p>
          </div>

          <div className="fx-map-count">
            <span className="fx-live-dot" />
            {visible.length.toLocaleString()} observations
          </div>
        </div>

        <div className="fx-map-frame">

          {error ? (
            <div className="fx-map-message">
              <Info size={28} />
              <h3>Unable to load observations</h3>
              <p>{error}</p>

              <button onClick={refreshData}>
                Try again
              </button>
            </div>
          ) : (
            <MapContainer
              center={[22.5, 79]}
              zoom={4}
              minZoom={2}
              maxZoom={13}
              scrollWheelZoom
              worldCopyJump
              zoomControl={false}
            >
              <MapFocusController
                  selected={selected}
                  feature={
                    selectedState
                      ? selectedStateFeature
                      : states.features.find(
                          feature =>
                            feature.properties?.name?.toLowerCase() ===
                            search.trim().toLowerCase()
                        ) || null
                  }
                />
              <TileLayer
                attribution='Tiles &copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              />

              <ZoomControl position="bottomleft" />

              {visible.map(detection => {
                const color =
                  COLORS[detection.confidence] || COLORS.n;

                const radius = Math.min(
                  4 + Math.sqrt(
                    Math.max(Number(detection.frp) || 0, 0)
                  ),
                  10
                );

                return (
                  <CircleMarker
                    key={detection.id}
                    center={[
                      detection.latitude,
                      detection.longitude
                    ]}
                    radius={radius}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.82,
                      weight: 1.2
                    }}
                    eventHandlers={{
                      click: () => selectDetection(detection)
                    }}
                  >
                    <Popup>
                      <strong>Thermal observation</strong>
                      <br />
                      FRP: {detection.frp} MW
                      <br />
                      Confidence: {confidenceLabel(detection.confidence)}
                      <br />
                      Date: {detection.date}
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}

          {loading && (
            <div className="fx-map-loading">
              <RefreshCw size={14} />
              Loading observations...
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="fx-map-empty">
              No observations match the selected filters.
            </div>
          )}

          <div className="fx-map-overlay-label">
            <span className="fx-live-dot" />
            NASA FIRMS · THERMAL OBSERVATIONS
          </div>

        </div>

        {/* MAP LEGEND */}
        <div className="fx-map-legend">
          <span className="fx-legend-title">CONFIDENCE</span>

          <span>
            <i className="fx-legend-high" />
            High
          </span>

          <span>
            <i className="fx-legend-nominal" />
            Nominal
          </span>

          <span>
            <i className="fx-legend-low" />
            Low
          </span>

          <span className="fx-legend-note">
            Marker size represents FRP
          </span>
        </div>

      </section>

      {/* PERMANENT OBSERVATION DETAILS */}
      <section className="fx-observation-section">

        <div className="fx-observation-heading">
          <div>
            <span className="fx-section-kicker">OBSERVATION INSPECTOR</span>
            <h3>Detection details</h3>
            <p>
              Select any marker on the map to inspect its satellite observation.
            </p>
          </div>

          {selected && (
            <button
              className="fx-clear-selection"
              onClick={() => setSelected(null)}
            >
              <X size={14} />
              Clear selection
            </button>
          )}
        </div>

        {selected ? (
          <div className="fx-observation-content">

            <div className="fx-observation-primary">
              <div className="fx-observation-icon">
                <Flame size={24} />
              </div>

              <div>
                <span className="fx-section-kicker">SELECTED THERMAL OBSERVATION</span>
                <h2>{selected.frp} <small>MW</small></h2>
                <p>Fire Radiative Power</p>
              </div>

              <div className="fx-observation-confidence">
                <span
                  className="fx-confidence-dot"
                  style={{
                    background:
                      COLORS[selected.confidence] || COLORS.n
                  }}
                />
                {confidenceLabel(selected.confidence)} confidence
              </div>
            </div>

            <div className="fx-observation-data">

              <div className="fx-data-item">
                <span><MapPin size={14} /> Latitude</span>
                <strong>{selected.latitude}</strong>
              </div>

              <div className="fx-data-item">
                <span><MapPin size={14} /> Longitude</span>
                <strong>{selected.longitude}</strong>
              </div>

              <div className="fx-data-item">
                <span><CalendarDays size={14} /> Acquisition date</span>
                <strong>{selected.date}</strong>
              </div>

              <div className="fx-data-item">
                <span><Clock3 size={14} /> Acquisition time</span>
                <strong>{selected.time} UTC</strong>
              </div>

              <div className="fx-data-item">
                <span><Satellite size={14} /> Satellite</span>
                <strong>{selected.satellite}</strong>
              </div>

              <div className="fx-data-item">
                <span><Layers3 size={14} /> Instrument</span>
                <strong>{selected.instrument}</strong>
              </div>

              <div className="fx-data-item">
                <span><Activity size={14} /> Day / Night</span>
                <strong>{selected.daynight}</strong>
              </div>

            </div>

          </div>
        ) : (
          <div className="fx-no-selection">
            <div className="fx-no-selection-icon">
              <Crosshair size={25} />
            </div>

            <div>
              <h4>No observation selected</h4>
              <p>
                Click a thermal marker on the map to view its FRP,
                coordinates, confidence, acquisition time and satellite.
              </p>
            </div>
          </div>
        )}

        <div className="fx-observation-note">
          <Info size={15} />
          <p>
            Satellite thermal anomalies are observations and do not
            independently confirm wildfire incidents.
          </p>
        </div>

      </section>

      {/* FOOTER */}
      <footer className="fx-page-footer">
        <span>DATA SOURCE: NASA FIRMS</span>
        <span>MAP TILES: ESRI WORLD DARK GRAY</span>
        <span>FRP UNIT: MEGAWATTS</span>
      </footer>

    </main>
  );
}
