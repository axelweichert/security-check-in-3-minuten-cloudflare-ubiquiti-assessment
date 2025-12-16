type AnyJson = Record<string, any>;

/**
 * Unified API client that supports both response shapes:
 * 1) Legacy: { success: true, data: T, error?: string }
 * 2) Current: { ok: true, items?: T, leads?: T, data?: T, error?: string, message?: string }
 *
 * Also includes cookies (Cloudflare Access) via credentials:"include".
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  let json: AnyJson | null = null;
  try {
    json = (await res.json()) as AnyJson;
  } catch {
    // Non-JSON (e.g., Access HTML) -> surface a useful error
    throw new Error(`Non-JSON response (${res.status}) from ${path}`);
  }

  // If HTTP status is not ok, throw with best message we can find
  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      json?.errors?.[0]?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  // Shape A: { success: true, data: ... }
  if (json?.success === true && "data" in json) {
    return json.data as T;
  }

  // Shape B: { ok: true, items: [...] } or { ok: true, leads: [...] } or { ok: true, data: ... }
  if (json?.ok === true) {
    if ("items" in json) return json.items as T;
    if ("leads" in json) return json.leads as T;
    if ("data" in json) return json.data as T;
    // Some endpoints return ok:true + lead_id etc.
    return json as T;
  }

  // Unknown shape
  throw new Error(json?.error || json?.message || "Unexpected API response shape");
}

