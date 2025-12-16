import type { ApiResponse } from "../../shared/types";

/**
 * Unified API client:
 * Supports legacy shape: { success: boolean, data?: T, error?: string }
 * Supports new shape used by Pages Functions: { ok: boolean, items?: any, leads?: any, ... }
 *
 * Also enforces credentials for Cloudflare Access-protected endpoints.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    credentials: "include", // IMPORTANT for Cloudflare Access session cookies
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  // If Access returns HTML (login page), fail with a readable error
  if (!isJson) {
    const text = await res.text().catch(() => "");
    const hint =
      contentType.includes("text/html") || text.includes("<html")
        ? "Cloudflare Access authentication required or blocked request."
        : `Unexpected content-type: ${contentType || "unknown"}`;
    throw new Error(`${hint} (HTTP ${res.status})`);
  }

  const json = (await res.json()) as any;

  // 1) Legacy shape: ApiResponse<T> = { success, data, error }
  const legacy = json as ApiResponse<T>;
  if (typeof legacy?.success === "boolean") {
    if (!res.ok || !legacy.success || legacy.data === undefined) {
      throw new Error(legacy.error || `Request failed (HTTP ${res.status})`);
    }
    return legacy.data;
  }

  // 2) New shape: { ok:true, items:[...] } or { ok:true, leads:[...] } or direct payload
  if (typeof json?.ok === "boolean") {
    if (!res.ok || json.ok !== true) {
      throw new Error(json.message || json.error || `Request failed (HTTP ${res.status})`);
    }

    // Prefer explicit containers when present
    if (json.items !== undefined) return json.items as T;
    if (json.leads !== undefined) return json.leads as T;

    // Otherwise return full object as T (for endpoints that already return the payload)
    return json as T;
  }

  // 3) Fallback: If endpoint returns payload directly
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Request failed (HTTP ${res.status})`);
  }
  return json as T;
}
