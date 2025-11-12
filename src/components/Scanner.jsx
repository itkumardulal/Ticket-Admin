import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const fileInputRef = useRef(null);
  const processingRef = useRef(false);
  const isScanningRef = useRef(false);

  useEffect(() => {
    scannerRef.current = document.getElementById("qr-region");
    // Enumerate cameras early
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices || []);
        if (devices && devices.length > 0) {
          // Prefer back/environment camera if label hints, else first
          const env = devices.find((d) =>
            /back|rear|environment/i.test(d.label || "")
          );
          setCameraId((env || devices[0]).id);
        }
      })
      .catch(() => {
        // ignore
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
    setScanning(true);
    isScanningRef.current = true;
    const html5QrCode = new Html5Qrcode("qr-region");
    html5QrRef.current = html5QrCode;
    try {
      const constraints = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };
      // Conservative settings to reduce driver/GPU stress
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
    } catch (e) {
      setMessage(
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
      // Try to stop the scanner - catch all errors to prevent uncaught exceptions
      await html5QrRef.current.stop().catch((err) => {
        // Silently ignore - scanner might not be running
        return;
      });
    } catch (e) {
      // Silently ignore stop errors - scanner might already be stopped
    }
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.clear().catch(() => {
          // Ignore clear errors
        });
      }
    } catch (e) {
      // Silently ignore clear errors
    }
    setScanning(false);
    isScanningRef.current = false;
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
      setResult(null);
      setMessage(err.message || "Verification error");
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
    try {
      // Create a temp Html5Qrcode instance for file scan
      const regionId = "qr-region";
      let instance = html5QrRef.current;
      if (!instance) {
        instance = new Html5Qrcode(regionId);
      }
      const decoded = await instance.scanFileV2(file, /* showImage= */ true);
      await onScanSuccess(decoded.decodedText);
    } catch (err) {
      setMessage("Could not read QR from image");
    }
    // reset input
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

      if (data.status === "awaiting_count") {
        setPendingToken(token);
        const remaining = data.ticket?.remaining || 1;
        setCountInput(clampCount(remaining, remaining));
      } else {
        resetPending();
      }
    } catch (err) {
      setResult(null);
      setMessage(err.message || "Verification error");
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
      <div className="controls">
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
        <button onClick={startScan} disabled={scanning || !cameraId || loading}>
          Start Scanner
        </button>
        <button className="secondary" onClick={stopScan} disabled={!scanning}>
          Stop
        </button>
        <button className="secondary" onClick={pickImage} disabled={loading}>
          Scan from Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onImagePicked}
        />
      </div>
      <div id="qr-region" className="qr-region"></div>
      {loading && (
        <div className="loader">
          <div className="spinner" /> Verifying ticket...
        </div>
      )}
      {message && <div className="status">{message}</div>}

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
                  clampCount(Number(e.target.value), pendingTicket?.remaining || 1)
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
            </ul>
          ) : (
            <p>No additional ticket details available.</p>
          )}

          {!scanning && !loading && (
            <button className="secondary" onClick={startScan}>
              Start New Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
