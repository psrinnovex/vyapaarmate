import { ArrowRight, MessageCircle } from "lucide-react";
import { RocketIllustration } from "@/components/illustrations/clay-illustrations";
import { Parallax } from "@/components/motion/parallax";
import { ButtonLink } from "@/components/ui/button";
import { ScrollReveal } from "./scroll-reveal";

/** Closing call to action: a big clay panel with a rocket that lifts off as you scroll. */
export function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#12b76a_0%,#4f5bd5_55%,#7c5cff_100%)] px-6 py-12 text-white shadow-clay-lg sm:px-12 sm:py-16">
          <div aria-hidden="true" className="dotted-grid absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)]" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-16 size-72 rounded-full bg-white/10" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <h2 className="max-w-xl text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.045em]">Open your online shop today.</h2>
              <p className="mt-4 max-w-md text-base font-semibold text-white/80">Try the demo in a minute. Go live when you are ready.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  href="/demo"
                  size="lg"
                  variant="secondary"
                  icon={<ArrowRight className="size-5" />}
                  iconPosition="end"
                  data-marketing-event="cta_click"
                  data-marketing-location="home_final_cta"
                  data-marketing-label="try_demo"
                  data-marketing-destination="/demo"
                >
                  Try the live demo
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  variant="ghost"
                  className="text-white ring-1 ring-white/40 hover:bg-white/10"
                  icon={<MessageCircle className="size-5" />}
                  data-marketing-event="cta_click"
                  data-marketing-location="home_final_cta"
                  data-marketing-label="talk_to_pshr_innovex"
                  data-marketing-destination="/contact"
                >
                  Talk to us
                </ButtonLink>
              </div>
            </div>
            <Parallax speed={-0.45} rotate={8} className="mx-auto w-40 sm:w-52 md:w-full md:max-w-[15rem]">
              <RocketIllustration />
            </Parallax>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
