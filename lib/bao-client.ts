"use client";

// Thin client-side wrapper around the BFF proxy (/ui/api/bao). Adds the
// namespace header, encodes LIST as ?list=true, and normalizes OpenBao errors.
const BASE = "/ui/api/bao";

export class BaoError extends Error {
  status: number;
  errors: string[];
  constructor(status: number, errors: string[]) {
    super(errors[0] ?? `Request failed (${status})`);
    this.name = "BaoError";
    this.status = status;
    this.errors = errors;
  }
}

export type BaoRequest = {
  path: string; // OpenBao path without /v1, e.g. "secret/data/foo"
  method?: string;
  body?: unknown;
  namespace?: string;
  list?: boolean;
  query?: Record<string, string | number | undefined>;
};

export async function baoFetch<T = unknown>({
  path,
  method = "GET",
  body,
  namespace,
  list,
  query,
}: BaoRequest): Promise<T> {
  const params = new URLSearchParams();
  if (list) params.set("list", "true");
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  const url = `${BASE}/${path.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  if (namespace) headers["X-Vault-Namespace"] = namespace;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errors: string[] = data?.errors?.length
      ? data.errors
      : [`Request failed (${res.status})`];
    throw new BaoError(res.status, errors);
  }
  return data as T;
}
