import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva(
  "flex gap-3 rounded-lg border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-secondary text-accent-muted [&>svg]:text-accent-subtle",
        info: "border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600",
        warning: "border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600",
        danger: "border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = "Alert";

export { Alert };
