/**
 * Server-side gate for writes to the UI metadata store.
 *
 * Labels and UI config are non-secret, but mutating them is an operator action,
 * so we only allow it for tokens that can manage mounts (create/update/sudo on
 * sys/mounts — which a root token satisfies via "root"). This keeps the BFF's
 * stateful layer governed by OpenBao's own authorization rather than inventing
 * a parallel permission system.
 */
import { openbao } from "@/lib/openbao";

const ADMIN_CAPS = new Set(["create", "update", "sudo", "root"]);

export async function isOperator(
  token: string,
  namespace?: string,
): Promise<boolean> {
  try {
    const res = await openbao.capabilitiesSelf(token, ["sys/mounts"], namespace);
    const caps =
      (res.data?.["sys/mounts"] as string[] | undefined) ??
      res.data?.capabilities ??
      [];
    return caps.some((c) => ADMIN_CAPS.has(c));
  } catch {
    return false;
  }
}
