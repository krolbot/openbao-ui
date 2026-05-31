// UTF-8-safe base64 helpers (Transit plaintext is base64 over the wire, but
// users type/read plain text).
export const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export const fromBase64 = (b: string) => {
  try {
    return decodeURIComponent(escape(atob(b)));
  } catch {
    return atob(b);
  }
};
