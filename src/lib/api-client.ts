type ApiErr = { ok: false; error?: string; message?: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  const ct = res.headers.get('content-type') || '';

  // Access/HTML/Redirects sauber als Fehler rausgeben
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (res.redirected || text.includes('/cdn-cgi/access/login')) {
      throw new Error(`Access redirect / not authorized for ${path} (HTTP ${res.status})`);
    }
    throw new Error(`Non-JSON response for ${path} (HTTP ${res.status})`);
  }

  const json = (await res.json()) as unknown;

  // ok-shape
  if (isObject(json) && 'ok' in json) {
    const ok = (json as any).ok === true;
    if (!ok) {
      const e = json as ApiErr;
      throw new Error(e.message || e.error || `Request failed for ${path}`);
    }
    const j = json as any;

    // akzeptiere alle Varianten
    if ('data' in j) return j.data as T;
    if ('item' in j) return j.item as T;
    if ('items' in j) return j.items as T;

    // notfalls raw ok-object
    return json as T;
  }

  // legacy {success,data}
  if (isObject(json) && 'success' in json) {
    const j = json as any;
    if (!res.ok || !j.success || j.data === undefined) {
      throw new Error(j.error || `Request failed for ${path}`);
    }
    return j.data as T;
  }

  if (!res.ok) throw new Error(`Request failed for ${path} (HTTP ${res.status})`);
  return json as T;
}
