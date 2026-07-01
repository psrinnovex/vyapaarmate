"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const defaultPageSize = 10;

function pageCountFor(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function clampPage(page: number, pageCount: number) {
  return Math.min(Math.max(1, page), pageCount);
}

type PaginationResetPage = "first" | "last" | number;

function resetPageFor(resetPage: PaginationResetPage | undefined, pageCount: number) {
  if (resetPage === "last") return pageCount;
  if (typeof resetPage === "number") return clampPage(resetPage, pageCount);
  return 1;
}

export function usePaginatedItems<T>(
  items: T[],
  options: { pageSize?: number; resetKey?: unknown; resetPage?: PaginationResetPage } = {}
) {
  const pageSize = options.pageSize ?? defaultPageSize;
  const [paginationState, setPaginationState] = useState({ page: 1, resetKey: options.resetKey });
  const pageCount = pageCountFor(items.length, pageSize);
  const requestedPage = Object.is(paginationState.resetKey, options.resetKey) ? paginationState.page : resetPageFor(options.resetPage, pageCount);
  const safePage = clampPage(requestedPage, pageCount);
  const startOffset = (safePage - 1) * pageSize;
  const endOffset = Math.min(startOffset + pageSize, items.length);

  const pageItems = useMemo(() => items.slice(startOffset, endOffset), [items, startOffset, endOffset]);

  return {
    page: safePage,
    pageCount,
    pageItems,
    pageSize,
    totalItems: items.length,
    startItem: items.length === 0 ? 0 : startOffset + 1,
    endItem: endOffset,
    setPage: (nextPage: number) => setPaginationState({ page: clampPage(nextPage, pageCount), resetKey: options.resetKey })
  };
}

export function PaginationControls({
  page,
  pageCount,
  totalItems,
  startItem,
  endItem,
  onPageChange,
  itemLabel = "items",
  className
}: {
  page: number;
  pageCount: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className={cn("flex flex-col gap-3 border-t border-line px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="font-semibold text-slate-500">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          title="Previous page"
          disabled={page <= 1}
          className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-ocean/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-24 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          aria-label="Next page"
          title="Next page"
          disabled={page >= pageCount}
          className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-ocean/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
