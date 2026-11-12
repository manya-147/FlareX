
import { useEffect, useState } from 'react';
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
  Clock3,
  RefreshCw,
  Database,
  Info,
  AlertTriangle,
} from 'lucide-react';

import './DataMethods.css';

const API_URL = 'http://127.0.0.1:8000/api/analytics/charts';

const COLORS = ['#ff795f', '#62d9bd', '#f4bd65'];

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

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Analytics API error:', err);
      setError('Unable to retrieve analytics. Check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const confidence = data?.confidence_distribution ?? [];
  const frp = data?.frp_distribution ?? [];
  const daily = data?.daily_activity ?? [];
  const hourly = data?.hourly_activity ?? [];
  const summary = data?.frp_summary ?? {};

  return (
    <main className="analytics-page">

      <header className="analytics-header">
        <div>
          <span className="analytics-eyebrow">
            <ChartNoAxesCombined size={15} />
            FLAREX / DATA INTELLIGENCE
          </span>

          <h1>Data <span>&</span> Analytics</h1>

          <p>
            Explore satellite thermal observations, intensity patterns
            and detection activity across the FIRMS dataset.
          </p>
        </div>

        <button
          className="analytics-refresh"
          onClick={fetchAnalytics}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'analytics-spin' : ''} />
          Refresh data
        </button>
      </header>

      {loading && !data ? (
        <div className="analytics-state">
          <RefreshCw size={28} className="analytics-spin" />
          <h2>Loading dataset analytics</h2>
          <p>Retrieving observations from the FlareX API.</p>
        </div>
      ) : error && !data ? (
        <div className="analytics-state">
          <AlertTriangle size={30} />
          <h2>Analytics unavailable</h2>
          <p>{error}</p>
          <button className="analytics-refresh" onClick={fetchAnalytics}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="analytics-source-strip">
            <div>
              <Database size={19} />
              <div>
                <strong>Dataset source</strong>
                <small>{data?.source || 'NASA FIRMS CSV'}</small>
              </div>
            </div>

            <span className="analytics-live-status">
              <i />
              Dataset connected
            </span>
          </div>

          <section className="analytics-metrics-grid">
            <MetricCard
              icon={Satellite}
              label="Total observations"
              value={Number(data?.total_observations ?? 0).toLocaleString()}
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

          <div className="analytics-section-title">
            <div>
              <span>01 / OBSERVATION ANALYSIS</span>
              <h2>Understanding the detections</h2>
              <p>Distribution and intensity of satellite thermal observations.</p>
            </div>
          </div>

          <section className="analytics-chart-grid">

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
                        <i style={{ background: COLORS[index % COLORS.length] }} />
                        <span>{item.category}</span>
                        <strong>{item.count.toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="analytics-empty">No confidence data available.</p>
              )}
            </ChartCard>

            <ChartCard
              title="FRP intensity distribution"
              subtitle="Number of observations across FRP ranges"
            >
              {frp.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frp} margin={{ top: 15, right: 8, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff13" />
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
                <p className="analytics-empty">No FRP data available.</p>
              )}
            </ChartCard>

          </section>

          <div className="analytics-section-title">
            <div>
              <span>02 / TEMPORAL ANALYSIS</span>
              <h2>When are detections observed?</h2>
              <p>Explore changes in observation frequency over time.</p>
            </div>
          </div>

          <section className="analytics-chart-grid">

            <ChartCard
              title="Daily detection activity"
              subtitle="Number of satellite observations by acquisition date"
              className="analytics-wide"
            >
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff8957" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ff8957" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff13" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#aebdca', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={30}
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
                    <Area
                      type="monotone"
                      dataKey="detections"
                      name="Detections"
                      stroke="#ff8957"
                      strokeWidth={2}
                      fill="url(#dailyGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="analytics-empty">No valid date observations available.</p>
              )}
            </ChartCard>

            <ChartCard
              title="Hourly observation activity"
              subtitle="Acquisition time recorded by the satellite"
            >
              {hourly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourly} margin={{ top: 15, right: 8, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff13" />
                    <XAxis
                      dataKey="hour"
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
                    <Line
                      type="monotone"
                      dataKey="detections"
                      name="Detections"
                      stroke="#62d9bd"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#62d9bd' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="analytics-empty">No acquisition time data available.</p>
              )}
            </ChartCard>

          </section>

          <section className="analytics-method-panel">
            <div className="analytics-method-heading">
              <div className="analytics-method-icon">
                <Info size={20} />
              </div>
              <div>
                <span>03 / METHODOLOGY</span>
                <h2>How to interpret these graphs</h2>
              </div>
            </div>

            <div className="analytics-method-grid">
              <div>
                <strong>Confidence</strong>
                <p>
                  FIRMS confidence categories are classifications, not
                  probabilities that an observation is a wildfire.
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
              <p className="analytics-data-note">{data.note}</p>
            )}
          </section>

          <footer className="analytics-footer">
            FLAREX · DATA INTELLIGENCE
            <span>NASA FIRMS · Satellite observations · Analytical insights</span>
          </footer>
        </>
      )}
    </main>
  );
}

export default DataMethods;
