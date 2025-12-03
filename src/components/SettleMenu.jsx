import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString()}`;
}

export default function SettleMenu({ jwt }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    totalPrice: 0,
    approvedCount: 0,
    settleAmount: 0,
    rate: 12.85,
  });

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/admin/settlements`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load settlements");
        }
        setSummary({
          totalPrice: Number(data.totalPrice || 0),
          approvedCount: Number(data.approvedCount || 0),
          settleAmount: Number(data.settleAmount || 0),
          rate: Number(data.rate || 12.85),
        });
      } catch (err) {
        setError(err.message || "Failed to load settlements");
      } finally {
        setLoading(false);
      }
    }

    if (jwt) {
      loadSummary();
    }
  }, [jwt]);

  return (
    <div className="settle-menu">
      <header className="section-header">
        <div>
          <h2>Settle Menu</h2>
          <p className="section-subtitle">
            Overview of approved ticket revenue and settlement amount.
          </p>
        </div>
      </header>

      {loading && <div className="loading">Loading settlement data...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="metrics-grid">
          {/* <div className="metric-card">
            <p>Total Approved Tickets</p>
            <h3>{summary.totalPeople}</h3>
          </div> */}
          <div className="metric-card">
            <p>Total Price (Approved Only)</p>
            <h3>{formatCurrency(summary.totalPrice)}</h3>
          </div>
          <div className="metric-card">
            <p>Settlement Rate</p>
            <h3>{summary.rate}%</h3>
          </div>
          <div className="metric-card">
            <p>Settle Amount</p>
            <h3>{formatCurrency(summary.settleAmount)}</h3>
          </div>
        </div>
      )}
    </div>
  );
}


