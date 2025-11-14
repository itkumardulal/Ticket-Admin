import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const NO_REMAINING_MESSAGE = "Tickets already scanned — no people remaining.";

function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Scanner({ jwt }) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [pendingTicket, setPendingTicket] = useState(null);
  const [countInput, setCountInput] = useState(1);
  const [lastScanTime, setLastScanTime] = useState("");
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const fileInputRef = useRef(null);
  const processingRef = useRef(false);
  const isScanningRef = useRef(false);

  useEffect(() => {
    scannerRef.current = document.getElementById("qr-region");
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices || []);
        if (devices && devices.length > 0) {
          const env = devices.find((d) =>
            /back|rear|environment/i.test(d.label || "")
          );
          setCameraId((env || devices[0]).id);
        }
      })
      .catch(() => {
        toast.error("Unable to access cameras on this device.");
      });
    return () => {
      if (html5QrRef.current && isScanningRef.current) {
        html5QrRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              html5QrRef.current?.clear();
            } catch (e) {
              // ignore clear errors
            }
            html5QrRef.current = null;
            isScanningRef.current = false;
          });
      }
    };
  }, []);

  async function startScan() {
    if (scanning || isScanningRef.current) return;
    resetPending();
    setMessage("");
    setResult(null);
    setLastScanTime("");
    setScanning(true);
    isScanningRef.current = true;
    const html5QrCode = new Html5Qrcode("qr-region");
    html5QrRef.current = html5QrCode;
    try {
      const constraints = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };
      const config = {
        fps: 8,
        qrbox: 250,
        aspectRatio: 1.777,
        rememberLastUsedCamera: true,
        videoConstraints: {
          ...constraints,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
      };
      await html5QrCode.start(constraints, config, onScanSuccess);
      toast.info("Scanner started");
    } catch (e) {
      setMessage(
        "Camera start failed. Try another camera or use image upload."
      );
      toast.error(
        "Camera start failed. Try another camera or use image upload."
      );
      setScanning(false);
      isScanningRef.current = false;
      html5QrRef.current = null;
    }
  }

  async function stopScan() {
    if (!html5QrRef.current || !isScanningRef.current) {
      setScanning(false);
      isScanningRef.current = false;
      return;
    }
    try {
      await html5QrRef.current.stop().catch(() => {});
    } catch (e) {
      // ignore stop errors
    }
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.clear().catch(() => {});
      }
    } catch (e) {
      // ignore clear errors
    }
    setScanning(false);
    isScanningRef.current = false;
    toast.info("Scanner stopped");
  }

  async function onScanSuccess(decodedText) {
    if (processingRef.current || !isScanningRef.current) return;
    processingRef.current = true;
    if (html5QrRef.current && isScanningRef.current) {
      try {
        await html5QrRef.current.stop().catch(() => {});
      } catch (e) {
        // ignore
      }
      try {
        await html5QrRef.current.clear().catch(() => {});
      } catch (e) {
        // ignore
      }
      isScanningRef.current = false;
      setScanning(false);
    }
    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch {
        payload = { token: decodedText };
      }
      const token = payload.token;
      if (!token) {
        throw new Error("Invalid QR format");
      }
      await processVerification(token);
    } catch (err) {
      const errorMessage = err.message || "Verification error";
      setResult(null);
      setMessage(errorMessage);
      toast.error(errorMessage);
      resetPending();
      processingRef.current = false;
    }
  }

  function pickImage() {
    fileInputRef.current?.click();
  }

  async function onImagePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setResult(null);
    setLastScanTime("");
    try {
      const regionId = "qr-region";
      let instance = html5QrRef.current;
      if (!instance) {
        instance = new Html5Qrcode(regionId);
      }
      const decoded = await instance.scanFileV2(file, true);
      await onScanSuccess(decoded.decodedText);
    } catch (err) {
      setMessage("Could not read QR from image");
      toast.error("Could not read QR from image");
    }
    e.target.value = "";
  }

  function resetPending() {
    setPendingToken("");
    setPendingTicket(null);
    setCountInput(1);
  }

  function clampCount(value, max) {
    if (!Number.isFinite(value)) return 1;
    if (value < 1) return 1;
    if (max > 0 && value > max) return max;
    return Math.floor(value);
  }

  async function processVerification(token, count) {
    setLoading(true);
    try {
      const payload = { token };
      if (typeof count === "number") {
        payload.count = count;
      }
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setResult(data);
      setMessage(data.message || data.status);

      if (data.ticket) {
        setPendingTicket(data.ticket);
      } else {
        setPendingTicket(null);
      }

      const ticketScanTime = data.ticket?.updatedAt
        ? formatDateTime(data.ticket.updatedAt)
        : "";
      const hasCheckedInBefore = (data.ticket?.scanCount || 0) > 0;

      if (data.status === "awaiting_count") {
        setPendingToken(token);
        const remaining = data.ticket?.remaining || 1;
        setCountInput(clampCount(remaining, remaining));
        setLastScanTime(hasCheckedInBefore ? ticketScanTime : "");
        toast.info(data.message || "Enter number of people to check in.");
      } else {
        resetPending();
        const fallbackTime = ticketScanTime || formatDateTime(new Date());
        setLastScanTime(data.ticket ? fallbackTime : "");
        const remaining = data.ticket?.remaining ?? null;

        if (data.status === "checked_in" || data.status === "valid") {
          if (typeof remaining === "number" && remaining <= 0) {
            toast.warning(
              ticketScanTime
                ? `${NO_REMAINING_MESSAGE} Last scanned at: ${ticketScanTime}.`
                : `${NO_REMAINING_MESSAGE}`
            );
          } else {
            toast.success(
              ticketScanTime
                ? `Ticket scanned successfully at ${ticketScanTime}`
                : "Ticket scanned successfully"
            );
          }
        } else if (data.status === "no_remaining") {
          toast.warning(
            ticketScanTime
              ? `${NO_REMAINING_MESSAGE} Last scanned at: ${ticketScanTime}.`
              : NO_REMAINING_MESSAGE
          );
        } else if (data.status === "cancelled") {
          toast.error(data.message || "Ticket is cancelled");
        } else {
          if (data.message) {
            toast.info(data.message);
          }
        }
      }
    } catch (err) {
      const errorMessage = err.message || "Verification error";
      setResult(null);
      setMessage(errorMessage);
      setLastScanTime("");
      toast.error(errorMessage);
      resetPending();
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }

  async function submitCount(e) {
    e.preventDefault();
    if (!pendingToken) return;
    const max = pendingTicket?.remaining || 1;
    const nextCount = clampCount(Number(countInput), max);
    setCountInput(nextCount);
    processingRef.current = true;
    await processVerification(pendingToken, nextCount);
  }

  return (
    <div className="scanner">
      <div className="scanner-controls">
        <label className="field">
          <span>Camera</span>
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            disabled={scanning}
          >
            {cameras.length === 0 ? (
              <option value="">No cameras found</option>
            ) : null}
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || c.id}
              </option>
            ))}
          </select>
        </label>
        <div className="scanner-actions">
          <button
            className="secondary"
            onClick={startScan}
            disabled={scanning || !cameraId || loading}
            type="button"
          >
            Start Scanner
          </button>
          <button
            className="secondary"
            onClick={stopScan}
            disabled={!scanning}
            type="button"
          >
            Stop
          </button>
          <button
            className="secondary"
            onClick={pickImage}
            disabled={loading}
            type="button"
          >
            Scan from Image
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onImagePicked}
        />
      </div>
      <div id="qr-region" className="qr-region" />
      {loading && (
        <div className="loader">
          <div className="spinner" /> Verifying ticket...
        </div>
      )}
      {message && (
        <div className="status">
          <span>{message}</span>
          {lastScanTime && (
            <small className="status-timestamp">
              Scanned at: {lastScanTime}
            </small>
          )}
        </div>
      )}

      {pendingToken && result?.status === "awaiting_count" && (
        <form className="count-form" onSubmit={submitCount}>
          <label htmlFor="count-input">People entering now</label>
          <div className="count-input">
            <button
              type="button"
              onClick={() =>
                setCountInput((prev) =>
                  clampCount(Number(prev) - 1, pendingTicket?.remaining || 1)
                )
              }
            >
              −
            </button>
            <input
              id="count-input"
              type="number"
              min={1}
              max={pendingTicket?.remaining || 1}
              value={countInput}
              onChange={(e) =>
                setCountInput(
                  clampCount(
                    Number(e.target.value),
                    pendingTicket?.remaining || 1
                  )
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                setCountInput((prev) =>
                  clampCount(Number(prev) + 1, pendingTicket?.remaining || 1)
                )
              }
            >
              +
            </button>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            Confirm Entry
          </button>
        </form>
      )}

      {result && (
        <div className="ticket">
          <h3>Ticket Details</h3>
          {result.ticket ? (
            <ul className="ticket-stats">
              <li>
                <span>Buyer</span>
                <strong>{result.ticket.name}</strong>
              </li>
              {typeof result.ticket.ticketNumber !== "undefined" && (
                <li>
                  <span>Ticket Number</span>
                  <strong>{result.ticket.ticketNumber ?? "--"}</strong>
                </li>
              )}
              <li>
                <span>Email</span>
                <strong>{result.ticket.email}</strong>
              </li>
              <li>
                <span>Phone</span>
                <strong>{result.ticket.phone}</strong>
              </li>
              <li>
                <span>Ticket Type</span>
                <strong className="capitalize">
                  {result.ticket.ticketType}
                </strong>
              </li>
              <li>
                <span>Quantity</span>
                <strong>{result.ticket.quantity}</strong>
              </li>
              <li>
                <span>Checked In</span>
                <strong>{result.ticket.scanCount}</strong>
              </li>
              <li>
                <span>Remaining</span>
                <strong>{result.ticket.remaining}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong className="capitalize">{result.ticket.status}</strong>
              </li>
              <li>
                <span>Scan Time</span>
                <strong style={{ color: "#64748b" }}>
                  {lastScanTime ||
                    formatDateTime(result.ticket.updatedAt) ||
                    "--"}
                </strong>
              </li>
            </ul>
          ) : (
            <p>No additional ticket details available.</p>
          )}

          {!scanning && !loading && (
            <button className="secondary" onClick={startScan} type="button">
              Start New Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
