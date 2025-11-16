/**
 * API utility with automatic token refresh
 * Handles 401 errors by refreshing access token and retrying request
 */

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Global refresh function - will be set by App.jsx
let globalRefreshToken = null;

export function setRefreshTokenFunction(refreshFn) {
  globalRefreshToken = refreshFn;
}

/**
 * Fetch wrapper with automatic token refresh
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {string} accessToken - Current access token
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}, accessToken) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: "include", // Include cookies for refresh token
  });

  // If 401 and we have a refresh function, try to refresh token
  if (response.status === 401 && globalRefreshToken) {
    try {
      const newToken = await globalRefreshToken();
      // Retry request with new token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } catch (refreshError) {
      // Refresh failed - return original 401 response
      return response;
    }
  }

  return response;
}
