import { createHash } from "node:crypto";
import { safeLog } from "@/lib/security/safe-logger";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: "memory" | "redis" | "redis-unavailable";
};

const buckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, source: "memory" };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt, source: "memory" };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt, source: "memory" };
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

function rateLimitStorageKey(key: string) {
  return `rl:${createHash("sha256").update(key).digest("hex")}`;
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const config = redisConfig();
  if (!config) return memoryRateLimit(key, limit, windowMs);

  const now = Date.now();
  const storageKey = rateLimitStorageKey(key);
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", storageKey],
      ["PEXPIRE", storageKey, windowMs, "NX"]
    ]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit request failed with ${response.status}.`);
  }

  const result = (await response.json()) as Array<{ result?: unknown }>;
  const count = Number(result?.[0]?.result);
  if (!Number.isFinite(count)) {
    throw new Error("Redis rate limit response did not include a counter.");
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + windowMs,
    source: "redis"
  };
}

export async function rateLimit(key: string, limit = 10, windowMs = 60_000): Promise<RateLimitResult> {
  if (!redisConfig()) return memoryRateLimit(key, limit, windowMs);

  try {
    return await redisRateLimit(key, limit, windowMs);
  } catch (error) {
    safeLog("error", "Distributed rate limiter unavailable", { error });
    if (process.env.RATE_LIMIT_FAIL_OPEN === "true") {
      return memoryRateLimit(key, limit, windowMs);
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + windowMs,
      source: "redis-unavailable"
    };
  }
}

export function getClientIp(request: Request) {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) return vercelForwarded.split(",")[0]?.trim() || "local";

  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
