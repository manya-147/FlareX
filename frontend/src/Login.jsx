
import { useState } from "react";
import "./Auth.css";

import { API_BASE_URL } from "./api";
const API_URL = API_BASE_URL;

function Login({ onLoginSuccess, onSwitchToSignup, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

        const storage = rememberMe ? localStorage : sessionStorage;

        localStorage.removeItem("flarex-token");
        localStorage.removeItem("flarex-user");
        sessionStorage.removeItem("flarex-token");
        sessionStorage.removeItem("flarex-user");

        storage.setItem("flarex-token", data.access_token);
        storage.setItem("flarex-user", JSON.stringify(data.user));

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon">F</span>
          <span>FlareX</span>
        </div>

        <p className="auth-eyebrow">WILDFIRE INTELLIGENCE PLATFORM</p>

        <h1>Welcome back.</h1>
        <p className="auth-subtitle">
          Sign in to continue monitoring thermal activity.
        </p>

        {notice && (
        <p className="auth-success">{notice}</p>
        )}

        <form onSubmit={handleLogin}>
          <label>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
            <label className="remember-me">
            <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
            </label>
          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <button type="button" onClick={onSwitchToSignup}>
            Create account
          </button>
        </p>

        <p className="auth-footer">
          FLAREX · THERMAL PATTERN INTELLIGENCE
        </p>
      </div>
    </div>
  );
}

export default Login;
