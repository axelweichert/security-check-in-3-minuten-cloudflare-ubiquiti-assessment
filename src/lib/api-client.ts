export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include', // wichtig für Cloudflare Access
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();

  // Unterstützt beide Formate:
  // { ok: true, items }
  // { ok: true, item }
  // { ok: true, ... }
  if (json.ok === true) {
    if ('data' in json) return json.data;
    if ('item' in json) return json.item;
    if ('items' in json) return json.items;
    return json;
  }

  throw new Error(json.error || 'API error');
}

