// UTF-8-safe base64 helpers (Transit plaintext is base64 over the wire, but
// users type/read plain text). Uses Buffer when present (Node / unit tests) and
// TextEncoder/TextDecoder + btoa/atob in the browser — no deprecated
// escape/unescape.

const hasBuffer = typeof Buffer !== "undefined";

export const toBase64 = (s: string): string => {
  if (hasBuffer) return Buffer.from(s, "utf-8").toString("base64");
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export const fromBase64 = (b: string): string => {
  if (hasBuffer) return Buffer.from(b, "base64").toString("utf-8");
  try {
    const bin = atob(b);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(b);
  }
};
