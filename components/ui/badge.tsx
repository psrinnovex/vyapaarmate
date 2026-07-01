import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-ocean/15 bg-ocean/10 text-ocean",
        primary: "border-ocean/15 bg-ocean/10 text-ocean",
        blue: "border-ocean/15 bg-ocean/10 text-ocean",
        emerald: "border-emerald/20 bg-emerald/10 text-emerald",
        purple: "border-violet/20 bg-violet/10 text-violet",
        amber: "border-amber-200 bg-amber-100 text-amber-800",
        red: "border-red-200 bg-red-50 text-red-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        destructive: "border-red-200 bg-red-50 text-red-700",
        neutral: "border-slate-200 bg-slate-100 text-slate-700",
        secondary: "border-line bg-white text-slate-700",
        outline: "border-line bg-transparent text-slate-700",
        ghost: "border-transparent bg-transparent text-slate-700",
        link: "border-transparent bg-transparent p-0 text-ocean underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
