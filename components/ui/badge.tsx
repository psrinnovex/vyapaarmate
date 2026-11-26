import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/* Status badges: a tinted pill with a short word. Colour never carries meaning alone. */
const success = "border-green-700/15 bg-green-100 text-green-800"
const warning = "border-marigold-600/25 bg-marigold-100 text-marigold-800"
const danger = "border-kumkum-700/15 bg-kumkum-100 text-kumkum-700"
const info = "border-peacock-700/15 bg-peacock-100 text-peacock-700"
const dark = "border-ink bg-ink text-white shadow-none theme-dark"
const neutral = "border-ink-200 bg-ivory-100 text-ink-700"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: neutral,
        primary: neutral,
        neutral,
        success,
        emerald: success,
        brand: "border-green-700/20 bg-brand text-on-brand",
        accent: "border-marigold-600/30 bg-marigold-500 text-ink",
        warning,
        amber: warning,
        danger,
        red: danger,
        destructive: danger,
        info,
        blue: info,
        dark,
        purple: dark,
        secondary: "border-white bg-white text-ink-700 shadow-clay-sm",
        outline: "border-ink-300 bg-transparent text-ink-700",
        ghost: "border-transparent bg-transparent text-ink-700 shadow-none",
        link: "border-transparent bg-transparent p-0 text-brand-text underline-offset-4 shadow-none hover:underline",
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
