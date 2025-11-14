import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer } from "react-toastify";
import Login from "./components/Login.jsx";
import Scanner from "./components/Scanner.jsx";
import ReviewTickets from "./components/ReviewTickets.jsx";
import BookTickets from "./components/BookTickets.jsx";

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
  const [token, setToken] = useState(localStorage.getItem("admin_jwt") || "");
  const [activeView, setActiveView] = useState("scanner");
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("admin_jwt", token);
    else localStorage.removeItem("admin_jwt");
  }, [token]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeView, token]);

  const headerCopy = useMemo(
    () => VIEW_COPY[activeView] || VIEW_COPY.scanner,
    [activeView]
  );

  async function handleLogin({ username, password }) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setToken(data.token);
  }

  function logout() {
    setToken("");
    setActiveView("scanner");
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
