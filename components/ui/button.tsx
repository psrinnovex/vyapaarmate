import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Marigold Bazaar buttons: a solid face on a darker lip that squashes 3px when pressed.
 * brand = logo green with black text; dark = logo black; accent = marigold (offers only).
 * Legacy colour names (default/primary/emerald/blue/purple/amber/red/destructive) are aliases.
 */
const lipPress = "active:translate-y-[3px] motion-reduce:active:translate-y-0"
const brand = `bg-brand text-on-brand shadow-lip-brand hover:bg-green-400 active:shadow-[0_1px_0_#0b7a10] ${lipPress}`
const dark = `bg-ink text-white shadow-lip-ink hover:bg-ink-800 active:shadow-[0_1px_0_#000] ${lipPress} theme-dark`
const accent = `bg-marigold-500 text-ink shadow-lip-accent hover:bg-marigold-400 active:shadow-[0_1px_0_#d08300] ${lipPress}`
const info = `bg-peacock-600 text-white shadow-[0_4px_0_#0a5f67] hover:bg-peacock-700 active:shadow-[0_1px_0_#0a5f67] ${lipPress}`
const danger = `bg-kumkum-700 text-white shadow-lip-danger hover:bg-kumkum-800 active:shadow-[0_1px_0_#7d2012] ${lipPress}`

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-semibold tracking-[-0.01em] whitespace-nowrap outline-none transition-[transform,box-shadow,background-color,color] duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        brand,
        default: brand,
        primary: brand,
        emerald: brand,
        dark,
        blue: dark,
        purple: dark,
        accent,
        amber: accent,
        info,
        danger,
        red: danger,
        destructive: danger,
        secondary: `border-ink-200/70 bg-white text-ink shadow-[0_4px_0_#d3cab6,0_10px_18px_-12px_rgba(84,58,18,0.3)] hover:bg-ivory-50 active:shadow-[0_1px_0_#d3cab6] ${lipPress}`,
        outline: "border-ink-300/80 bg-white/70 text-ink backdrop-blur hover:border-ink hover:bg-white",
        ghost: "bg-transparent text-ink hover:bg-ivory-100",
        neutral: "bg-ivory-100 text-ink-700 hover:bg-ink-200",
        link: "h-auto border-0 bg-transparent p-0 font-bold text-brand-text underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-8 rounded-md px-2.5 text-xs",
        sm: "h-9 rounded-md px-3.5 text-[13px]",
        lg: "h-14 rounded-[1.125rem] px-7 text-base",
        icon: "size-11 p-0",
        "icon-xs": "size-7 rounded-sm p-0",
        "icon-sm": "size-9 rounded-md p-0",
        "icon-lg": "size-14 rounded-[1.125rem] p-0",
      },
    },
    defaultVariants: {
      variant: "brand",
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
  variant = "brand",
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
  variant = "brand",
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
