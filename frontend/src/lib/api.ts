import { getToken, refreshAccessToken, clearTokens } from "./auth";

/**
 * Error thrown by apiFetch for non-2xx responses. Carries the HTTP status and,
 * when the backend returned a parseable `detail` message, that message too,
 * so callers/toasts can surface the real API error instead of a generic one.
 */
export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, detail?: string) {
    super(detail || `API error: ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function extractDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && typeof (d as { msg?: unknown }).msg === "string" ? (d as { msg: string }).msg : null))
      .filter((m): m is string => !!m);
    if (msgs.length > 0) return msgs.join("; ");
  }
  if (detail && typeof detail === "object" && typeof (detail as { detail?: unknown }).detail === "string") {
    return (detail as { detail: string }).detail;
  }
  return undefined;
}

/** Best-effort human-readable message for any error thrown by apiFetch. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) return error.detail || error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${path}`, { ...init, headers, credentials: "include" });

  // Try refresh on 401
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      res = await fetch(`${path}`, { ...init, headers, credentials: "include" });
    } else {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      detail = extractDetail(await res.json());
    } catch {
      // response body wasn't JSON: fall back to the generic status message
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
