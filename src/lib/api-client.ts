export type ApiOk<T> =
  | { ok: true; data: T }
  | { ok: true; items: T }
  | { ok: true; item: T };

export type ApiError = {
  ok: false;
  error: string;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (res.status === 302 || res.status === 401) {
    throw new Error("Not authenticated (Cloudflare Access)");
  }

  const json = (await res.json()) as ApiOk<T> | ApiError;

  if (!json || typeof json !== "object") {
    throw new Error("Invalid API response");
  }

  if (!json.ok) {
    throw new Error(json.error || "API error");
  }

  if ("data" in json) return json.data;
  if ("items" in json) return json.items;
  if ("item" in json) return json.item;

  throw new Error("Malformed ok response");
}
