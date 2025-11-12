import React, { useState, useEffect, useMemo } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "cancelled", label: "Cancelled" },
];
const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function ReviewTickets({ jwt }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, perPage, page]);

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
      setTickets(data.items || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateTicket(id, nextTicket) {
    if (!nextTicket) return;
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === id ? { ...ticket, ...nextTicket } : ticket
      )
    );
  }

  async function approveTicket(id) {
    if (processing.has(id)) return;
    setProcessing((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/admin/tickets/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve ticket");
      if (data.ticket) {
        updateTicket(id, data.ticket);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function cancelTicket(id) {
    if (processing.has(id)) return;
    if (!confirm("Are you sure you want to cancel this ticket?")) return;
    setProcessing((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/admin/tickets/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel ticket");
      if (data.ticket) {
        updateTicket(id, data.ticket);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function renderStatus(status) {
    return <span className={`status-badge status-${status}`}>{status}</span>;
  }

  const summary = useMemo(() => {
    const totalPrice = tickets.reduce(
      (acc, ticket) => acc + Number(ticket.price || 0),
      0
    );
    return {
      count: tickets.length,
      totalPrice,
    };
  }, [tickets]);

  function renderActions(ticket) {
    if (ticket.status === "pending") {
      return (
        <div className="ticket-actions">
          <button
            onClick={() => approveTicket(ticket.id)}
            disabled={processing.has(ticket.id)}
            className="btn-approve"
          >
            ✅ Approve
          </button>
          <button
            onClick={() => cancelTicket(ticket.id)}
            disabled={processing.has(ticket.id)}
            className="btn-cancel"
          >
            ❌ Cancel
          </button>
        </div>
      );
    }

    if (ticket.status === "approved") {
      return (
        <div className="action-status">
          <span className="status-label success">Ticket Approved</span>
          {!ticket.emailSent && (
            <span className="status-hint danger">
              Email failed to send — please retry
            </span>
          )}
        </div>
      );
    }

    if (ticket.status === "cancelled") {
      return <span className="status-label danger">Ticket Cancelled</span>;
    }

    return <span className="status-label">{ticket.status}</span>;
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

  return (
    <div className="review-tickets">
      <div className="section-header">
        <div>
          <h2>Review Tickets</h2>
          <p className="section-subtitle">
            Pending tickets are listed first, followed by approved and
            cancelled.
          </p>
        </div>
        <button onClick={loadTickets} className="btn-refresh">
          Refresh
        </button>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label htmlFor="status-filter">Filter by status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="per-page">Per page</label>
          <select
            id="per-page"
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
      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="loading">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No tickets found</div>
      ) : (
        <>
          <div className="tickets-table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Ticket Type</th>
                  <th>Quantity</th>
                  <th>Remaining</th>
                  <th>Scanned</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="buyer-cell">
                        <span className="buyer-name">{ticket.name}</span>
                        <span className="buyer-meta">{ticket.email}</span>
                        <span className="buyer-meta">{ticket.phone}</span>
                      </div>
                    </td>
                    <td className="capitalize">{ticket.ticketType}</td>
                    <td>{ticket.quantity}</td>
                    <td>{ticket.remaining}</td>
                    <td>{ticket.scanCount}</td>
                    <td>Rs. {Number(ticket.price || 0).toLocaleString()}</td>
                    <td>{renderStatus(ticket.status)}</td>
                    <td>{renderActions(ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-summary">
            <span>
              Showing {summary.count} ticket
              {summary.count === 1 ? "" : "s"} | Total value: Rs.{" "}
              {summary.totalPrice.toLocaleString()}
            </span>
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
