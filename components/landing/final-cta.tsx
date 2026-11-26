import { ArrowRight, MessageCircle } from "lucide-react";
import { RocketIllustration } from "@/components/illustrations/clay-illustrations";
import { Parallax } from "@/components/motion/parallax";
import { ButtonLink } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { ScrollReveal } from "./scroll-reveal";

/** Closing call to action: a logo-green shopfront under a striped awning, rocket lifting off as you scroll. */
export function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand text-ink shadow-clay-lg">
          <div aria-hidden="true" className="vm-awning relative z-10 [--awning-a:#12a51a] [--awning-size:1.5rem]" />
          <div aria-hidden="true" className="absolute inset-0 opacity-70 [background-image:var(--vm-grain)]" />
          <div aria-hidden="true" className="absolute -bottom-28 -right-20 size-80 rounded-full bg-white/15" />
          <div className="relative grid items-center gap-8 px-6 pb-12 pt-6 sm:px-12 sm:pb-16 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <Sticker tone="ink" tilt={-3}>Free demo · no card</Sticker>
              <h2 className="mt-5 max-w-xl text-[clamp(2rem,5vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.04em] text-ink">Open your online shop today.</h2>
              <p className="mt-4 max-w-md text-base font-semibold text-ink/75">Try the demo in a minute. Go live when you are ready.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  href="/demo"
                  size="lg"
                  variant="dark"
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
                  variant="secondary"
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
