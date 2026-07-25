import { getValidatedToken } from "@/lib/session";

/**
 * Scope locally stored UI metadata to a token verified in the same namespace.
 * The namespace header is client-controlled, so it must be part of validation.
 */
export async function getValidatedMetadataSession(headers: Headers) {
  const namespace = headers.get("x-vault-namespace") ?? "";
  const token = await getValidatedToken(namespace);
  return token ? { namespace, token } : undefined;
}
