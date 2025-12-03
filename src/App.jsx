import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer } from "react-toastify";
import Login from "./components/Login.jsx";
import Scanner from "./components/Scanner.jsx";
import ReviewTickets from "./components/ReviewTickets.jsx";
import BookTickets from "./components/BookTickets.jsx";
import SettleMenu from "./components/SettleMenu.jsx";
import { setRefreshTokenFunction } from "./utils/api.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const NAV_ITEMS = [
  { id: "scanner", label: "Scan Tickets", icon: "📷" },
  { id: "review", label: "Review Tickets", icon: "📋" },
  { id: "book", label: "Book Tickets", icon: "🎫" },
  { id: "settle", label: "Settle Menu", icon: "💰", eatstreetOnly: true },
];

const BOTTOM_NAV_ITEMS = [
  { id: "review", label: "Review", icon: "📋" },
  { id: "book", label: "Bookings", icon: "🎫" },
  { id: "settle", label: "Settle", icon: "💰", eatstreetOnly: true },
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
  settle: {
    title: "Settle Menu",
    subtitle:
      "View approved ticket revenue and settlement amount for this event.",
  },
};

function extractEventKeyFromToken(jwt = "") {
  if (!jwt || typeof jwt !== "string") return "default";
  const parts = jwt.split(".");
  if (parts.length < 2) return "default";
  try {
    const payload = JSON.parse(atob(parts[1]));
    const eventKey = payload?.eventKey;
    if (typeof eventKey === "string" && eventKey.trim()) {
      return eventKey.toLowerCase();
    }
  } catch (err) {
    console.warn("Failed to parse access token payload:", err);
  }
  return "default";
}

export default function App() {
  // Store access token in memory only (useRef for persistence across renders)
  const tokenRef = useRef("");
  const [token, setToken] = useState("");
  const [eventKey, setEventKey] = useState("default");
  const [activeView, setActiveView] = useState("scanner");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [autoStartCamera, setAutoStartCamera] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const refreshPromiseRef = useRef(null);
  const initialRefreshAttemptedRef = useRef(false);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef(null);
  const headerScrollTimeout = useRef(null);

  // Sync ref with state and register refresh function
  useEffect(() => {
    tokenRef.current = token;
    setRefreshTokenFunction(refreshAccessToken);
    setEventKey(token ? extractEventKeyFromToken(token) : "default");
  }, [token]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeView, token]);

  // Reset auto-start flag when view changes away from scanner
  useEffect(() => {
    if (activeView !== "scanner") {
      setAutoStartCamera(false);
    }
  }, [activeView]);

  // Handle scroll to show/hide footer and header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;

      // Clear existing timeouts
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (headerScrollTimeout.current) {
        clearTimeout(headerScrollTimeout.current);
      }

      // Show footer when scrolling up, hide when scrolling down
      if (scrollDifference > 0 && currentScrollY > 100) {
        // Scrolling down - hide footer
        setIsFooterVisible(false);
      } else if (scrollDifference < 0) {
        // Scrolling up - show footer
        setIsFooterVisible(true);
      }

      // Show header when scrolling up, hide when scrolling down
      if (scrollDifference > 0 && currentScrollY > 100) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (scrollDifference < 0) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }

      // Always show footer and header at the top
      if (currentScrollY < 50) {
        setIsFooterVisible(true);
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;

      // Set timeout to show footer after scrolling stops (optional)
      scrollTimeout.current = setTimeout(() => {
        if (currentScrollY > 100) {
          setIsFooterVisible(true);
        }
      }, 1500);

      // Set timeout to show header after scrolling stops (optional)
      headerScrollTimeout.current = setTimeout(() => {
        if (currentScrollY > 100) {
          setIsHeaderVisible(true);
        }
      }, 1500);
    };

    // Only add scroll listener on mobile
    const isMobile = window.innerWidth <= 1023;
    if (isMobile) {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }
        if (headerScrollTimeout.current) {
          clearTimeout(headerScrollTimeout.current);
        }
      };
    }
  }, []);

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
    if (item.eatstreetOnly && eventKey !== "eatstreet") {
      return null;
    }
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
    if (item.eatstreetOnly && eventKey !== "eatstreet") {
      return null;
    }
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
                <span>
                  {eventKey === "eatstreet"
                    ? "EATSTREET• NLT"
                    : "BrotherHood Nepal • NLT"}
                </span>
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
            <header className={`main-header ${isHeaderVisible ? "visible" : "hidden"}`}>
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
              {activeView === "scanner" && (
                <Scanner
                  jwt={token}
                  autoStart={autoStartCamera}
                  eventKey={eventKey}
                />
              )}
              {activeView === "review" && (
                <ReviewTickets jwt={token} eventKey={eventKey} />
              )}
              {activeView === "book" && (
                <BookTickets jwt={token} eventKey={eventKey} />
              )}
              {activeView === "settle" && eventKey === "eatstreet" && (
                <SettleMenu jwt={token} />
              )}
            </main>
          </div>
          <nav className={`bottom-nav ${isFooterVisible ? "visible" : "hidden"}`}>
            <div className="bottom-nav-actions">
              {BOTTOM_NAV_ITEMS.map(renderBottomNavButton)}
              <button 
                type="button" 
                className={activeView === "scanner" ? "active camera-button" : "camera-button"} 
                onClick={() => {
                  // Check if we're on mobile (screen width <= 1023px)
                  const isMobile = window.innerWidth <= 1023;
                  if (isMobile) {
                    setAutoStartCamera(true);
                  }
                  setActiveView("scanner");
                }}
              >
                <span className="camera-icon" aria-hidden="true">
                  📷
                </span>
                <small>Scanner</small>
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
