import Image from "next/image";
import { cn } from "@/lib/utils";

/** The supplied brand artwork, selected for the surface behind it. */
export function BrandMark({
  surface = "light",
  className
}: {
  surface?: "light" | "dark";
  className?: string;
}) {
  return (
    <Image
      src={`/brand/mark-on-${surface}.webp`}
      width={256}
      height={256}
      alt=""
      aria-hidden="true"
      unoptimized
      className={cn("size-10 shrink-0 object-contain", className)}
    />
  );
}
