
import { useState } from "react";
import "./Auth.css";

const API_URL = "http://127.0.0.1:8000";

function Signup({ onSignupSuccess, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Live password validation
  const passwordRules = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9\s]/.test(password),
  };

  const passwordValid = Object.values(passwordRules).every(Boolean);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setError("Please meet all password requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Signup failed");
      }

     

      onSignupSuccess(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect to server.");
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

        <p className="auth-eyebrow">
          WILDFIRE INTELLIGENCE PLATFORM
        </p>

        <h1>Create your account.</h1>

        <p className="auth-subtitle">
          Join FlareX and explore thermal intelligence.
        </p>

        <form onSubmit={handleSignup}>

          <label>Full name</label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
          />

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
              placeholder="Create a strong password"
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

          <div className="password-requirements">
            <p>Password must contain:</p>

            <span className={passwordRules.length ? "valid" : ""}>
              {passwordRules.length ? "✓" : "○"} At least 8 characters
            </span>

            <span className={passwordRules.letter ? "valid" : ""}>
              {passwordRules.letter ? "✓" : "○"} At least one letter
            </span>

            <span className={passwordRules.number ? "valid" : ""}>
              {passwordRules.number ? "✓" : "○"} At least one number
            </span>

            <span className={passwordRules.special ? "valid" : ""}>
              {passwordRules.special ? "✓" : "○"} At least one special character
            </span>
          </div>

          <label>Confirm password</label>

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="auth-error">{error}</p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
          >
            Sign in
          </button>
        </p>

        <p className="auth-footer">
          FLAREX · THERMAL PATTERN INTELLIGENCE
        </p>

      </div>
    </div>
  );
}

export default Signup;
