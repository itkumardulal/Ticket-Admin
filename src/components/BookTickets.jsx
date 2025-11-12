import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "cancelled", label: "Cancelled" },
  { value: "checkedin", label: "Checked In" },
];

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

const QUICK_FILTERS = [
  { value: "all", label: "All Tickets" },
  { value: "remaining", label: "Remaining" },
  { value: "scanned", label: "Fully Scanned" },
];

function matchesQuickFilter(ticket, filter) {
  if (filter === "remaining") {
    return ticket.remaining > 0;
  }
  if (filter === "scanned") {
    return ticket.remaining === 0 && ticket.scanCount > 0;
  }
  return true;
}

export default function BookTickets({ jwt }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, perPage, page, quickFilter]);

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
      });
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const res = await fetch(`${API_BASE}/api/admin/tickets?${params}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tickets");

      const items = (data.items || []).filter((ticket) =>
        matchesQuickFilter(ticket, quickFilter)
      );

      setTickets(items);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  }

  function renderPageButtons() {
    const pages = [];
    for (let i = 1; i <= totalPages; i += 1) {
      pages.push(
        <button
          key={i}
          className={i === page ? "active" : ""}
          onClick={() => changePage(i)}
        >
          {i}
        </button>
      );
    }
    return pages;
  }

  const summary = useMemo(() => {
    const totalPeople = tickets.reduce(
      (acc, ticket) => acc + Number(ticket.quantity || 0),
      0
    );
    const totalRemaining = tickets.reduce(
      (acc, ticket) => acc + Number(ticket.remaining || 0),
      0
    );
    const totalScanned = tickets.reduce(
      (acc, ticket) => acc + Number(ticket.scanCount || 0),
      0
    );
    const totalPrice = tickets.reduce(
      (acc, ticket) => acc + Number(ticket.price || 0),
      0
    );
    return {
      totalPeople,
      totalRemaining,
      totalScanned,
      totalPrice,
    };
  }, [tickets]);

  function renderStatus(status) {
    return <span className={`status-badge status-${status}`}>{status}</span>;
  }

  function renderStatusMessage(ticket) {
    if (ticket.status === "cancelled") {
      return "Ticket cancelled";
    }
    if (ticket.remaining === 0) {
      return "All attendees checked in";
    }
    if (ticket.status === "approved") {
      return `${ticket.remaining} people remaining`;
    }
    if (ticket.status === "pending") {
      return "Awaiting approval";
    }
    return "Checked in";
  }

  return (
    <div className="book-tickets">
      <div className="section-header">
        <div>
          <h2>Tickets Overview</h2>
          <p className="section-subtitle">
            Track bookings, remaining seats, and entry counts in one dashboard.
          </p>
        </div>
        <button onClick={loadTickets} className="btn-refresh">
          Refresh
        </button>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label htmlFor="status-book-filter">Status</label>
          <select
            id="status-book-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-chip-group">
          {QUICK_FILTERS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={quickFilter === chip.value ? "active" : ""}
              onClick={() => {
                setQuickFilter(chip.value);
                setPage(1);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <label htmlFor="book-per-page">Per page</label>
          <select
            id="book-per-page"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {PER_PAGE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-meta">
          <span>Total Records: {totalItems}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Total People</p>
          <h3>{summary.totalPeople}</h3>
        </div>
        <div className="metric-card">
          <p>Remaining</p>
          <h3>{summary.totalRemaining}</h3>
        </div>
        <div className="metric-card">
          <p>Checked In</p>
          <h3>{summary.totalScanned}</h3>
        </div>
        <div className="metric-card">
          <p>Total Value</p>
          <h3>Rs. {summary.totalPrice.toLocaleString()}</h3>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No tickets found for this filter.</div>
      ) : (
        <>
          <div className="tickets-table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>People</th>
                  <th>Checked In</th>
                  <th>Remaining</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>Status Message</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="ticket-cell">
                        <span className="badge capitalize">
                          {ticket.ticketType}
                        </span>
                        <div className="buyer-detail">
                          <strong>{ticket.name}</strong>
                          <span>{ticket.email}</span>
                          <span>{ticket.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>{ticket.quantity}</td>
                    <td>{ticket.scanCount}</td>
                    <td>{ticket.remaining}</td>
                    <td>Rs. {Number(ticket.price || 0).toLocaleString()}</td>
                    <td>{renderStatus(ticket.status)}</td>
                    <td>{renderStatusMessage(ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button onClick={() => changePage(page - 1)} disabled={page === 1}>
              Previous
            </button>
            {renderPageButtons()}
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
