"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import { Card, GlassPanel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

type PaymentSort = "priority" | "amount" | "overdue" | "repeat";

const chartColors = ["#1246a0", "#11a66a", "#6c3df4", "#f59e0b", "#0d1321", "#e11d48", "#0891b2", "#7c3aed"];
const sectionMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" }
} as const;

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
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="min-h-80">
          <Skeleton className="h-5 w-52" />
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="mt-6 h-48 rounded-lg" />
        </Card>
        <Card className="min-h-80">
          <Skeleton className="h-5 w-48" />
          <SkeletonText className="mt-5" lines={4} />
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <Skeleton className="h-5 w-40" />
            <SkeletonText className="mt-5" lines={5} />
          </Card>
        ))}
      </div>
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-mist p-5 text-sm leading-6 text-slate-600">
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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.source === "demo" ? "amber" : "emerald"}>
              {data.source === "demo" ? "Demo fallback data" : "Live business data"}
            </Badge>
            <Badge variant={connected ? "blue" : "amber"}>{connected ? "Live sync on" : "Sync reconnecting"}</Badge>
            <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void refreshData()}>
              Refresh
            </Button>
          </div>
        }
      />

      <motion.div {...sectionMotion}>
        <GlassPanel className="mb-5 overflow-hidden border border-white bg-[linear-gradient(135deg,rgba(13,19,33,0.96),rgba(18,70,160,0.88)_48%,rgba(17,166,106,0.78))] text-white">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  <BrainCircuit className="size-3" />
                  VyapaarMate Intelligence Engine
                </Badge>
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  {data.dataWindow}
                </Badge>
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  No paid AI APIs
                </Badge>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-bold leading-tight sm:text-3xl">
                {data.business.name} has a {health.score}/100 business health score.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
                {health.explanation} Generated {formatGeneratedAt(data.generatedAt)} without paid AI API calls.
              </p>
            </div>
            <div className="grid size-28 place-items-center rounded-lg border border-white/15 bg-white/10 text-center shadow-glow">
              <p className="text-4xl font-extrabold">{health.score}</p>
              <p className="text-xs font-bold uppercase text-white/70">Grade {health.grade}</p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <motion.div {...sectionMotion} transition={{ ...sectionMotion.transition, delay: 0.05 }} className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="min-w-0 overflow-hidden bg-white">
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
              <div className="mt-5 grid gap-3">
                {data.tomorrowDemandForecast.slice(0, 3).map((forecast) => (
                  <div key={`${forecast.productName}-${forecast.timeSlot}-${forecast.forecastDate}`} className="rounded-lg border border-line bg-mist p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{forecast.productName}</p>
                          <Badge variant="neutral">{slotLabel(forecast.timeSlot)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{forecast.reason}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Weekday-slot avg {forecast.explainability.weekdaySlotAverage} · Recent-slot avg {forecast.explainability.recentSlotAverage} · Trend x{forecast.explainability.trendAdjustment}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={confidenceVariant(forecast.confidence)}>{forecast.confidence}</Badge>
                        <span className="text-xl font-extrabold text-ink">{forecast.predictedQuantity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 h-64 rounded-lg border border-line bg-white p-3">
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
            <div className="mt-5">
              <EmptyState title="No demand forecast yet" body="Add a few days of orders to generate product-level demand forecasts." />
            </div>
          )}
        </Card>

        <Card className="bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="emerald">Repeat customers</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Repeat Customer Opportunities</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{data.repeatCustomerOpportunities.summary}</p>
            </div>
            <Target className="size-6 text-emerald" />
          </div>
          <div className="mt-5 rounded-lg bg-mist p-4">
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
            <ButtonLink href="/dashboard/campaigns?source=ai-suggestions&segment=repeat-opportunities" className="mt-5 w-full" variant="emerald" icon={<MessageCircle className="size-4" />}>
              Create WhatsApp Reminder
            </ButtonLink>
          ) : (
            <Button className="mt-5 w-full" variant="neutral" icon={<MessageCircle className="size-4" />} disabled>
              Add Consent Before Campaign
            </Button>
          )}
        </Card>
      </motion.div>

      <motion.div {...sectionMotion} transition={{ ...sectionMotion.transition, delay: 0.1 }} className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-white">
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
                  "h-9 rounded-lg border px-3 text-xs font-bold transition",
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
                <div key={payment.paymentId} className="rounded-lg border border-line bg-mist p-4">
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

        <Card className="bg-white">
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
          <div className="mt-5 grid gap-4">
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
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-emerald/5 p-4">
              <p className="font-bold text-emerald">Strengths</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                {health.strengths.slice(0, 3).map((strength) => (
                  <li key={strength} className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="font-bold text-amber-800">Risks</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
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
      </motion.div>

      <motion.div {...sectionMotion} transition={{ ...sectionMotion.transition, delay: 0.15 }} className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="bg-white">
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
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Units</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.unitsSold}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Repeat buyers</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{data.topProductTrend.repeatBuyers}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Trend</p>
              <p className="mt-2 text-xl font-extrabold text-ink">{formatSignedPercent(data.topProductTrend.changePercent)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white">
          <Badge variant="purple">
            <Megaphone className="size-3" />
            Smart campaigns
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">{data.campaignRecommendation.title}</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6">
            {data.campaignRecommendations.slice(0, 2).map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-line bg-mist p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
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

        <Card className="bg-white">
          <Badge variant="emerald">
            <Sparkles className="size-3" />
            Next best actions
          </Badge>
          <h2 className="mt-4 text-xl font-bold text-ink">Owner Action Queue</h2>
          <div className="mt-4 grid gap-3">
            {data.nextBestActions.length ? (
              data.nextBestActions.map((action, index) => (
                <div key={`${action.title}-${index}`} className="rounded-lg border border-line bg-mist p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{action.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                    </div>
                    <Badge variant={action.priority === "High" ? "red" : action.priority === "Medium" ? "amber" : "neutral"}>{action.priority}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No action yet" body="Owner actions appear once enough orders, payments, and customer activity exist." />
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div {...sectionMotion} transition={{ ...sectionMotion.transition, delay: 0.2 }} className="mt-5 grid gap-4 rounded-lg border border-line bg-white p-5 text-sm leading-6 text-slate-600 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="grid size-12 place-items-center rounded-lg bg-ocean/10 text-ocean">
          <Info className="size-5" />
        </div>
        <p>
          These are explainable decision-support suggestions from local rules and business data. They do not guarantee outcomes, and owners should verify stock, staff, pricing, and customer consent before acting.
        </p>
        <ButtonLink href="/technology-innovation" variant="secondary" icon={<IndianRupee className="size-4" />}>
          See Technology
        </ButtonLink>
      </motion.div>
    </>
  );
}
