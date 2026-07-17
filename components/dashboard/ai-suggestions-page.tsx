"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Gauge,
  IndianRupee,
  Info,
  LineChart,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BusinessIntelligencePayload, IntelligenceConfidence, PaymentPriorityResult } from "@/lib/business-intelligence";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

type PaymentSort = "priority" | "amount" | "overdue" | "repeat";

const chartColors = ["#1246a0", "#11a66a", "#6c3df4", "#f59e0b", "#0d1321", "#e11d48", "#0891b2", "#7c3aed"];

function confidenceVariant(confidence: IntelligenceConfidence) {
  if (confidence === "High") return "emerald";
  if (confidence === "Medium") return "amber";
  return "neutral";
}

function priorityVariant(priority: number) {
  if (priority >= 70) return "red";
  if (priority >= 45) return "amber";
  return "blue";
}

function slotLabel(slot: BusinessIntelligencePayload["tomorrowDemandForecast"][number]["timeSlot"]) {
  if (slot === "morning") return "Morning";
  if (slot === "afternoon") return "Afternoon";
  if (slot === "evening") return "Evening";
  return "Night";
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

function healthTone(label: string, value: number) {
  if (label === "Pending payment risk") return value <= 15 ? "emerald" : value <= 30 ? "amber" : "red";
  if (label === "Sales trend") return value >= 0 ? "emerald" : "red";
  if (value >= 70) return "emerald";
  if (value >= 45) return "amber";
  return "red";
}

function healthProgressValue(label: string, value: number) {
  if (label === "Sales trend") return Math.max(0, Math.min(100, 50 + value));
  if (label === "Pending payment risk") return Math.max(0, 100 - value);
  return Math.max(0, Math.min(100, value));
}

function trendIcon(direction: BusinessIntelligencePayload["topProductTrend"]["trendDirection"]) {
  if (direction === "up") return <ArrowUpRight className="size-4 text-emerald" />;
  if (direction === "down") return <ArrowDownRight className="size-4 text-red-600" />;
  return <TrendingUp className="size-4 text-ocean" />;
}

function sortPayments(payments: PaymentPriorityResult[], sort: PaymentSort) {
  return [...payments].sort((first, second) => {
    if (sort === "amount") return second.amountPending - first.amountPending;
    if (sort === "overdue") return second.daysOverdue - first.daysOverdue;
    if (sort === "repeat") return second.customerRepeatValue - first.customerRepeatValue;
    return second.priority - first.priority;
  });
}

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function engineLabel(type: NonNullable<BusinessIntelligencePayload["engine"]>["type"]) {
  if (type === "trained_ml") return "Trained ML";
  if (type === "hybrid_rules_plus_ml") return "Hybrid";
  return "Rules";
}

function modelLabel(modelType: NonNullable<BusinessIntelligencePayload["engine"]>["modelStatuses"][number]["modelType"]) {
  if (modelType === "demand") return "Demand";
  if (modelType === "retention") return "Retention";
  return "Payment";
}

function modelStatusVariant(status: NonNullable<BusinessIntelligencePayload["engine"]>["modelStatuses"][number]["status"]) {
  if (status === "trained") return "emerald";
  if (status === "ready_for_training" || status === "training") return "blue";
  if (status === "failed") return "red";
  if (status === "disabled") return "neutral";
  return "amber";
}

function EngineReadinessPanel({ engine }: { engine?: BusinessIntelligencePayload["engine"] }) {
  if (!engine) return null;

  return (
    <Card className="mb-4 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={engine.trainedModelInUse ? "emerald" : "amber"}>
              <BrainCircuit className="size-3" />
              {engineLabel(engine.type)}
            </Badge>
            <Badge variant="neutral">Rules</Badge>
            <Badge variant="neutral">First-party database</Badge>
            <Badge variant="neutral">Benchmarks isolated from production</Badge>
            <Badge variant="neutral">No synthetic production data</Badge>
          </div>
          <h2 className="mt-3 text-base font-bold text-ink">Model readiness</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {engine.type === "rules_engine"
              ? "No promoted ML model is active yet; rules/statistical recommendations remain active while data gates and shadow candidates are evaluated."
              : engine.type === "trained_ml"
                ? "All model families have trained first-party artifacts."
                : "Trained models are active where ready; rules/statistical recommendations fill the remaining gaps."}
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          {engine.modelStatuses.map((model) => (
            <div key={model.modelType} className="min-w-0 rounded-lg border border-line bg-mist/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">{modelLabel(model.modelType)}</p>
                <Badge variant={modelStatusVariant(model.status)}>{model.status.replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {model.lastTrainedAt
                  ? `${model.status === "shadow" ? "Shadow candidate" : "Trained"} ${formatGeneratedAt(model.lastTrainedAt)}`
                  : model.missingRequirements[0] ?? "Waiting for first-party history."}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

async function fetchAiSuggestions() {
  const response = await fetch("/api/dashboard/ai-suggestions", {
    cache: "no-store",
    credentials: "same-origin"
  });
  const payload = (await response.json().catch(() => ({}))) as BusinessIntelligencePayload & { error?: unknown };

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Could not load AI suggestions.");
  }

  return payload;
}

function AiPageSkeleton() {
  return (
    <>
      <PageHeader
        title="AI Suggestions"
        body="Demand forecasts, repeat-customer opportunities, payment priorities, health score, and next best owner actions."
        action={<Skeleton className="h-10 w-32 rounded-lg" />}
      />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <Skeleton className="h-5 w-52" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="mt-4 h-44 rounded-lg" />
        </Card>
        <Card className="p-4">
          <Skeleton className="h-5 w-48" />
          <SkeletonText className="mt-4" lines={3} />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-5 w-40" />
            <SkeletonText className="mt-4" lines={4} />
          </Card>
        ))}
      </div>
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-mist/80 p-4 text-sm leading-6 text-slate-600">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

function HealthFactorBar({ label, value, tone = "ocean" }: { label: string; value: number; tone?: "ocean" | "emerald" | "amber" | "red" }) {
  const colorClass =
    tone === "emerald"
      ? "[&_[data-slot='progress-indicator']]:bg-emerald"
      : tone === "amber"
        ? "[&_[data-slot='progress-indicator']]:bg-amber-500"
        : tone === "red"
          ? "[&_[data-slot='progress-indicator']]:bg-red-600"
          : "[&_[data-slot='progress-indicator']]:bg-ocean";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-slate-500">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} className={cn("h-2 bg-slate-100", colorClass)} />
    </div>
  );
}

export function AiSuggestionsPage() {
  const pathname = usePathname();
  const isProtected = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname === "/support" ||
      pathname.startsWith("/support/")
    );
  }, [pathname]);

  const [data, setData] = useState<BusinessIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [paymentSort, setPaymentSort] = useState<PaymentSort>("priority");
  const dataRef = useRef<BusinessIntelligencePayload | null>(null);

  const refreshData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const payload = await fetchAiSuggestions();
      dataRef.current = payload;
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load AI suggestions.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const events = new EventSource("/api/dashboard/ai-suggestions?stream=1");

    const handleReady = () => {
      if (cancelled) return;
      setConnected(true);
      setError(null);
    };

    const handlePayload = (event: Event) => {
      if (cancelled) return;
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as BusinessIntelligencePayload;
        dataRef.current = payload;
        setData(payload);
        setConnected(true);
        setError(null);
        setLoading(false);
      } catch {
        setError("Live database sync returned an invalid update.");
        setLoading(false);
      }
    };

    const handleSyncError = () => {
      if (cancelled) return;
      setConnected(false);
      if (!dataRef.current) {
        setError("Live database sync is retrying.");
        setLoading(false);
      }
    };

    events.addEventListener("live-ready", handleReady);
    events.addEventListener("ai-suggestions", handlePayload);
    events.addEventListener("sync-error", handleSyncError);
    events.onopen = handleReady;
    events.onerror = () => {
      if (cancelled) return;
      setConnected(false);
      if (!dataRef.current) {
        setError("Live database sync is reconnecting.");
        setLoading(false);
      }
    };

    return () => {
      cancelled = true;
      events.removeEventListener("live-ready", handleReady);
      events.removeEventListener("ai-suggestions", handlePayload);
      events.removeEventListener("sync-error", handleSyncError);
      events.close();
    };
  }, []);

  const sortedPayments = useMemo(() => sortPayments(data?.paymentPriorities ?? [], paymentSort), [data?.paymentPriorities, paymentSort]);
  const demandChartData = useMemo(
    () =>
      (data?.tomorrowDemandForecast ?? []).slice(0, 5).map((forecast) => ({
        name: forecast.productName.length > 14 ? `${forecast.productName.slice(0, 12)}...` : forecast.productName,
        slot: slotLabel(forecast.timeSlot),
        quantity: forecast.predictedQuantity,
        confidence: forecast.confidence
      })),
    [data?.tomorrowDemandForecast]
  );

  if (loading) return <AiPageSkeleton />;

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="AI Suggestions"
          body="Demand forecasts, repeat-customer opportunities, payment priorities, health score, and next best owner actions."
        />
        <Card className="border-red-200 bg-red-50 text-red-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="font-bold">Suggestions unavailable</h2>
                <p className="mt-1 text-sm leading-6">{error ?? "Could not load AI suggestions."}</p>
              </div>
            </div>
            <Button variant="red" icon={<RefreshCw className="size-4" />} onClick={() => void refreshData()}>
              Retry
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const health = data.businessHealthScore;

  return (
    <>
      <PageHeader
        title="AI Suggestions"
        body="Low-cost owner intelligence from orders, bookings, customers, payments, and catalog data."
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Badge variant={data.source === "demo" ? "amber" : "emerald"}>
              {data.source === "demo" ? "Demo fallback data" : "Live business data"}
            </Badge>
            <Badge variant={connected ? "blue" : "amber"}>{connected ? "Live sync on" : "Sync reconnecting"}</Badge>
            <Button className="w-full sm:w-auto" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void refreshData()}>
              Refresh
            </Button>
          </div>
        }
      />

      <EngineReadinessPanel engine={data.engine} />

      <Card className="mb-4 overflow-hidden border-ocean/15 bg-[linear-gradient(135deg,#f8fbff_0%,#eef7f2_54%,#ffffff_100%)] p-4 shadow-[0_18px_54px_rgba(13,19,33,0.08)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue">
                <BrainCircuit className="size-3" />
                VyapaarMate Intelligence Engine
              </Badge>
              <Badge variant="secondary">{data.dataWindow}</Badge>
              <Badge variant="neutral">No paid AI APIs</Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-bold leading-tight text-ink sm:text-2xl">
              {health.isPreliminary ? "Preliminary operational score" : "Operational health score"}: {health.score}/100.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              {health.explanation} Confidence is {health.confidence.toLowerCase()} from {health.observationCount} recorded transactions. Generated {formatGeneratedAt(data.generatedAt)} without paid AI API calls.
            </p>
          </div>
          <div className="grid min-h-24 min-w-24 place-items-center rounded-lg border border-ocean/15 bg-white p-4 text-center shadow-[0_14px_36px_rgba(18,70,160,0.10)]">
            <p className="text-4xl font-extrabold leading-none text-ink">{health.score}</p>
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">Grade {health.grade} · {health.confidence} confidence</p>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Card className="min-w-0 overflow-hidden p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="blue">Tomorrow by time slot</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Demand Forecast</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Weighted moving average by product, weekday, and booking or order time slot.</p>
            </div>
            <CalendarClock className="size-6 text-violet" />
          </div>

          {data.tomorrowDemandForecast.length ? (
            <>
              <div className="mt-4 grid gap-3">
                {data.tomorrowDemandForecast.slice(0, 3).map((forecast) => (
                  <div key={`${forecast.productName}-${forecast.timeSlot}-${forecast.forecastDate}`} className="rounded-lg border border-line bg-mist/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 font-bold text-ink">{forecast.productName}</p>
                          <Badge variant="neutral">{slotLabel(forecast.timeSlot)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{forecast.reason}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Weekday-slot avg {forecast.explainability.weekdaySlotAverage} · Recent-slot avg {forecast.explainability.recentSlotAverage} · Trend x{forecast.explainability.trendAdjustment}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={confidenceVariant(forecast.confidence)}>{forecast.confidence}</Badge>
                        <span className="text-xl font-extrabold text-ink">{forecast.predictedQuantity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-56 rounded-lg border border-line bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f1" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip cursor={{ fill: "#f5f8fb" }} formatter={(value, _name, item) => [value, `${item.payload.slot} forecast`]} />
                    <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
                      {demandChartData.map((_, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <EmptyState title="No demand forecast yet" body="Add a few days of orders to generate product-level demand forecasts." />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="emerald">Repeat customers</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Repeat Customer Opportunities</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{data.repeatCustomerOpportunities.summary}</p>
            </div>
            <Target className="size-6 text-emerald" />
          </div>
          <div className="mt-4 rounded-lg bg-mist/80 p-3">
            <p className="text-3xl font-extrabold text-ink">{data.repeatCustomerOpportunities.count}</p>
            <p className="mt-1 text-sm text-slate-600">{data.repeatCustomerOpportunities.eligibleCount} customers have marketing consent.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {data.repeatCustomerOpportunities.customers.length ? (
              data.repeatCustomerOpportunities.customers.slice(0, 4).map((customer) => (
                <div key={customer.customerId} className="rounded-lg border border-line bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{customer.customerName}</p>
                      <p className="truncate text-xs text-slate-500">{customer.preferredProducts.join(", ") || "No preference yet"}</p>
                    </div>
                    <Badge variant={customer.segment === "Reminder opportunity" ? "emerald" : "neutral"}>{customer.score}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-bold uppercase text-slate-500">
                    <span>R {customer.scoreBreakdown.recency}</span>
                    <span>F {customer.scoreBreakdown.frequency}</span>
                    <span>M {customer.scoreBreakdown.monetary}</span>
                    <span>C {customer.scoreBreakdown.engagement}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No repeat-customer data yet" body="Repeat opportunities appear after customers place orders and consent is recorded." />
            )}
          </div>
          {data.repeatCustomerOpportunities.eligibleCount > 0 ? (
            <ButtonLink href="/dashboard/campaigns?source=ai-suggestions&segment=repeat-opportunities" className="mt-4 w-full" variant="emerald" icon={<MessageCircle className="size-4" />}>
              Create WhatsApp Reminder
            </ButtonLink>
          ) : (
            <Button className="mt-4 w-full" variant="neutral" icon={<MessageCircle className="size-4" />} disabled>
              Add Consent Before Campaign
            </Button>
          )}
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="amber">Payment risk</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Payment Follow-up Priority</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Sorted by amount, delay, and repeat-customer value.</p>
            </div>
            <WalletCards className="size-6 text-amber-500" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["priority", "Priority"],
              ["amount", "Amount"],
              ["overdue", "Days overdue"],
              ["repeat", "Repeat value"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPaymentSort(id as PaymentSort)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald/60",
                  paymentSort === id ? "border-ocean bg-ocean text-white" : "border-line bg-white text-slate-600 hover:bg-mist"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {sortedPayments.length ? (
              sortedPayments.slice(0, 5).map((payment) => (
                <div key={payment.paymentId} className="rounded-lg border border-line bg-mist/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{payment.customerName}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {payment.daysOverdue} days overdue · repeat value {payment.customerRepeatValue}/25
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Amount {payment.priorityFactors.amount} · Delay {payment.priorityFactors.overdue} · Customer {payment.priorityFactors.customerValue}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-ink">{formatINR(payment.amountPending)}</p>
                      <Badge variant={priorityVariant(payment.priority)}>{payment.priority}/100</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{payment.suggestedMessage}</p>
                </div>
              ))
            ) : (
              <EmptyState title="No pending follow-up" body="Pending payment priorities will appear here when payments are overdue." />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="purple">Business health</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Business Health Score</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{health.explanation}</p>
            </div>
            <div className="grid size-16 place-items-center rounded-lg bg-ink text-white">
              <Gauge className="size-6" />
              <span className="-mt-1 text-sm font-extrabold">{health.score}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {health.factors.map((factor) => (
              <div key={factor.label}>
                <HealthFactorBar
                  label={factor.label === "Pending payment risk" ? "Payment safety" : factor.label}
                  value={healthProgressValue(factor.label, factor.value)}
                  tone={healthTone(factor.label, factor.value)}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{factor.explanation}</span>
                  <span className="font-bold text-ink">{factor.contribution}/{factor.weight} pts</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald/15 bg-emerald/5 p-3">
              <p className="font-bold text-emerald">Strengths</p>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                {health.strengths.slice(0, 3).map((strength) => (
                  <li key={strength} className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="font-bold text-amber-800">Risks</p>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                {(health.risks.length ? health.risks : ["No urgent risk flagged by current rules."]).slice(0, 3).map((risk) => (
                  <li key={risk} className="flex gap-2">
                    <AlertTriangle className="mt-1 size-4 shrink-0 text-amber-600" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <Badge variant="blue">
            <LineChart className="size-3" />
            Top product trend
          </Badge>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{data.topProductTrend.productName}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{data.topProductTrend.explanation}</p>
            </div>
            {trendIcon(data.topProductTrend.trendDirection)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-mist/80 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Units</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.unitsSold}</p>
            </div>
            <div className="rounded-lg bg-mist/80 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Repeat buyers</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.repeatBuyers}</p>
            </div>
            <div className="rounded-lg bg-mist/80 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Trend</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{formatSignedPercent(data.topProductTrend.changePercent)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <Badge variant="purple">
            <Megaphone className="size-3" />
            Smart campaigns
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">{data.campaignRecommendation.title}</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6">
            {data.campaignRecommendations.slice(0, 2).map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-line bg-mist/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{campaign.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{campaign.reason}</p>
                  </div>
                  <Badge variant={confidenceVariant(campaign.confidence)}>{campaign.confidence}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600">
                  <p>{campaign.audience}</p>
                  <p>{campaign.timing}</p>
                  <p className="rounded-md bg-white p-2 text-ink">{campaign.message}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="emerald">{campaign.eligibleCustomerCount} eligible</Badge>
                  <Badge variant={campaign.blockedCustomerCount ? "amber" : "neutral"}>{campaign.blockedCustomerCount} consent blocked</Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
            {data.campaignRecommendation.consentNote}
          </p>
          {data.campaignRecommendation.eligibleCustomerCount > 0 ? (
            <ButtonLink href="/dashboard/campaigns?source=ai-suggestions" className="mt-4 w-full" variant="purple" icon={<MessageCircle className="size-4" />}>
              {data.campaignRecommendation.whatsappActionLabel}
            </ButtonLink>
          ) : (
            <Button className="mt-4 w-full" variant="neutral" icon={<ShieldCheck className="size-4" />} disabled>
              Consent required
            </Button>
          )}
        </Card>

        <Card className="p-4">
          <Badge variant="emerald">
            <Sparkles className="size-3" />
            Next best actions
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">Owner Action Queue</h2>
          <div className="mt-4 grid gap-3">
            {data.nextBestActions.length ? (
              data.nextBestActions.map((action, index) => (
                <div key={`${action.title}-${index}`} className="rounded-lg border border-line bg-mist/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{action.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                    </div>
                    <Badge className="shrink-0" variant={action.priority === "High" ? "red" : action.priority === "Medium" ? "amber" : "neutral"}>{action.priority}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No action yet" body="Owner actions appear once enough orders, payments, and customer activity exist." />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-line bg-white p-4 text-sm leading-6 text-slate-600 shadow-[0_16px_48px_rgba(13,19,33,0.05)] lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="grid size-10 place-items-center rounded-lg bg-ocean/10 text-ocean">
          <Info className="size-5" />
        </div>
        <p>
          These are explainable decision-support suggestions from local rules and business data. They do not guarantee outcomes, and owners should verify stock, staff, pricing, and customer consent before acting.
        </p>
        {!isProtected && (
          <ButtonLink className="w-full sm:w-auto" href="/technology-innovation" variant="secondary" icon={<IndianRupee className="size-4" />}>
            See Technology
          </ButtonLink>
        )}
      </div>
    </>
  );
}
