import React, { useEffect, useState } from "react";
import Login from "./components/Login.jsx";
import Scanner from "./components/Scanner.jsx";
import ReviewTickets from "./components/ReviewTickets.jsx";
import BookTickets from "./components/BookTickets.jsx";

const API_BASE = import.meta.env.VITE_API_BASE 
console.log(API_BASE)

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("admin_jwt") || "");
  const [activeView, setActiveView] = useState("scanner"); // 'scanner', 'review', 'book'

  useEffect(() => {
    if (token) localStorage.setItem("admin_jwt", token);
    else localStorage.removeItem("admin_jwt");
  }, [token]);

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

  return (
    <div className="app-container">
      {token ? (
        <div className="admin-layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>Admin Panel</h2>
              <p>Sindhuli Concert</p>
            </div>
            <nav className="sidebar-nav">
              <button
                className={activeView === "scanner" ? "active" : ""}
                onClick={() => setActiveView("scanner")}
              >
                📷 Scan Tickets
              </button>
              <button
                className={activeView === "review" ? "active" : ""}
                onClick={() => setActiveView("review")}
              >
                📋 Review Tickets
              </button>
              <button
                className={activeView === "book" ? "active" : ""}
                onClick={() => setActiveView("book")}
              >
                🎫 Book Tickets
              </button>
            </nav>
            <div className="sidebar-footer">
              <button className="btn-logout" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>
          <main className="main-content">
            {activeView === "scanner" && <Scanner jwt={token} />}
            {activeView === "review" && <ReviewTickets jwt={token} />}
            {activeView === "book" && <BookTickets jwt={token} />}
          </main>
        </div>
      ) : (
        <div className="container">
          <Login onLogin={handleLogin} />
        </div>
      )}
    </div>
  );
}
