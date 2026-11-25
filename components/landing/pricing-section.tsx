import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { pricingPlans } from "@/lib/constants";
import { launchMarket, launchOffer } from "@/lib/launch-policy";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/** Two clay plan cards; long policy text is reduced to one footnote line. */
export function PricingSection() {
  return (
    <section id="subscriptions" aria-labelledby="pricing-title" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="inline-flex rounded-full bg-mango-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-mango-deep">
          {launchOffer.publiclyAdvertised ? `${launchMarket.city} launch pricing` : "Pricing"}
        </p>
        <h2 id="pricing-title" className="mt-3 text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink">
          {launchOffer.publiclyAdvertised ? (
            <>
              <span className="text-gradient-brand">{launchOffer.discountPercent}% off</span> every month
            </>
          ) : (
            <>
              One flat price. <span className="text-gradient-brand">No surprises.</span>
            </>
          )}
        </h2>
      </ScrollReveal>

      <PlanCards className="mt-10" />
      <p className="mx-auto mt-6 max-w-3xl text-center text-xs font-semibold leading-5 text-slate-500">
        One-time setup {rupees(launchOffer.standardSetupFeeMinimum)} to {rupees(launchOffer.standardSetupFeeMaximum)}. Payment gateway, WhatsApp and other provider charges are separate.
        {launchOffer.publiclyAdvertised ? " Coupons do not stack with the launch discount." : ""}
      </p>
    </section>
  );
}

/**
 * The two clay plan cards. `detailed` (pricing page) shows every feature plus each plan's limits;
 * `location` keeps the marketing attribution for the page the cards sit on.
 */
export function PlanCards({
  className,
  detailed = false,
  location = "home_pricing"
}: {
  className?: string;
  detailed?: boolean;
  location?: string;
}) {
  return (
    <div className={cn("mx-auto grid max-w-4xl gap-5 md:grid-cols-2", className)}>
      {pricingPlans.map((plan, index) => {
        const pro = plan.id === "PRO";
        return (
          <ScrollReveal key={plan.id} delay={index * 90} className="h-full">
            <article
              className={cn(
                "relative flex h-full flex-col rounded-[2rem] p-6 sm:p-7",
                pro ? "bg-clay-ink text-white shadow-clay-lg" : "clay text-ink"
              )}
            >
              {pro && (
                <div className="absolute -top-3 right-6">
                  <Sticker tone="mango" tilt={5}>
                    Popular
                  </Sticker>
                </div>
              )}
              <h3 className="text-lg font-extrabold">{plan.name}</h3>
              <p className={cn("mt-1 text-sm font-semibold", pro ? "text-white/65" : "text-slate-500")}>{plan.bestFor}</p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-extrabold tracking-[-0.05em]">{rupees(plan.price)}</span>
                <span className={cn("pb-1.5 text-sm font-bold", pro ? "text-white/60" : "text-slate-500")}>/month + GST</span>
              </div>
              {launchOffer.publiclyAdvertised && (
                <p className={cn("mt-1 text-sm font-bold", pro ? "text-white/60" : "text-slate-500")}>
                  <span className="line-through">{rupees(plan.listPrice)}</span>
                  <span className="ml-2 text-emerald-300">{launchOffer.discountPercent}% off, applied automatically</span>
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-3">
                {(detailed ? plan.features : plan.features.slice(0, 5)).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm font-semibold">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", pro ? "bg-emerald text-white" : "bg-emerald-soft text-emerald-deep")}>
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className={pro ? "text-white/85" : "text-slate-600"}>{feature}</span>
                  </li>
                ))}
              </ul>
              {detailed && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {plan.limits.map((limit) => (
                    <span key={limit} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", pro ? "bg-white/10 text-white/75" : "bg-mist text-slate-600")}>
                      {limit}
                    </span>
                  ))}
                </div>
              )}
              <ButtonLink
                href={`/register?plan=${plan.id}`}
                size="lg"
                variant={pro ? "emerald" : "dark"}
                className="mt-7 w-full"
                icon={<ArrowRight className="size-5" />}
                iconPosition="end"
                data-marketing-event="cta_click"
                data-marketing-location={location}
                data-marketing-label={`register_${plan.id.toLowerCase()}`}
                data-marketing-destination={`/register?plan=${plan.id}`}
                data-marketing-value={plan.price}
              >
                Choose {plan.name}
              </ButtonLink>
            </article>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
