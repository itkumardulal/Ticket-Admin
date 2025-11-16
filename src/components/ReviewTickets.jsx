import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "cancelled", label: "Cancelled" },
];
const PER_PAGE_OPTIONS = [10, 20, 50, 100];
const SUPPORTED_STATUSES = new Set(["pending", "approved", "cancelled"]);

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return value;
  }
}

export default function ReviewTickets({ jwt }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

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
        view: "review", // Tell backend this is review page
      });
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const res = await fetch(`${API_BASE}/api/admin/tickets?${params}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tickets");
      setTickets(data.data || data.items || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      const message = err.message || "Failed to load tickets";
      setError(message);
      toast.error(message);
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
      toast.success(data.message || "Ticket approved successfully");
    } catch (err) {
      toast.error(err.message || "Failed to approve ticket");
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
    if (!window.confirm("Are you sure you want to cancel this ticket?")) return;
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
      toast.success(data.message || "Ticket cancelled");
    } catch (err) {
      toast.error(err.message || "Failed to cancel ticket");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function sendWhatsApp(ticket) {
    if (!ticket.phone) {
      toast.error("Phone number not available for WhatsApp message");
      return;
    }
    if (ticket.whatsappSent) {
      toast.info("WhatsApp message already sent");
      return;
    }
    if (processing.has(ticket.id)) return;
    setProcessing((prev) => new Set(prev).add(ticket.id));
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/tickets/${ticket.id}/whatsapp`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to generate WhatsApp link");

      // Open WhatsApp URL in new tab
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      if (data.ticket) {
        updateTicket(ticket.id, data.ticket);
      }
      toast.success("WhatsApp message opened successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to send WhatsApp message");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  }

  async function copyQRLink(ticket) {
    if (!ticket.qrImageUrl) {
      toast.error("QR link not available for this ticket");
      return;
    }
    try {
      await navigator.clipboard.writeText(ticket.qrImageUrl);
      toast.success("QR link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy QR link to clipboard");
    }
  }

  function renderStatus(status) {
    return <span className={`status-badge status-${status}`}>{status}</span>;
  }

  const summary = useMemo(() => {
    const totalPrice = tickets.reduce((acc, ticket) => {
      if (ticket.status === "cancelled") return acc;
      return acc + Number(ticket.price || 0);
    }, 0);
    return {
      count: tickets.length,
      totalPrice,
    };
  }, [tickets]);

  function renderActions(ticket) {
    const actionable =
      ticket.status === "approved" || ticket.status === "pending";
    return (
      <div className="ticket-actions">
        <div className="primary-action-row">
          {ticket.status === "pending" ? (
            <>
              <button
                onClick={() => approveTicket(ticket.id)}
                disabled={processing.has(ticket.id)}
                className="btn-approve"
                type="button"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => cancelTicket(ticket.id)}
                disabled={processing.has(ticket.id)}
                className="btn-cancel"
                type="button"
              >
                ❌ Cancel
              </button>
            </>
          ) : (
            <span className={`status-label ${ticket.status}`}>
              {ticket.status === "approved"
                ? "Ticket Approved"
                : ticket.status === "cancelled"
                ? "Ticket Cancelled"
                : ticket.status}
            </span>
          )}
        </div>
        {actionable && (
          <button
            type="button"
            className="btn-whatsapp action-stacked"
            onClick={() => sendWhatsApp(ticket)}
            disabled={ticket.whatsappSent || processing.has(ticket.id)}
          >
            {ticket.whatsappSent ? "✅ Message Sent" : "💬 WhatsApp"}
          </button>
        )}
        {ticket.status === "approved" && !ticket.emailSent && (
          <span className="status-hint danger">
            Email failed to send — please retry
          </span>
        )}
      </div>
    );
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
          type="button"
        >
          {i}
        </button>
      );
    }
    return pages;
  }

  function renderTicketCard(ticket, index) {
    const serial = (page - 1) * perPage + index + 1;
    return (
      <article className="ticket-card" key={ticket.id}>
        <header className="ticket-card-header">
        <p className="ticket-serial">S.N. {serial}</p>
          <div>
            {typeof ticket.ticketNumber !== "undefined" && (
              <span className="ticket-number">
                Ticket No: {ticket.ticketNumber ?? "--"}
              </span>
            )}
            <h3>{ticket.name}</h3>
            <p>{ticket.email}</p>
            <p>{ticket.phone}</p>
          </div>
          <div className="ticket-card-meta">
            {renderStatus(ticket.status)}
            <span className="ticket-card-date">
              Order At {formatDate(ticket.createdAt)}
            </span>
          </div>
        </header>
        <div className="ticket-card-body">
          <div>
            <span>Ticket Type</span>
            <strong className="capitalize">{ticket.ticketType}</strong>
          </div>
          <div>
            <span>Quantity</span>
            <strong>{ticket.quantity}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{ticket.remaining}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className="capitalize">{ticket.status}</strong>
          </div>
          <div>
            <span>QR Link</span>
            <strong>
              {ticket.qrImageUrl ? (
                <button
                  type="button"
                  className="btn-copy-qr"
                  onClick={() => copyQRLink(ticket)}
                  disabled={processing.has(ticket.id)}
                  title="Copy QR Link"
                  style={{ marginTop: "4px" }}
                >
                  📋 Copy
                </button>
              ) : (
                "--"
              )}
            </strong>
          </div>
        </div>
        <footer className="ticket-card-footer">{renderActions(ticket)}</footer>
      </article>
    );
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
        <button onClick={loadTickets} className="btn-refresh" type="button">
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

      {loading ? (
        <div className="loading">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No tickets found</div>
      ) : (
        <>
          <div className="tickets-table-wrapper desktop-only">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>S.N.</th>
                  <th>Buyer</th>
                  <th>Order At</th>
                  <th>Ticket Type</th>
                  <th> Ticket Number</th>
                  <th>Quantity</th>
                  <th>Remaining</th>
                  <th>Scanned</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>QR Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={ticket.id}>
                    <td>{(page - 1) * perPage + index + 1}</td>
                    <td>
                      <div className="buyer-cell">
                        <span className="buyer-name">{ticket.name}</span>
                        <span className="buyer-meta">{ticket.email}</span>
                        <span className="buyer-meta">{ticket.phone}</span>
                      </div>
                    </td>
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td className="capitalize">{ticket.ticketType}</td>
                    <td>{ticket.ticketNumber || "-"}</td>
                    <td>{ticket.quantity}</td>
                    <td>{ticket.remaining}</td>
                    <td>{ticket.scanCount}</td>
                    <td>{formatCurrency(ticket.price)}</td>
                    <td>{renderStatus(ticket.status)}</td>
                    <td>
                      {ticket.qrImageUrl ? (
                        <button
                          type="button"
                          className="btn-copy-qr"
                          onClick={() => copyQRLink(ticket)}
                          disabled={processing.has(ticket.id)}
                          title="Copy QR Link"
                        >
                          📋 Copy
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>
                    <td>{renderActions(ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ticket-card-grid mobile-only">
            {tickets.map((ticket, index) => renderTicketCard(ticket, index))}
          </div>

          <div className="table-summary">
            <span>
              Total Records: {totalItems} | Total value (excluding cancelled):
              {formatCurrency(summary.totalPrice)}
            </span>
          </div>

          <div className="pagination">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              type="button"
            >
              Previous
            </button>
            {renderPageButtons()}
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
              type="button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
