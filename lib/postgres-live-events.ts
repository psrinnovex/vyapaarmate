import { Client, type ClientConfig } from "pg";

export type LiveChangeOperation = "INSERT" | "UPDATE" | "DELETE";

export type LiveChangePayload = {
  table: string;
  operation: LiveChangeOperation;
  businessId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  orderId?: string | null;
  publicToken?: string | null;
  ticketId?: string | null;
  userId?: string | null;
  global?: boolean;
  occurredAt?: string;
};

type LiveChangeListener = (payload: LiveChangePayload) => void;

const channelName = "bhojzo_live_changes";
const reconnectDelayMs = 2500;
const globalForLiveEvents = globalThis as typeof globalThis & {
  bhojzoLiveEvents?: {
    client: Client | null;
    connecting: Promise<void> | null;
    listeners: Set<LiveChangeListener>;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
  };
};

const state = globalForLiveEvents.bhojzoLiveEvents ?? {
  client: null,
  connecting: null,
  listeners: new Set<LiveChangeListener>(),
  reconnectTimer: null
};

globalForLiveEvents.bhojzoLiveEvents = state;

function notificationDatabaseUrl() {
  return process.env.LIVE_DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
}

function canUseNotificationConnection(url: string) {
  if (!url) return false;
  if (process.env.LIVE_DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim()) return true;

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("pgbouncer") !== "true";
  } catch {
    return !url.includes("pgbouncer=true");
  }
}

function notificationClientConfig(connectionString: string): ClientConfig {
  const config: ClientConfig = {
    connectionString,
    application_name: "bhojzo-live-events"
  };

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode");
    if (sslMode && sslMode !== "disable") {
      parsed.searchParams.delete("sslmode");
      config.connectionString = parsed.toString();
      config.ssl = { rejectUnauthorized: shouldRejectUnauthorizedLiveDatabaseSsl() };
    }
  } catch {
    if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(connectionString)) {
      config.ssl = { rejectUnauthorized: shouldRejectUnauthorizedLiveDatabaseSsl() };
    }
  }

  return config;
}

function shouldRejectUnauthorizedLiveDatabaseSsl() {
  const value = process.env.LIVE_DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function parsePayload(payload: string | undefined) {
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<LiveChangePayload>;
    if (typeof parsed.table !== "string" || typeof parsed.operation !== "string") return null;
    if (!["INSERT", "UPDATE", "DELETE"].includes(parsed.operation)) return null;
    return parsed as LiveChangePayload;
  } catch {
    return null;
  }
}

function scheduleReconnect() {
  if (state.reconnectTimer || state.listeners.size === 0) return;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    void ensureConnection();
  }, reconnectDelayMs);
}

async function closeConnection() {
  const existing = state.client;
  state.client = null;
  state.connecting = null;
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  if (existing) {
    await existing.end().catch(() => undefined);
  }
}

async function ensureConnection() {
  if (state.client || state.connecting || state.listeners.size === 0) return;

  const connectionString = notificationDatabaseUrl();
  if (!canUseNotificationConnection(connectionString)) return;

  state.connecting = (async () => {
    const client = new Client(notificationClientConfig(connectionString));

    client.on("notification", (message) => {
      if (message.channel !== channelName) return;
      const payload = parsePayload(message.payload);
      if (!payload) return;
      state.listeners.forEach((listener) => listener(payload));
    });

    client.on("error", () => {
      if (state.client === client) state.client = null;
      scheduleReconnect();
    });

    client.on("end", () => {
      if (state.client === client) state.client = null;
      scheduleReconnect();
    });

    await client.connect();
    await client.query(`LISTEN ${channelName}`);
    state.client = client;
  })();

  try {
    await state.connecting;
  } catch {
    scheduleReconnect();
  } finally {
    state.connecting = null;
  }
}

export function subscribeToLiveChanges(listener: LiveChangeListener) {
  state.listeners.add(listener);
  void ensureConnection();

  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0) {
      void closeConnection();
    }
  };
}
