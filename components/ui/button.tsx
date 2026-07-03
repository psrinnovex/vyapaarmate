import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-black text-white shadow-sm hover:bg-black/90 focus-visible:ring-black/20",
        primary: "bg-black text-white shadow-sm hover:bg-black/90 focus-visible:ring-black/20",
        blue: "bg-black text-white shadow-sm hover:bg-black/90 focus-visible:ring-black/20",
        emerald: "bg-emerald text-white shadow-sm hover:bg-emerald/90 focus-visible:ring-emerald/20",
        purple: "bg-violet text-white shadow-sm hover:bg-violet/90 focus-visible:ring-violet/20",
        amber: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500/20",
        red: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600/20",
        danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600/20",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600/20",
        secondary: "border-line bg-white text-ink shadow-sm hover:bg-mist focus-visible:ring-ocean/15",
        outline: "border-line bg-transparent text-ink hover:bg-mist focus-visible:ring-ocean/15",
        ghost: "bg-transparent text-ink hover:bg-mist focus-visible:ring-ocean/15",
        neutral: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-500/15",
        link: "h-auto border-0 bg-transparent p-0 text-ocean underline-offset-4 shadow-none hover:underline focus-visible:ring-ocean/15",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-8 rounded-md px-2.5 text-xs",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "size-10 p-0",
        "icon-xs": "size-7 rounded-md p-0",
        "icon-sm": "size-8 rounded-md p-0",
        "icon-lg": "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonContentProps = {
  icon?: React.ReactNode
  iconPosition?: "start" | "end"
  children?: React.ReactNode
}

function ButtonContent({ icon, iconPosition = "start", children }: ButtonContentProps) {
  return (
    <>
      {icon && iconPosition === "start" && <span data-icon="inline-start">{icon}</span>}
      {children}
      {icon && iconPosition === "end" && <span data-icon="inline-end">{icon}</span>}
    </>
  )
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> &
  ButtonContentProps & {
    asChild?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  icon,
  iconPosition = "start",
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      <ButtonContent icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonContent>
    </Comp>
  )
}

type ButtonLinkProps = Omit<React.ComponentProps<typeof Link>, "className"> &
  VariantProps<typeof buttonVariants> &
  ButtonContentProps & {
    className?: string
  }

function ButtonLink({
  className,
  variant = "default",
  size = "default",
  icon,
  iconPosition = "start",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      <ButtonContent icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonContent>
    </Link>
  )
}

export { Button, ButtonLink, buttonVariants }
