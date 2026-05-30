/**
 * Server-side OpenBao client. Used by BFF route handlers and Server
 * Components only — the token never reaches the browser as JS-readable state.
 *
 * Base address comes from OPENBAO_ADDR (the in-container OpenBao in Docker).
 */
const OPENBAO_ADDR = process.env.OPENBAO_ADDR ?? "http://127.0.0.1:8200";

export type OpenBaoError = {
  status: number;
  errors: string[];
};

export class OpenBaoRequestError extends Error {
  status: number;
  errors: string[];

  constructor(status: number, errors: string[]) {
    super(errors[0] ?? `OpenBao request failed (${status})`);
    this.name = "OpenBaoRequestError";
    this.status = status;
    this.errors = errors;
  }
}

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, body } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Vault-Token"] = token;

  const res = await fetch(`${OPENBAO_ADDR}/v1/${path.replace(/^\/+/, "")}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errors: string[] = data?.errors?.length
      ? data.errors
      : [`OpenBao request failed (${res.status})`];
    throw new OpenBaoRequestError(res.status, errors);
  }

  return data as T;
}

// --- Typed wrappers for the endpoints used by the current scaffold ---

export type TokenLookup = {
  data: {
    display_name: string;
    policies: string[];
    ttl: number;
    renewable: boolean;
    expire_time: string | null;
    meta: Record<string, string> | null;
  };
};

export type SealStatus = {
  type: string;
  initialized: boolean;
  sealed: boolean;
  version: string;
  cluster_name?: string;
};

export type AuthResponse = {
  auth: {
    client_token: string;
    policies: string[];
    metadata: Record<string, string> | null;
    lease_duration: number;
    renewable: boolean;
  };
};

export type MountsResponse = {
  data: Record<
    string,
    { type: string; description: string; accessor: string }
  >;
};

export const openbao = {
  /** Validate a raw token and return its metadata. */
  lookupSelf: (token: string) =>
    request<TokenLookup>("auth/token/lookup-self", { token }),

  /** Username/password login -> returns a client token in `auth`. */
  userpassLogin: (username: string, password: string) =>
    request<AuthResponse>(`auth/userpass/login/${encodeURIComponent(username)}`, {
      method: "POST",
      body: { password },
    }),

  /** Unauthenticated: current seal status of the instance. */
  sealStatus: () => request<SealStatus>("sys/seal-status"),

  /** List enabled secret engines (mounts). */
  listMounts: (token: string) =>
    request<MountsResponse>("sys/mounts", { token }),
};

export { OPENBAO_ADDR };
