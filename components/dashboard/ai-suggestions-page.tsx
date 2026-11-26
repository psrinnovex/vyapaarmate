"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Gauge,
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

const chartColors = ["#1ec926", "#0e7c86", "#f2a20c", "#0b0d0b", "#d8432e", "#7fe076", "#3fb2ba", "#8f5400"];

function confidenceVariant(confidence: IntelligenceConfidence) {
  if (confidence === "High") return "success";
  if (confidence === "Medium") return "warning";
  return "neutral";
}

function priorityVariant(priority: number) {
  if (priority >= 70) return "danger";
  if (priority >= 45) return "warning";
  return "info";
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

function healthTone(label: string, value: number): HealthTone {
  if (label === "Pending payment risk") return value <= 15 ? "green" : value <= 30 ? "marigold" : "kumkum";
  if (label === "Sales trend") return value >= 0 ? "green" : "kumkum";
  if (value >= 70) return "green";
  if (value >= 45) return "marigold";
  return "kumkum";
}

function healthProgressValue(label: string, value: number) {
  if (label === "Sales trend") return Math.max(0, Math.min(100, 50 + value));
  if (label === "Pending payment risk") return Math.max(0, 100 - value);
  return Math.max(0, Math.min(100, value));
}

function trendIcon(direction: BusinessIntelligencePayload["topProductTrend"]["trendDirection"]) {
  if (direction === "up") return <ArrowUpRight className="size-4 text-brand-text" />;
  if (direction === "down") return <ArrowDownRight className="size-4 text-kumkum-700" />;
  return <TrendingUp className="size-4 text-brand-text" />;
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
  if (status === "trained") return "success";
  if (status === "ready_for_training" || status === "training") return "info";
  if (status === "failed") return "danger";
  if (status === "disabled") return "neutral";
  return "warning";
}

function EngineReadinessPanel({ engine }: { engine?: BusinessIntelligencePayload["engine"] }) {
  if (!engine) return null;

  return (
    <Card className="mb-4 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={engine.trainedModelInUse ? "success" : "warning"}>
              <BrainCircuit className="size-3" />
              {engineLabel(engine.type)}
            </Badge>
            <Badge variant="neutral">Rules</Badge>
            <Badge variant="neutral">First-party database</Badge>
            <Badge variant="neutral">Benchmarks isolated from production</Badge>
            <Badge variant="neutral">No synthetic production data</Badge>
            <Badge variant="neutral">Review recommendations before acting</Badge>
          </div>
          <h2 className="mt-3 text-base font-bold text-ink">Model readiness</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-600">
            {engine.type === "rules_engine"
              ? "No promoted ML model is active yet; rules/statistical recommendations remain active while data gates and shadow candidates are evaluated."
              : engine.type === "trained_ml"
                ? "All model families have trained first-party artifacts."
                : "Trained models are active where ready; rules/statistical recommendations fill the remaining gaps."}
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          {engine.modelStatuses.map((model) => (
            <div key={model.modelType} className="min-w-0 rounded-2xl bg-ivory-100/80/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">{modelLabel(model.modelType)}</p>
                <Badge variant={modelStatusVariant(model.status)}>{model.status.replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-600">
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
    <div className="rounded-lg border border-dashed border-ink-200 bg-ivory-100/80 p-4 text-sm leading-6 text-ink-600">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

type HealthTone = "ink" | "green" | "marigold" | "kumkum";

function HealthFactorBar({ label, value, tone = "ink" }: { label: string; value: number; tone?: HealthTone }) {
  const colorClass =
    tone === "green"
      ? "[&_[data-slot='progress-indicator']]:bg-brand"
      : tone === "marigold"
        ? "[&_[data-slot='progress-indicator']]:bg-marigold-500"
        : tone === "kumkum"
          ? "[&_[data-slot='progress-indicator']]:bg-kumkum-600"
          : "[&_[data-slot='progress-indicator']]:bg-ink";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-ink-500">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} className={cn("h-2 bg-ink-100", colorClass)} />
    </div>
  );
}

export function AiSuggestionsPage() {
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
        <Card className="border-kumkum-600/20 bg-kumkum-50 text-kumkum-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="font-bold">Suggestions unavailable</h2>
                <p className="mt-1 text-sm leading-6">{error ?? "Could not load AI suggestions."}</p>
              </div>
            </div>
            <Button variant="danger" icon={<RefreshCw className="size-4" />} onClick={() => void refreshData()}>
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
            <Badge variant={data.source === "demo" ? "warning" : "success"}>
              {data.source === "demo" ? "Demo fallback data" : "Connected database"}
            </Badge>
            <Badge variant={connected ? "info" : "warning"}>{connected ? "Live sync on" : "Sync reconnecting"}</Badge>
            <Button className="w-full sm:w-auto" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void refreshData()}>
              Refresh
            </Button>
          </div>
        }
      />

      <EngineReadinessPanel engine={data.engine} />

      <section className="relative mb-4 overflow-hidden rounded-[2rem] vm-band p-5 text-white shadow-clay-lg sm:p-7">
        <div aria-hidden="true" className="vm-blob -right-16 -top-20 size-72 bg-brand opacity-25" />
        <div aria-hidden="true" className="vm-blob -bottom-24 left-1/4 size-72 bg-marigold-400 opacity-30" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">
                <BrainCircuit className="size-3.5" />
                VyapaarMate Intelligence Engine
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">{data.dataWindow}</span>
              <span className="rounded-full bg-brand/25 px-3 py-1 text-xs font-bold text-green-100">No paid AI APIs</span>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-extrabold leading-tight tracking-[-0.03em] sm:text-3xl">
              {health.isPreliminary ? "Preliminary operational score" : "Operational health score"}: {health.score}/100.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              {health.explanation} Confidence is {health.confidence.toLowerCase()} from {health.observationCount} recorded transactions. Generated {formatGeneratedAt(data.generatedAt)} without paid AI API calls.
            </p>
          </div>
          <div
            role="img"
            aria-label={`Health score ${health.score} out of 100, grade ${health.grade}`}
            className="relative mx-auto grid size-40 shrink-0 place-items-center rounded-full shadow-clay-lg sm:size-44"
            style={{ background: `conic-gradient(from 210deg, #1ec926 0deg, #119aa5 ${Math.max(0, Math.min(100, health.score)) * 3}deg, rgba(255,255,255,0.12) ${Math.max(0, Math.min(100, health.score)) * 3}deg 300deg, transparent 300deg)` }}
          >
            <div className="grid size-[7.6rem] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#f3eee2_60%,#e6dfcf_100%)] text-center text-ink shadow-clay-inset sm:size-[8.4rem]">
              <div>
                <p className="text-5xl font-extrabold leading-none tracking-[-0.05em]">{health.score}</p>
                <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-500">Grade {health.grade}</p>
                <p className="text-[11px] font-bold text-ink-500">{health.confidence} confidence</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Card className="min-w-0 overflow-hidden p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="info">Tomorrow by time slot</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Demand Forecast</h2>
              <p className="mt-1 text-sm leading-6 text-ink-600">Weighted moving average by product, weekday, and booking or order time slot.</p>
            </div>
            <CalendarClock className="size-6 text-peacock-600" />
          </div>

          {data.tomorrowDemandForecast.length ? (
            <>
              <div className="mt-4 grid gap-3">
                {data.tomorrowDemandForecast.slice(0, 3).map((forecast) => (
                  <div key={`${forecast.productName}-${forecast.timeSlot}-${forecast.forecastDate}`} className="rounded-2xl bg-ivory-100/80/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 font-bold text-ink">{forecast.productName}</p>
                          <Badge variant="neutral">{slotLabel(forecast.timeSlot)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-600">{forecast.reason}</p>
                        <p className="mt-2 text-xs font-semibold text-ink-500">
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
              <div className="mt-4 h-56 rounded-2xl border border-white/80 bg-white shadow-clay-sm p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6dfcf" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip cursor={{ fill: "#faf7f0" }} formatter={(value, _name, item) => [value, `${item.payload.slot} forecast`]} />
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
              <Badge variant="success">Repeat customers</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Repeat Customer Opportunities</h2>
              <p className="mt-1 text-sm leading-6 text-ink-600">{data.repeatCustomerOpportunities.summary}</p>
            </div>
            <Target className="size-6 text-brand-text" />
          </div>
          <div className="mt-4 rounded-2xl bg-ivory-100/80/80 p-3">
            <p className="text-3xl font-extrabold text-ink">{data.repeatCustomerOpportunities.count}</p>
            <p className="mt-1 text-sm text-ink-600">{data.repeatCustomerOpportunities.eligibleCount} customers have marketing consent.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {data.repeatCustomerOpportunities.customers.length ? (
              data.repeatCustomerOpportunities.customers.slice(0, 4).map((customer) => (
                <div key={customer.customerId} className="rounded-2xl border border-white/80 bg-white shadow-clay-sm p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{customer.customerName}</p>
                      <p className="truncate text-xs text-ink-500">{customer.preferredProducts.join(", ") || "No preference yet"}</p>
                    </div>
                    <Badge variant={customer.segment === "Reminder opportunity" ? "success" : "neutral"}>{customer.score}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-bold uppercase text-ink-500">
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
            <ButtonLink href="/dashboard/campaigns?source=ai-suggestions&segment=repeat-opportunities" className="mt-4 w-full" variant="brand" icon={<MessageCircle className="size-4" />}>
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
              <Badge variant="warning">Payment risk</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Payment Follow-up Priority</h2>
              <p className="mt-1 text-sm leading-6 text-ink-600">Sorted by amount, delay, and repeat-customer value.</p>
            </div>
            <WalletCards className="size-6 text-marigold-500" />
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
                  "h-9 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60",
                  paymentSort === id ? "border-ink bg-ink text-white theme-dark" : "border-ink-200 bg-white text-ink-600 hover:bg-ivory-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {sortedPayments.length ? (
              sortedPayments.slice(0, 5).map((payment) => (
                <div key={payment.paymentId} className="rounded-2xl bg-ivory-100/80/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{payment.customerName}</p>
                      <p className="mt-1 text-xs leading-5 text-ink-500">
                        {payment.daysOverdue} days overdue · repeat value {payment.customerRepeatValue}/25
                      </p>
                      <p className="mt-1 text-xs font-semibold text-ink-500">
                        Amount {payment.priorityFactors.amount} · Delay {payment.priorityFactors.overdue} · Customer {payment.priorityFactors.customerValue}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-ink">{formatINR(payment.amountPending)}</p>
                      <Badge variant={priorityVariant(payment.priority)}>{payment.priority}/100</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-ink-600">{payment.suggestedMessage}</p>
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
              <Badge variant="dark">Business health</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Business Health Score</h2>
              <p className="mt-1 text-sm leading-6 text-ink-600">{health.explanation}</p>
            </div>
            <div className="grid size-16 place-items-center rounded-lg bg-ink text-white theme-dark">
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
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
                  <span>{factor.explanation}</span>
                  <span className="font-bold text-ink">{factor.contribution}/{factor.weight} pts</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-brand/15 bg-brand/5 p-3">
              <p className="font-bold text-brand-text">Strengths</p>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink-600">
                {health.strengths.slice(0, 3).map((strength) => (
                  <li key={strength} className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-brand-text" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-marigold-500/30 bg-marigold-50 p-3">
              <p className="font-bold text-marigold-700">Risks</p>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink-600">
                {(health.risks.length ? health.risks : ["No urgent risk flagged by current rules."]).slice(0, 3).map((risk) => (
                  <li key={risk} className="flex gap-2">
                    <AlertTriangle className="mt-1 size-4 shrink-0 text-marigold-600" />
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
          <Badge variant="info">
            <LineChart className="size-3" />
            Top product trend
          </Badge>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{data.topProductTrend.productName}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">{data.topProductTrend.explanation}</p>
            </div>
            {trendIcon(data.topProductTrend.trendDirection)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-ivory-100/80/80 p-3">
              <p className="text-xs font-bold uppercase text-ink-500">Units</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.unitsSold}</p>
            </div>
            <div className="rounded-2xl bg-ivory-100/80/80 p-3">
              <p className="text-xs font-bold uppercase text-ink-500">Repeat buyers</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.repeatBuyers}</p>
            </div>
            <div className="rounded-2xl bg-ivory-100/80/80 p-3">
              <p className="text-xs font-bold uppercase text-ink-500">Trend</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{formatSignedPercent(data.topProductTrend.changePercent)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <Badge variant="dark">
            <Megaphone className="size-3" />
            Smart campaigns
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">{data.campaignRecommendation.title}</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6">
            {data.campaignRecommendations.slice(0, 2).map((campaign) => (
              <div key={campaign.id} className="rounded-2xl bg-ivory-100/80/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{campaign.title}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">{campaign.reason}</p>
                  </div>
                  <Badge variant={confidenceVariant(campaign.confidence)}>{campaign.confidence}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-ink-600">
                  <p>{campaign.audience}</p>
                  <p>{campaign.timing}</p>
                  <p className="rounded-md bg-white p-2 text-ink">{campaign.message}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="success">{campaign.eligibleCustomerCount} eligible</Badge>
                  <Badge variant={campaign.blockedCustomerCount ? "warning" : "neutral"}>{campaign.blockedCustomerCount} consent blocked</Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-marigold-500/30 bg-marigold-50 p-3 text-xs font-semibold leading-5 text-marigold-700">
            {data.campaignRecommendation.consentNote}
          </p>
          {data.campaignRecommendation.eligibleCustomerCount > 0 ? (
            <ButtonLink href="/dashboard/campaigns?source=ai-suggestions" className="mt-4 w-full" variant="dark" icon={<MessageCircle className="size-4" />}>
              {data.campaignRecommendation.whatsappActionLabel}
            </ButtonLink>
          ) : (
            <Button className="mt-4 w-full" variant="neutral" icon={<ShieldCheck className="size-4" />} disabled>
              Consent required
            </Button>
          )}
        </Card>

        <Card className="p-4">
          <Badge variant="success">
            <Sparkles className="size-3" />
            Next best actions
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">Owner Action Queue</h2>
          <div className="mt-4 grid gap-3">
            {data.nextBestActions.length ? (
              data.nextBestActions.map((action, index) => (
                <div key={`${action.title}-${index}`} className="rounded-2xl bg-ivory-100/80/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{action.title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-600">{action.description}</p>
                    </div>
                    <Badge className="shrink-0" variant={action.priority === "High" ? "danger" : action.priority === "Medium" ? "warning" : "neutral"}>{action.priority}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No action yet" body="Owner actions appear once enough orders, payments, and customer activity exist." />
            )}
          </div>
        </Card>
      </div>

    </>
  );
}
