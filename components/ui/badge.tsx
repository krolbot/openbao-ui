import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        muted: "bg-muted text-muted-foreground",
        outline: "border text-muted-foreground",
        primary: "bg-primary/10 text-primary",
        success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
        warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        danger: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
