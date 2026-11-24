import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

import {
  Activity,
  Flame,
  Satellite,
  ChartNoAxesCombined,
  RefreshCw,
  Database,
  Info,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';

import './DataMethods.css';

import { API_BASE_URL } from './api';

const API_URL = `${API_BASE_URL}/api/analytics/charts`;

const COLORS = ['#ff795f', '#62d9bd', '#f4bd65'];

function getLocalDate() {
  return new Date().toISOString().split('T')[0];
}

function formatDateLabel(value) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function MetricCard({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="analytics-metric">
      <div className={`analytics-metric-icon ${accent}`}>
        <Icon size={21} />
      </div>

      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      <small>{unit}</small>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`analytics-card ${className}`}>
      <div className="analytics-card-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="analytics-chart">
        {children}
      </div>
    </section>
  );
}

function DataMethods() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  // Holds the request currently in flight so an older, slower response
  // can never overwrite the data for the date the user picked last.
  const requestRef = useRef(null);

  const fetchAnalytics = useCallback(async (date = selectedDate) => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (date) {
        params.set('date', date);
      }

      const response = await fetch(
        `${API_URL}?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();

      if (controller.signal.aborted) return;

      setData(result);

    } catch (err) {
      if (err.name === 'AbortError') return;

      console.error('Analytics API error:', err);

      setError(
        'Unable to retrieve analytics. Check your backend connection.'
      );

    } finally {
      // Only the newest request is allowed to clear the loading state.
      if (requestRef.current === controller) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAnalytics(selectedDate);
  }, [fetchAnalytics, selectedDate]);

  // Cancel any pending request when leaving the page.
  useEffect(() => () => requestRef.current?.abort(), []);

  const confidence = data?.confidence_distribution ?? [];
  const frp = data?.frp_distribution ?? [];
  const weekly = data?.weekly_comparison ?? data?.daily_activity ?? [];
  const hourly = data?.hourly_activity ?? [];
  const summary = data?.frp_summary ?? {};

  // Always construct a complete 24-hour timeline.
  // Only hours missing from the API receive zero.
  const hourlyFullDay = useMemo(() => {
    const countsByHour = new Map();

    hourly.forEach((item) => {
      const rawHour = String(item.hour ?? '').trim();

      let hourNumber;

      if (rawHour.includes(':')) {
        hourNumber = Number(rawHour.split(':')[0]);
      } else {
        hourNumber = Number(rawHour);
      }

      if (
        Number.isInteger(hourNumber) &&
        hourNumber >= 0 &&
        hourNumber <= 23
      ) {
        countsByHour.set(
          hourNumber,
          (countsByHour.get(hourNumber) || 0) +
            Number(item.detections || 0)
        );
      }
    });

    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      detections: countsByHour.get(hour) ?? 0,
    }));
  }, [hourly]);

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  return (
    <main className="analytics-page">

      {/* HEADER */}
      <header className="analytics-header">
        <div>
          <span className="analytics-eyebrow">
            <ChartNoAxesCombined size={15} />
            FLAREX / DATA INTELLIGENCE
          </span>

          <h1>
            Data <span>&</span> Analytics
          </h1>

          <p>
            Explore satellite thermal observations, intensity patterns
            and detection activity from NASA FIRMS.
          </p>
        </div>

        <button
          className="analytics-refresh"
          onClick={() => fetchAnalytics(selectedDate)}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? 'analytics-spin' : ''}
          />
          Refresh data
        </button>
      </header>

      {/* LOADING / ERROR */}
      {loading && !data ? (
        <div className="analytics-state">
          <RefreshCw size={28} className="analytics-spin" />
          <h2>Loading observation analytics</h2>
          <p>Retrieving observations from the FlareX API.</p>
        </div>
      ) : error && !data ? (
        <div className="analytics-state">
          <AlertTriangle size={30} />
          <h2>Analytics unavailable</h2>
          <p>{error}</p>

          <button
            className="analytics-refresh"
            onClick={() => fetchAnalytics(selectedDate)}
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          className={`analytics-body${loading ? ' is-refreshing' : ''}`}
          aria-busy={loading}
        >

          {loading && data && (
            <div className="analytics-refresh-banner" role="status">
              <RefreshCw size={14} className="analytics-spin" />
              Updating analytics for {selectedDate}…
              <small>The weekly comparison can take a few seconds.</small>
            </div>
          )}

          {/* DATA SOURCE */}
          <div className="analytics-source-strip">
            <div>
              <Database size={19} />

              <div>
                <strong>
                  {data?.mode === 'HISTORICAL'
                    ? 'Historical data source'
                    : 'Live data source'}
                </strong>

                <small>
                  {data?.source || 'NASA FIRMS NOAA-21 NRT'}
                </small>
              </div>
            </div>

            <span className="analytics-live-status">
              <i />

              {data?.mode === 'HISTORICAL'
                ? 'Historical archive'
                : 'Live feed connected'}
            </span>
          </div>

          {/* METRICS */}
          <section className="analytics-metrics-grid">

            <MetricCard
              icon={Satellite}
              label="Total observations"
              value={Number(
                data?.total_observations ?? 0
              ).toLocaleString()}
              unit="Satellite detections"
              accent="coral"
            />

            <MetricCard
              icon={Activity}
              label="Average FRP"
              value={summary.average ?? '—'}
              unit="Megawatts"
              accent="teal"
            />

            <MetricCard
              icon={Flame}
              label="Median FRP"
              value={summary.median ?? '—'}
              unit="Megawatts"
              accent="orange"
            />

            <MetricCard
              icon={ChartNoAxesCombined}
              label="Maximum FRP"
              value={summary.maximum ?? '—'}
              unit="Megawatts"
              accent="purple"
            />

          </section>

          {/* DATE SELECTOR */}
          <section className="analytics-date-section">
            <div className="analytics-date-info">
              <CalendarDays size={20} />

              <div>
                <strong>Historical date analysis</strong>

                <p>
                  Select a date to explore observations and compare
                  activity across the surrounding seven-day period.
                </p>
              </div>
            </div>

            <div className="analytics-date-control">
              <label htmlFor="analytics-date">
                SELECT DATE
              </label>

              <input
                id="analytics-date"
                type="date"
                value={selectedDate}
                max={getLocalDate()}
                onChange={handleDateChange}
              />
            </div>
          </section>

          {error && (
            <p className="analytics-data-note">
              {error}
            </p>
          )}

          {/* OBSERVATION ANALYSIS */}
          <div className="analytics-section-title">
            <div>
              <span>01 / OBSERVATION ANALYSIS</span>

              <h2>Understanding the detections</h2>

              <p>
                Distribution and intensity of satellite thermal observations.
              </p>
            </div>
          </div>

          <section className="analytics-chart-grid">

            {/* CONFIDENCE */}
            <ChartCard
              title="Confidence distribution"
              subtitle="Observations grouped by FIRMS confidence category"
            >
              {confidence.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={confidence}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius="57%"
                        outerRadius="82%"
                        paddingAngle={4}
                        stroke="none"
                      >
                        {confidence.map((entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          background: '#192a3c',
                          border: '1px solid #526477',
                          borderRadius: '10px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="analytics-legend">
                    {confidence.map((item, index) => (
                      <div key={item.category}>
                        <i
                          style={{
                            background: COLORS[index % COLORS.length],
                          }}
                        />

                        <span>{item.category}</span>

                        <strong>
                          {item.count.toLocaleString()}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="analytics-empty">
                  No confidence data available.
                </p>
              )}
            </ChartCard>

            {/* FRP DISTRIBUTION */}
            <ChartCard
              title="FRP intensity distribution"
              subtitle="Number of observations across FRP ranges"
            >
              {frp.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={frp}
                    margin={{
                      top: 15,
                      right: 8,
                      left: -15,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff13"
                    />

                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#aebdca', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{ fill: '#aebdca', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background: '#192a3c',
                        border: '1px solid #526477',
                        borderRadius: '10px',
                        color: '#fff',
                      }}
                    />

                    <Bar
                      dataKey="observations"
                      name="Observations"
                      fill="#ff8957"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="analytics-empty">
                  No FRP data available.
                </p>
              )}
            </ChartCard>

          </section>

          {/* WEEKLY COMPARISON */}
          <div className="analytics-section-title">
            <div>
              <span>02 / WEEKLY COMPARISON</span>

              <h2>How has activity changed over the week?</h2>

              <p>
                Compare daily satellite observation counts across
                a seven-day period.
              </p>
            </div>
          </div>

          <section className="analytics-chart-grid">

            <ChartCard
              title="Seven-day observation comparison"
              subtitle="Daily thermal observations across the selected week"
              className="analytics-wide"
            >
              {weekly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weekly}
                    margin={{
                      top: 15,
                      right: 20,
                      left: 5,
                      bottom: 5,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="weeklyGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ff8957"
                          stopOpacity={0.4}
                        />

                        <stop
                          offset="95%"
                          stopColor="#ff8957"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff13"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      tick={{ fill: '#aebdca', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />

                    <YAxis
                      tick={{ fill: '#aebdca', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value) => [
                        value === null ? 'Unavailable' : value,
                        'Observations',
                      ]}
                      contentStyle={{
                        background: '#192a3c',
                        border: '1px solid #526477',
                        borderRadius: '10px',
                        color: '#fff',
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="detections"
                      name="Daily observations"
                      stroke="#ff8957"
                      strokeWidth={2.5}
                      fill="url(#weeklyGradient)"
                      connectNulls={false}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="analytics-empty">
                  No weekly comparison data available.
                </p>
              )}
            </ChartCard>

          </section>

          {/* HOURLY ACTIVITY */}
          <div className="analytics-section-title">
            <div>
              <span>03 / TEMPORAL ANALYSIS</span>

              <h2>When are observations recorded?</h2>

              <p>
                Hour-by-hour distribution of satellite acquisition times
                for the selected date.
              </p>
            </div>
          </div>

          <section className="analytics-chart-grid">

            <ChartCard
              title="Hourly observation activity"
              subtitle="Complete 24-hour timeline · 00:00 to 23:00"
              className="analytics-wide"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={hourlyFullDay}
                  margin={{
                    top: 15,
                    right: 20,
                    left: 5,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff13"
                  />

                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#aebdca', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#aebdca', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      background: '#192a3c',
                      border: '1px solid #526477',
                      borderRadius: '10px',
                      color: '#fff',
                    }}
                    labelStyle={{ color: '#ffffff' }}
                    formatter={(value) => [
                      value,
                      'Observations',
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="detections"
                    name="Observations"
                    stroke="#62d9bd"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#62d9bd' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

          </section>

          {/* METHODOLOGY */}
          <div className="analytics-section-title">
            <div>
              <span>04 / METHODOLOGY</span>
              <h2>How to interpret these graphs</h2>
            </div>
          </div>

          <section className="analytics-method-panel">

            <div className="analytics-method-grid">

              <div>
                <strong>Confidence</strong>

                <p>
                  FIRMS confidence categories are classifications,
                  not probabilities that an observation is a wildfire.
                </p>
              </div>

              <div>
                <strong>Fire Radiative Power</strong>

                <p>
                  FRP estimates the radiant energy released by a thermal
                  anomaly, expressed in megawatts.
                </p>
              </div>

              <div>
                <strong>Temporal activity</strong>

                <p>
                  Acquisition timestamps describe satellite observation
                  times, not necessarily when a fire began.
                </p>
              </div>

              <div>
                <strong>Spatial clustering</strong>

                <p>
                  Nearby detections can be grouped using DBSCAN, but a
                  cluster does not confirm one physical wildfire.
                </p>
              </div>

            </div>

            {data?.note && (
              <p className="analytics-data-note">
                {data.note}
              </p>
            )}

          </section>

          {/* FOOTER */}
          <footer className="analytics-footer">
            FLAREX · DATA INTELLIGENCE

            <span>
              NASA FIRMS · Satellite observations · Analytical insights
            </span>
          </footer>

        </div>
      )}

    </main>
  );
}

export default DataMethods;