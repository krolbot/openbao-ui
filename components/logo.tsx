/* eslint-disable @next/next/no-img-element */
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
  const base = variant === "vertical" ? "/ui/openbao-vertical" : "/ui/openbao-horizontal";
  return (
    <>
      <img src={`${base}-color.svg`} alt="OpenBao" className={cn(className, "dark:hidden")} />
      <img src={`${base}-white.svg`} alt="OpenBao" className={cn(className, "hidden dark:block")} />
    </>
  );
}
