function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // ALWAYS same-origin in browser
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Non-JSON response (likely Access redirect)');
  }

  const json = await res.json();

  if (!isObject(json) || json.ok !== true) {
    throw new Error(json?.error || json?.message || 'API error');
  }

  if ('items' in json) return json.items as T;
  if ('item' in json) return json.item as T;
  if ('data' in json) return json.data as T;

  return json as T;
}
