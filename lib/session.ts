import { cookies } from "next/headers";

/**
 * The OpenBao token is stored in an httpOnly cookie so it is never exposed to
 * client-side JavaScript. All authenticated calls go through the BFF, which
 * reads the token from this cookie server-side.
 */
export const COOKIE_NAME = process.env.BAO_COOKIE_NAME ?? "bao_token";

const isProd = process.env.NODE_ENV === "production";

export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value;
}

export async function setToken(token: string, maxAgeSeconds: number) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // Fall back to a session cookie when OpenBao reports no lease duration.
    maxAge: maxAgeSeconds > 0 ? maxAgeSeconds : undefined,
  });
}

export async function clearToken() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
