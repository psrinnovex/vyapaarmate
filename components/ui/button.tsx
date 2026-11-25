import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-transparent text-sm font-bold tracking-[-0.01em] whitespace-nowrap outline-none transition-all focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "clay-press bg-clay-emerald text-white [--clay-shadow:rgba(8,128,74,0.6)] focus-visible:ring-emerald/25",
        primary: "clay-press bg-clay-emerald text-white [--clay-shadow:rgba(8,128,74,0.6)] focus-visible:ring-emerald/25",
        emerald: "clay-press bg-clay-emerald text-white [--clay-shadow:rgba(8,128,74,0.6)] focus-visible:ring-emerald/25",
        blue: "clay-press bg-clay-ocean text-white [--clay-shadow:rgba(48,57,168,0.6)] focus-visible:ring-ocean/25",
        purple: "clay-press bg-clay-violet text-white [--clay-shadow:rgba(82,54,214,0.6)] focus-visible:ring-violet/25",
        amber: "clay-press bg-clay-mango text-ink [--clay-shadow:rgba(220,128,0,0.55)] focus-visible:ring-mango/30",
        red: "clay-press bg-clay-berry text-white [--clay-shadow:rgba(209,51,95,0.55)] focus-visible:ring-berry/25",
        danger: "clay-press bg-clay-berry text-white [--clay-shadow:rgba(209,51,95,0.55)] focus-visible:ring-berry/25",
        destructive: "clay-press bg-clay-berry text-white [--clay-shadow:rgba(209,51,95,0.55)] focus-visible:ring-berry/25",
        dark: "clay-press bg-clay-ink text-white [--clay-shadow:rgba(13,10,34,0.6)] focus-visible:ring-ink/20",
        secondary: "clay-press border-white bg-white text-ink [--clay-shadow:rgba(55,41,130,0.35)] hover:bg-mist focus-visible:ring-violet/15",
        outline: "border-line bg-white/60 text-ink backdrop-blur hover:bg-white focus-visible:ring-violet/15",
        ghost: "bg-transparent text-ink hover:bg-white/70 focus-visible:ring-violet/15",
        neutral: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-500/15",
        link: "h-auto border-0 bg-transparent p-0 text-ocean underline-offset-4 shadow-none hover:underline focus-visible:ring-ocean/15",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-8 rounded-xl px-2.5 text-xs",
        sm: "h-9 rounded-xl px-3.5 text-xs",
        lg: "h-14 rounded-[1.35rem] px-7 text-base",
        icon: "size-11 p-0",
        "icon-xs": "size-7 rounded-lg p-0",
        "icon-sm": "size-9 rounded-xl p-0",
        "icon-lg": "size-14 rounded-[1.35rem] p-0",
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
