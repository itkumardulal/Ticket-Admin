import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "checkedin", label: "Checked In" },
];

const QUICK_FILTERS = [
  { value: "all", label: "All Tickets" },
  { value: "remaining", label: "Remaining" },
  { value: "scanned", label: "Fully Scanned" },
];

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return value;
  }
}

export default function BookTickets({ jwt }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, quickFilter]);

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
        view: "book", // Tell backend this is book page
      });
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (quickFilter !== "all") {
        params.append("quickFilter", quickFilter);
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
    if (ticket.remaining === 0) {
      return "All attendees checked in";
    }
    if (ticket.status === "approved") {
      return `${ticket.remaining} people remaining`;
    }
    return "Checked in";
  }

  function renderTicketCard(ticket, index) {
    const serial = (page - 1) * perPage + index + 1;
    const lastScanTime = ticket.updatedAt ? formatDate(ticket.updatedAt) : "--";
    return (
      <article className="ticket-card" key={ticket.id}>
        <header className="ticket-card-header">
          <div>
            <span className="ticket-serial">S.N. {serial}</span>
            {typeof ticket.ticketNumber !== "undefined" && (
              <span className="ticket-number">
                Ticket Number{ticket.ticketNumber ?? "--"}
              </span>
            )}
            <h3>{ticket.name}</h3>
            <p>{ticket.email}</p>
            <p>{ticket.phone}</p>
          </div>
          <div className="ticket-card-meta">
            {renderStatus(ticket.status)}
            <span className="ticket-card-date">
              Booked {formatDate(ticket.createdAt)}
            </span>
            <span className="ticket-card-date">Last Scan {lastScanTime}</span>
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
            <span>Checked In</span>
            <strong>{ticket.scanCount}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{ticket.remaining}</strong>
          </div>
          <div>
            <span>Total Price</span>
            <strong>{formatCurrency(ticket.price)}</strong>
          </div>
          <div>
            <span>Last Scan</span>
            <strong>{lastScanTime}</strong>
          </div>
        </div>
        <footer className="ticket-card-footer">
          <p>{renderStatusMessage(ticket)}</p>
        </footer>
      </article>
    );
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
        <button onClick={loadTickets} className="btn-refresh" type="button">
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
          <h3>{formatCurrency(summary.totalPrice)}</h3>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No tickets found for this filter.</div>
      ) : (
        <>
          <div className="tickets-table-wrapper desktop-only">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>S.N.</th>
                  <th>Ticket #</th>
                  <th>Ticket</th>
                  <th>Buyer</th>
                  <th>People</th>
                  <th>Checked In</th>
                  <th>Remaining</th>
                  <th>Last Scan</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>Status Message</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={ticket.id}>
                    <td>{(page - 1) * perPage + index + 1}</td>
                    <td>{ticket.ticketNumber ?? "--"}</td>
                    <td>
                      <div className="ticket-cell">
                        <span className="badge capitalize">
                          {ticket.ticketType}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="buyer-detail">
                        <strong>{ticket.name}</strong>
                        <p>{ticket.email}</p>
                        <p>{ticket.phone}</p>
                      </div>
                    </td>
                    <td>{ticket.quantity}</td>
                    <td>{ticket.scanCount}</td>
                    <td>{ticket.remaining}</td>
                    <td>
                      {ticket.updatedAt ? formatDate(ticket.updatedAt) : "--"}
                    </td>
                    <td>{formatCurrency(ticket.price)}</td>
                    <td>{renderStatus(ticket.status)}</td>
                    <td>{renderStatusMessage(ticket)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8}>Total</td>
                  <td>{formatCurrency(summary.totalPrice)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="ticket-card-grid mobile-only">
            {tickets.map((ticket, index) => renderTicketCard(ticket, index))}
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
