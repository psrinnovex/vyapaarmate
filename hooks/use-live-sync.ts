"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getEmptyAdminPayload,
  type LiveAdminPayload,
  type LiveDashboardPayload
} from "@/lib/live-types";

type LiveInitialState<T> = {
  payload: T;
  isComplete: boolean;
};

const AdminLiveInitialContext = createContext<LiveInitialState<LiveAdminPayload> | null>(null);
const DashboardLiveRuntimeContext = createContext<LiveResourceState<LiveDashboardPayload> | null>(null);

export function DashboardLiveProvider({
  initialPayload,
  initialPayloadIsComplete = true,
  children
}: {
  initialPayload: LiveDashboardPayload;
  initialPayloadIsComplete?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const scope = dashboardLiveScope(pathname);
  const live = useLiveResource<LiveDashboardPayload>({
    eventName: "dashboard",
    url: `/api/dashboard/live?scope=${encodeURIComponent(scope)}`,
    getInitialPayload: () => initialPayload,
    hasInitialPayload: true,
    skipInitialStreamPayload: initialPayloadIsComplete
  });

  return createElement(DashboardLiveRuntimeContext.Provider, { value: live }, children);
}

export function AdminLiveProvider({
  initialPayload,
  initialPayloadIsComplete = true,
  children
}: {
  initialPayload: LiveAdminPayload;
  initialPayloadIsComplete?: boolean;
  children: ReactNode;
}) {
  return createElement(AdminLiveInitialContext.Provider, { value: { payload: initialPayload, isComplete: initialPayloadIsComplete } }, children);
}

type LiveResourceOptions<T> = {
  eventName: string;
  url: string;
  getInitialPayload: () => T;
  hasInitialPayload?: boolean;
  skipInitialStreamPayload?: boolean;
};

type StreamRefreshOptions = {
  url: string;
  eventName: string;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
};

type LiveResourceState<T> = {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  connected: boolean;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

function dashboardLiveScope(pathname: string | null) {
  if (!pathname || pathname === "/dashboard") return "overview";
  if (pathname.startsWith("/dashboard/orders")) return "orders";
  if (pathname.startsWith("/dashboard/menu")) return "menu";
  if (pathname.startsWith("/dashboard/payments")) return "payments";
  if (pathname.startsWith("/dashboard/customers")) return "customers";
  if (pathname.startsWith("/dashboard/coupons")) return "coupons";
  if (pathname.startsWith("/dashboard/campaigns")) return "campaigns";
  if (pathname.startsWith("/dashboard/staff")) return "staff";
  if (pathname.startsWith("/dashboard/invoices")) return "invoices";
  if (pathname.startsWith("/dashboard/reports")) return "reports";
  if (pathname.startsWith("/dashboard/setup")) return "billing";
  if (pathname.startsWith("/dashboard/billing")) return "billing";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "full";
}

function useLiveResource<T>({
  eventName,
  url,
  getInitialPayload,
  hasInitialPayload = false,
  skipInitialStreamPayload = hasInitialPayload
}: LiveResourceOptions<T>): LiveResourceState<T> {
  const shouldWaitForPayload = !hasInitialPayload || !skipInitialStreamPayload;
  const [data, setData] = useState<T>(getInitialPayload);
  const [connected, setConnected] = useState(hasInitialPayload);
  const [error, setError] = useState<string | null>(null);
  const [completeUrl, setCompleteUrl] = useState(shouldWaitForPayload ? "" : url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loading = shouldWaitForPayload && completeUrl !== url && failedUrl !== url;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Refresh failed with ${response.status}`);
      setData(await response.json());
      setError(null);
      setCompleteUrl(url);
      setFailedUrl(null);
    } catch {
      setError("Connection is reconnecting");
      setFailedUrl(url);
    }
  }, [url]);

  useEffect(() => {
    const streamUrl = `${url}${url.includes("?") ? "&" : "?"}stream=1${skipInitialStreamPayload ? "&skipInitial=1" : ""}`;
    const events = new EventSource(streamUrl);
    const handleReady = () => {
      setConnected(true);
      setError(null);
    };
    const handleMessage = (event: Event) => {
      const message = event as MessageEvent<string>;
      try {
        setData(JSON.parse(message.data) as T);
        setConnected(true);
        setError(null);
        setCompleteUrl(url);
        setFailedUrl(null);
      } catch {
        setError("Connection received an invalid update");
        setFailedUrl(url);
      }
    };

    events.addEventListener("live-ready", handleReady);
    events.addEventListener(eventName, handleMessage);
    events.addEventListener("sync-error", () => {
      setError("Connection is retrying");
      setFailedUrl(url);
    });
    events.onopen = () => setConnected(true);
    events.onerror = () => {
      setConnected(false);
      setError("Connection is reconnecting");
    };

    const fallback = setInterval(refresh, 60000);

    return () => {
      clearInterval(fallback);
      events.removeEventListener("live-ready", handleReady);
      events.removeEventListener(eventName, handleMessage);
      events.close();
    };
  }, [eventName, refresh, skipInitialStreamPayload, url]);

  useEffect(() => {
    if (!shouldWaitForPayload) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, shouldWaitForPayload]);

  return { data, setData, connected, error, loading, refresh };
}

export function useDashboardLive() {
  const live = useContext(DashboardLiveRuntimeContext);

  if (!live) {
    throw new Error("useDashboardLive must be used inside DashboardLiveProvider.");
  }

  return live;
}

export function useDashboardOrderAlertLive() {
  const pathname = usePathname();
  const dashboardLive = useDashboardLive();
  const alertLive = useLiveResource<LiveDashboardPayload>({
    eventName: "dashboard",
    url: "/api/dashboard/live?scope=orders",
    getInitialPayload: () => dashboardLive.data,
    hasInitialPayload: true,
    skipInitialStreamPayload: false
  });

  return dashboardLiveScope(pathname) === "orders" ? dashboardLive : alertLive;
}

export function useAdminLive() {
  const initialState = useContext(AdminLiveInitialContext);

  return useLiveResource<LiveAdminPayload>({
    eventName: "admin",
    url: "/api/admin/live",
    getInitialPayload: () => initialState?.payload ?? getEmptyAdminPayload(),
    hasInitialPayload: Boolean(initialState),
    skipInitialStreamPayload: initialState?.isComplete ?? false
  });
}

export function useStreamRefresh({ url, eventName, onRefresh, enabled = true }: StreamRefreshOptions) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const streamUrl = `${url}${url.includes("?") ? "&" : "?"}stream=1&skipInitial=1`;
    const events = new EventSource(streamUrl);
    let queued = false;

    const handleRefresh = () => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        void refreshRef.current();
      }, 150);
    };

    events.addEventListener(eventName, handleRefresh);
    return () => {
      events.removeEventListener(eventName, handleRefresh);
      events.close();
    };
  }, [enabled, eventName, url]);
}

export function useRouteRefreshOnStream(url: string, eventName: string, enabled = true) {
  const router = useRouter();

  useStreamRefresh({
    url,
    eventName,
    enabled,
    onRefresh: () => router.refresh()
  });
}
