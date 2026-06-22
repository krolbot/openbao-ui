/* eslint-disable @next/next/no-img-element */
import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/utils";

// Official OpenBao wordmark+mark (openbao/artwork). Color on light backgrounds,
// white on dark — swapped via the `dark` class.
export function Logo({
  variant = "horizontal",
  className,
}: {
  variant?: "horizontal" | "vertical";
  className?: string;
}) {
  // These live in public/ and are served under the app's basePath. Plain <img>
  // src is NOT basePath-rewritten by Next, so prefix it explicitly — otherwise
  // the request hits `/openbao-*.svg` (or the old `/ui/*`) and 404s.
  const base =
    variant === "vertical"
      ? `${BASE_PATH}/openbao-vertical`
      : `${BASE_PATH}/openbao-horizontal`;
  return (
    <>
      <img src={`${base}-color.svg`} alt="OpenBao" className={cn(className, "dark:hidden")} />
      <img src={`${base}-white.svg`} alt="OpenBao" className={cn(className, "hidden dark:block")} />
    </>
  );
}
