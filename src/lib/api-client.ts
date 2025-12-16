export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include', // <<< DAS WAR DER FEHLENDE TEIL
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

  if (json?.ok === false) {
    throw new Error(json.message || json.error || 'Request failed');
  }

  if ('items' in json) return json.items as T;
  if ('item' in json) return json.item as T;
  if ('data' in json) return json.data as T;

  return json as T;
}
