export const API_BASE = "";

export type ListRow = {
  name: string;
  uuid: string;
  content: string;
  utc_datetime: string; // ISO UTC
};

export type CreateInfo = {
  type: string;
  arguments: { type: "DATETIME" | "TEXT" | "TEXTAREA" | "INTEGER" | "FLOAT" | "BOOLEAN"; label: string; desc: string }[];
};

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { method: "GET" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

export function utcIsoFromDatetimeLocal(value: string): string {
  // value like "2026-01-12T16:30"
  // JS Date interprets this as local time; convert to UTC ISO
  const d = new Date(value);
  return d.toISOString(); // includes Z
}

export function formatLocal(utcIso: string): string {
  const d = new Date(utcIso);
  return d.toLocaleString();
}

export function isPast(utcIso: string): boolean {
  return new Date(utcIso).getTime() <= Date.now();
}
