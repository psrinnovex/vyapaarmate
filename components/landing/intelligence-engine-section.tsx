"use client";

import { motion } from "framer-motion";
import { Activity, ArrowRight, BrainCircuit, CreditCard, LineChart, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const modules = [
  {
    title: "Demand Prediction",
    body: "Predicts tomorrow's likely demand for top products or services based on past orders, day of week, time slot, and repeat trends.",
    Icon: LineChart,
    tone: "bg-ocean/10 text-ocean"
  },
  {
    title: "Repeat Customer Scoring",
    body: "Scores customers by last order date, frequency, spend value, product preference, and engagement history.",
    Icon: UsersRound,
    tone: "bg-emerald/10 text-emerald"
  },
  {
    title: "Smart Campaign Recommendation",
    body: "Suggests which opted-in customers to message, when to message, and what reminder or offer angle to use.",
    Icon: MessageCircle,
    tone: "bg-violet/10 text-violet"
  },
  {
    title: "Payment Follow-up Priority",
    body: "Flags pending UPI or checkout cases needing owner attention based on amount, delay, and repeat-customer value.",
    Icon: CreditCard,
    tone: "bg-amber-100 text-amber-800"
  },
  {
    title: "Business Health Score",
    body: "Shows sales trend, repeat rate, pending payment risk, inactive customers, top products, and owner action suggestions.",
    Icon: Activity,
    tone: "bg-slate-100 text-slate-800"
  }
];

export function IntelligenceEngineSection() {
  return (
    <section id="intelligence-engine" className="border-y border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="min-w-0 lg:sticky lg:top-24"
          >
            <Badge variant="emerald" className="gap-1.5">
              <BrainCircuit className="size-3.5" />
              VyapaarMate Intelligence Engine
            </Badge>
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
              AI-powered direct-commerce decision support for Indian MSMEs
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Our MSME intelligence engine studies daily orders, customer repeats, unpaid payments, product demand,
              booking patterns, and WhatsApp consent data to recommend the next best owner action.
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-line bg-mist p-4 text-sm leading-6 text-slate-600">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald" />
                Rule-based intelligence works without mandatory paid LLM APIs.
              </p>
              <p className="flex gap-2">
                <BrainCircuit className="mt-0.5 size-4 shrink-0 text-ocean" />
                Outputs are explainable, owner-friendly, and built around Indian local commerce workflows.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/technology-innovation" icon={<ArrowRight className="size-4" />} variant="primary">
                Technology & Innovation
              </ButtonLink>
              <ButtonLink href="/grant-readiness" variant="secondary">
                Grant Readiness
              </ButtonLink>
            </div>
          </motion.div>

          <div className="grid min-w-0 gap-4 md:auto-rows-fr md:grid-cols-2">
            {modules.map(({ title, body, Icon, tone }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.48, delay: index * 0.06, ease: "easeOut" }}
                className={cn(
                  "rounded-lg border border-line bg-[linear-gradient(135deg,#ffffff,rgba(245,248,251,0.92))] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
                  index === modules.length - 1
                    ? "min-h-[11rem] md:col-span-2 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-5"
                    : "min-h-[13rem]"
                )}
              >
                <div className={`grid size-12 place-items-center rounded-lg ${tone}`}>
                  <Icon className="size-6" />
                </div>
                <div className={cn(index === modules.length - 1 ? "mt-5 md:mt-0 md:max-w-2xl" : "mt-5")}>
                  <h3 className="text-lg font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
