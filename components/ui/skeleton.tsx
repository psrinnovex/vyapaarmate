import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("skeleton-shimmer rounded-md", className)} {...props} />;
}

export function SkeletonText({
  lines = 3,
  className
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3",
            index === 0 && "w-full",
            index === lines - 1 ? "w-2/3" : "w-11/12"
          )}
        />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({
  tone = "light",
  action = true
}: {
  tone?: "light" | "dark";
  action?: boolean;
}) {
  const dark = tone === "dark";

  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <Skeleton className={cn("h-8 w-56", dark && "bg-white/20")} />
        <Skeleton className={cn("mt-3 h-4 w-full max-w-2xl", dark && "bg-white/15")} />
        <Skeleton className={cn("mt-2 h-4 w-full max-w-xl", dark && "bg-white/15")} />
      </div>
      {action && <Skeleton className={cn("h-10 w-44", dark && "bg-white/15")} />}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card className="min-h-[7.5rem] overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-3 h-4 w-36" />
        </div>
        <Skeleton className="size-11 shrink-0 rounded-lg" />
      </div>
    </Card>
  );
}

export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => <MetricCardSkeleton key={index} />)}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 6,
  minWidth = "720px"
}: {
  rows?: number;
  columns?: number;
  minWidth?: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="bg-mist">
            <tr>
              {Array.from({ length: columns }, (_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <td key={columnIndex} className="px-4 py-4">
                    <Skeleton className={cn("h-4", columnIndex === 0 ? "w-32" : "w-20")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function CardGridSkeleton({
  cards = 4,
  columns = "md:grid-cols-2 xl:grid-cols-4"
}: {
  cards?: number;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-4", columns)}>
      {Array.from({ length: cards }, (_, index) => (
        <Card key={index} className="min-h-44 bg-white">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-5 w-2/3" />
          <SkeletonText className="mt-4" lines={3} />
          <Skeleton className="mt-5 h-10 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  );
}

export function DashboardPageSkeleton({
  variant = "overview",
  tone = "light"
}: {
  variant?: "overview" | "orders" | "catalog" | "table" | "cards" | "reports" | "billing" | "settings";
  tone?: "light" | "dark";
}) {
  if (variant === "orders") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-3">
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-full" />)}
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, column) => (
            <Card key={column}>
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="mt-4 grid gap-3">
                {Array.from({ length: 3 }, (_, row) => (
                  <div key={row} className="rounded-lg border border-line bg-mist p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-7 w-20 rounded-full" />
                    </div>
                    <Skeleton className="mt-3 h-4 w-32" />
                    <Skeleton className="mt-2 h-4 w-44" />
                    <div className="mt-3 flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-7 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (variant === "catalog") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <Card>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-16 rounded-lg" />
            </div>
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
            </div>
          </Card>
          <CardGridSkeleton cards={4} columns="md:grid-cols-2" />
        </div>
      </>
    );
  }

  if (variant === "reports") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <MetricGridSkeleton />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="mt-6 flex h-64 items-end gap-3">
              {[90, 150, 118, 188, 132, 212].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="w-full rounded-t-lg" style={{ height }} />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Skeleton className="h-5 w-48" />
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (variant === "billing") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="bg-white/80">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-9 w-44" />
            <SkeletonText className="mt-4" lines={3} />
            <Skeleton className="mt-6 h-11 w-40 rounded-lg" />
          </Card>
          <Card>
            <Skeleton className="h-5 w-40" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="mt-4 h-12 rounded-lg" />
          </Card>
        </div>
        <Card className="mt-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-6 w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-lg" />)}
          </div>
        </Card>
      </>
    );
  }

  if (variant === "settings") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 3 }, (_, card) => (
            <Card key={card}>
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="mt-4 grid gap-4">
                {Array.from({ length: card === 2 ? 7 : 5 }, (_, row) => <Skeleton key={row} className="h-11 rounded-lg" />)}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (variant === "table") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <MetricGridSkeleton />
        <div className="mt-5">
          <TableSkeleton rows={7} columns={7} minWidth="940px" />
        </div>
      </>
    );
  }

  if (variant === "cards") {
    return (
      <>
        <PageHeaderSkeleton tone={tone} />
        <CardGridSkeleton cards={4} />
      </>
    );
  }

  return (
    <>
      <PageHeaderSkeleton tone={tone} />
      <MetricGridSkeleton />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid grid-cols-[90px_1fr_34px] items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 rounded-full" />
                <Skeleton className="h-4 w-7" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-14 rounded-lg" />)}
          </div>
        </Card>
      </div>
      <div className="mt-5">
        <TableSkeleton rows={5} columns={7} minWidth="720px" />
      </div>
    </>
  );
}

export function PublicHeaderSkeleton() {
  return (
    <div className="h-16">
      <nav className="fixed inset-x-0 top-0 z-40 w-full border-b border-line bg-white/95 px-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="hidden h-5 w-32 sm:block" />
          </div>
          <div className="hidden items-center gap-6 lg:flex">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-4 w-16" />)}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="hidden h-10 w-28 rounded-lg sm:block" />
          </div>
        </div>
      </nav>
    </div>
  );
}

export function BusinessesPageSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  return (
    <main className="min-h-screen bg-mist text-ink">
      {includeHeader && <PublicHeaderSkeleton />}
      <section className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="mt-4 h-9 w-full max-w-2xl" />
            <Skeleton className="mt-3 h-4 w-full max-w-3xl" />
            <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[330px]">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </section>
      <section className="border-b border-line bg-mist px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 w-28 rounded-lg" />
          <Skeleton className="h-11 w-40 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-md lg:col-span-3" />
        </div>
      </section>
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="flex h-full flex-col bg-white">
              <div className="flex items-start gap-4">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="mt-3 h-4 w-2/3" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-32 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <SkeletonText className="mt-5" lines={3} />
              <div className="mt-5 grid gap-3">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-3/4" />
              </div>
              <Skeleton className="mt-5 h-11 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

export function AuthPageSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-mesh-light px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Card className="bg-white/90 p-6 shadow-soft">
          <Skeleton className="h-7 w-40" />
          <SkeletonText className="mt-4" lines={2} />
          <Skeleton className="mt-5 h-12 rounded-lg" />
          <div className="mt-6 grid gap-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        </Card>
      </div>
    </main>
  );
}

export function PortalPageSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  return (
    <main className="min-h-screen bg-mist text-ink">
      {includeHeader && <PublicHeaderSkeleton />}
      <section className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="mt-4 h-9 w-64" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </section>
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <MetricGridSkeleton />
          <div className="mt-5">
            <TableSkeleton rows={6} columns={8} minWidth="980px" />
          </div>
        </div>
      </section>
    </main>
  );
}

export function PublicPageSkeleton() {
  return (
    <main className="min-h-screen bg-mist text-ink">
      <PublicHeaderSkeleton />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-10 w-full max-w-2xl" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
          <CardGridSkeleton cards={6} columns="sm:grid-cols-2 lg:grid-cols-3" />
        </div>
      </section>
    </main>
  );
}

export function StorefrontPageSkeleton() {
  return (
    <main className="min-h-screen bg-mesh-light text-ink">
      <section className="border-b border-line bg-white/90 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
            </div>
          </div>
          <Card className="bg-white">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-11 w-full rounded-lg" />
          </Card>
        </div>
      </section>
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit bg-white">
            <Skeleton className="h-5 w-28" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 rounded-lg" />)}
            </div>
          </Card>
          <div>
            <Skeleton className="h-11 rounded-lg" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Card key={index} className="bg-white">
                  <Skeleton className="aspect-[16/9] rounded-lg" />
                  <Skeleton className="mt-4 h-5 w-3/4" />
                  <SkeletonText className="mt-3" lines={2} />
                  <div className="mt-4 flex items-center justify-between">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-9 w-24 rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function OrderStatusPageSkeleton() {
  return (
    <main className="min-h-screen bg-mesh-light px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Card className="overflow-hidden bg-white/95 p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-3 h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-[260px_1fr]">
            <Skeleton className="aspect-square rounded-2xl" />
            <div>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-3 h-10 w-44" />
              <SkeletonText className="mt-5" lines={4} />
            </div>
          </div>
        </Card>
        <Card className="mt-5 bg-white/95 p-6">
          <Skeleton className="h-6 w-44" />
          <div className="mt-5 grid gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid gap-3">
                <Skeleton className="size-14 rounded-2xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
