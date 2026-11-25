import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-ocean/15 bg-ocean-soft text-ocean-deep",
        primary: "border-ocean/15 bg-ocean-soft text-ocean-deep",
        blue: "border-ocean/15 bg-ocean-soft text-ocean-deep",
        emerald: "border-emerald/20 bg-emerald-soft text-emerald-deep",
        purple: "border-violet/20 bg-violet-soft text-violet-deep",
        amber: "border-mango/30 bg-mango-soft text-mango-deep",
        red: "border-berry/25 bg-berry-soft text-berry-deep",
        danger: "border-berry/25 bg-berry-soft text-berry-deep",
        destructive: "border-berry/25 bg-berry-soft text-berry-deep",
        neutral: "border-slate-200 bg-slate-100 text-slate-700",
        secondary: "border-white bg-white text-slate-700 shadow-clay-sm",
        outline: "border-line bg-transparent text-slate-700",
        ghost: "border-transparent bg-transparent text-slate-700 shadow-none",
        link: "border-transparent bg-transparent p-0 text-ocean underline-offset-4 shadow-none hover:underline",
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
