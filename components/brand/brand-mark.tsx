import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  surface?: "light" | "dark";
  className?: string;
  size?: number;
  priority?: boolean;
  decorative?: boolean;
};

/** Select contrast against the immediate surface, including mixed-theme pages. */
export function BrandMark({
  surface = "light",
  className,
  size = 40,
  priority = false,
  decorative = true
}: BrandMarkProps) {
  return (
    <Image
      src={`/brand/vyapaarmate-logo-${surface}.png`}
      alt={decorative ? "" : "VyapaarMate"}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
