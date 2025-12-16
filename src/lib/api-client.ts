export type ApiOkResponse<T> =
  | { ok: true; data: T }
  | { ok: true; item: T }
  | { ok: true; items: T }
  | ({ ok: true } & T);

export type ApiErrResponse = {
  ok: false;
  error?: string;
  message?: string;
};

type LegacySuccessResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  // Cloudflare Access: unauth often ends up as HTML/login redirect
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (res.redirected || text.includes('/cdn-cgi/access/login')) {
      throw new Error('Access redirect: not authenticated/authorized for API');
    }
    throw new Error(`Unexpected non-JSON response (${res.status})`);
  }

  const json = (await res.json()) as unknown;

  // New API shape: { ok: true, item/items/data ... }
  if (isObject(json) && 'ok' in json) {
    const ok = (json as any).ok === true;
    if (!ok) {
      const e = json as ApiErrResponse;
      throw new Error(e.message || e.error || 'Request failed');
    }
    const j = json as any;
    if ('data' in j) return j.data as T;
    if ('item' in j) return j.item as T;
    if ('items' in j) return j.items as T;
    return json as T;
  }

  // Legacy shape: { success: true, data: ... }
  if (isObject(json) && 'success' in json) {
    const j = json as LegacySuccessResponse<T>;
    if (!res.ok || !j.success || j.data === undefined) {
      throw new Error(j.error || 'Request failed');
    }
    return j.data;
  }

  if (!res.ok) throw new Error('Request failed');
  return json as T;
}
