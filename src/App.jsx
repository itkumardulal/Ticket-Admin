import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer } from "react-toastify";
import Login from "./components/Login.jsx";
import Scanner from "./components/Scanner.jsx";
import ReviewTickets from "./components/ReviewTickets.jsx";
import BookTickets from "./components/BookTickets.jsx";
import { setRefreshTokenFunction } from "./utils/api.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const NAV_ITEMS = [
  { id: "scanner", label: "Scan Tickets", icon: "📷" },
  { id: "review", label: "Review Tickets", icon: "📋" },
  { id: "book", label: "Book Tickets", icon: "🎫" },
];

const BOTTOM_NAV_ITEMS = [
  { id: "scanner", label: "Home", icon: "🏠" },
  { id: "review", label: "Review", icon: "📋" },
  { id: "book", label: "Bookings", icon: "🎫" },
];

const VIEW_COPY = {
  scanner: {
    title: "Scan Tickets",
    subtitle:
      "Validate QR codes, check in guests, and manage group entry effortlessly.",
  },
  review: {
    title: "Review Pending Bookings",
    subtitle:
      "Approve or cancel ticket requests and keep attendees updated in real time.",
  },
  book: {
    title: "Ticket Overview",
    subtitle:
      "Monitor booking health, track attendance, and stay ahead of event demand.",
  },
};

export default function App() {
  // Store access token in memory only (useRef for persistence across renders)
  const tokenRef = useRef("");
  const [token, setToken] = useState("");
  const [activeView, setActiveView] = useState("scanner");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const refreshPromiseRef = useRef(null);
  const initialRefreshAttemptedRef = useRef(false);

  // Sync ref with state and register refresh function
  useEffect(() => {
    tokenRef.current = token;
    setRefreshTokenFunction(refreshAccessToken);
  }, [token]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeView, token]);

  useEffect(() => {
    if (initialRefreshAttemptedRef.current) return;
    initialRefreshAttemptedRef.current = true;
    refreshAccessToken().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerCopy = useMemo(
    () => VIEW_COPY[activeView] || VIEW_COPY.scanner,
    [activeView]
  );

  // Auto-refresh token when it expires
  async function refreshAccessToken() {
    // Prevent multiple simultaneous refresh calls
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/refresh`, {
          method: "POST",
          credentials: "include", // Include cookies
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Token refresh failed");
        }
        setToken(data.accessToken);
        return data.accessToken;
      } catch (err) {
        // Refresh failed - logout user
        setToken("");
        throw err;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }

  async function handleLogin({ username, password }) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Include cookies for refresh token
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    // Store access token in memory only
    setToken(data.accessToken);
  }

  async function logout() {
    try {
      // Call logout endpoint to revoke refresh token
      if (tokenRef.current) {
        await fetch(`${API_BASE}/api/admin/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          credentials: "include",
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setToken("");
      setActiveView("scanner");
    }
  }

  function renderNavButton(item) {
    return (
      <button
        key={item.id}
        className={activeView === item.id ? "active" : ""}
        onClick={() => setActiveView(item.id)}
        type="button"
      >
        <span className="nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </button>
    );
  }

  function renderBottomNavButton(item) {
    return (
      <button
        key={item.id}
        type="button"
        className={activeView === item.id ? "active" : ""}
        onClick={() => setActiveView(item.id)}
      >
        <span className="nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        <small>{item.label}</small>
      </button>
    );
  }

  return (
    <div className="app-container">
      <ToastContainer
        position="top-right"
        autoClose={3200}
        hideProgressBar={false}
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        draggable
        theme="colored"
        limit={3}
      />
      {token ? (
        <div className="admin-shell">
          <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
            <div className="sidebar-header">
              <div className="sidebar-title">
                <span>BrotherHood Nepal • NLT</span>
                <h2>Sindhuli Admin</h2>
              </div>
              <button
                type="button"
                className="sidebar-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation"
              >
                ×
              </button>
            </div>
            <nav className="sidebar-nav">{NAV_ITEMS.map(renderNavButton)}</nav>
            <div className="sidebar-footer">
              <button className="btn-logout" type="button" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>
          <div
            className={`sidebar-backdrop ${isSidebarOpen ? "visible" : ""}`}
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
          <div className="main-area">
            <header className="main-header">
              <button
                type="button"
                className="menu-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
              >
                ☰
              </button>
              <div className="header-content">
                <h1>{headerCopy.title}</h1>
                <p>{headerCopy.subtitle}</p>
              </div>
              <button
                className="btn-logout mobile-only"
                type="button"
                onClick={logout}
              >
                Logout
              </button>
            </header>
            <main className="main-content">
              {activeView === "scanner" && <Scanner jwt={token} />}
              {activeView === "review" && <ReviewTickets jwt={token} />}
              {activeView === "book" && <BookTickets jwt={token} />}
            </main>
          </div>
          <nav className="bottom-nav">
            <div className="bottom-nav-header">
              <span className="logo-circle">🎵</span>
              <div>
                <strong>Sindhuli Admin</strong>
                <small>BrotherHood Nepal • NLT</small>
              </div>
            </div>
            <div className="bottom-nav-actions">
              {BOTTOM_NAV_ITEMS.map(renderBottomNavButton)}
              <button type="button" className="logout" onClick={logout}>
                <span className="nav-icon" aria-hidden="true">
                  🚪
                </span>
                <small>Logout</small>
              </button>
            </div>
          </nav>
        </div>
      ) : (
        <div className="container">
          <Login onLogin={handleLogin} />
        </div>
      )}
    </div>
  );
}
