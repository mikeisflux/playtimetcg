/* Tiny JSON fetch wrapper: throws Error(message) on non-2xx. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string })?.error || `Request failed (${r.status})`);
  return d as T;
}
