"use client";

/**
 * VyapaarMate clay illustrations.
 *
 * Hand-built SVG in a soft 3D "clay" style: rounded shapes, top-left light, gradient
 * shading, a gloss highlight and a blurred ground shadow. They are pure SVG (no WebGL,
 * no images), so they stay sharp at any size and cost almost nothing on budget phones.
 *
 * Every illustration takes `className` for sizing and an optional `title`; without a
 * title it is decorative and hidden from screen readers.
 */
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "violet" | "mango" | "berry" | "ocean" | "sky" | "cream" | "steel" | "ink" | "leaf" | "brown";

const palette: Record<Tone, [string, string, string]> = {
  emerald: ["#7ef0bd", "#12b76a", "#08804a"],
  violet: ["#cbbcff", "#7c5cff", "#5236d6"],
  mango: ["#ffe7a3", "#ffad1f", "#dc8000"],
  berry: ["#ffbdd0", "#ff5c8a", "#d1335f"],
  ocean: ["#c0c6ff", "#4f5bd5", "#3039a8"],
  sky: ["#b8e9ff", "#33b5f5", "#0a7fb8"],
  cream: ["#ffffff", "#f4f1fc", "#d6cfec"],
  steel: ["#ffffff", "#d3dbea", "#8f9bb4"],
  ink: ["#5a548f", "#2d2858", "#1a1735"],
  leaf: ["#b6f27a", "#4cc35a", "#22803a"],
  brown: ["#f3c58b", "#c9843e", "#8d5420"]
};

const tones = Object.keys(palette) as Tone[];

export type IllustrationProps = {
  className?: string;
  title?: string;
};

function useClayPrefix() {
  return `vm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Shared gradients and filters, defined once per SVG under a unique prefix. */
function ClayDefs({ p }: { p: string }) {
  return (
    <defs>
      {tones.map((tone) => {
        const [light, base, dark] = palette[tone];
        return (
          <g key={tone}>
            <linearGradient id={`${p}-${tone}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor={light} />
              <stop offset="0.5" stopColor={base} />
              <stop offset="1" stopColor={dark} />
            </linearGradient>
            <radialGradient id={`${p}-${tone}-r`} cx="0.34" cy="0.3" r="0.78">
              <stop offset="0" stopColor={light} />
              <stop offset="0.55" stopColor={base} />
              <stop offset="1" stopColor={dark} />
            </radialGradient>
          </g>
        );
      })}
      <radialGradient id={`${p}-gloss`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <filter id={`${p}-blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id={`${p}-soft`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
    </defs>
  );
}

function Frame({
  p,
  viewBox,
  className,
  title,
  children
}: {
  p: string;
  viewBox: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={cn("h-auto w-full select-none", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <ClayDefs p={p} />
      {children}
    </svg>
  );
}

const fill = (p: string, tone: Tone, radial = false) => `url(#${p}-${tone}${radial ? "-r" : ""})`;

function GroundShadow({ p, cx, cy, rx, ry = 10, opacity = 0.22 }: { p: string; cx: number; cy: number; rx: number; ry?: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#2a2152" opacity={opacity} filter={`url(#${p}-blur)`} />;
}

function Gloss({ p, cx, cy, rx, ry, opacity = 0.75 }: { p: string; cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${p}-gloss)`} opacity={opacity} />;
}

function Sparkle({ x, y, size = 10, color = "#ffffff" }: { x: number; y: number; size?: number; color?: string }) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s} C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`}
      fill={color}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

export function ShopIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  const stripes = [0, 1, 2, 3, 4, 5, 6];
  return (
    <Frame p={p} viewBox="0 0 320 300" className={className} title={title}>
      <GroundShadow p={p} cx={160} cy={272} rx={128} ry={14} />
      {/* building */}
      <rect x="44" y="96" width="232" height="170" rx="26" fill={fill(p, "cream")} />
      <rect x="44" y="236" width="232" height="30" rx="15" fill="#e6e0f6" opacity="0.7" />
      {/* sign board */}
      <rect x="60" y="40" width="200" height="56" rx="22" fill={fill(p, "emerald")} />
      <Gloss p={p} cx={120} cy={54} rx={54} ry={10} opacity={0.55} />
      <rect x="132" y="56" width="56" height="24" rx="12" fill="#ffffff" />
      <path d="M152 63h16M150 69h20M155 75h10" stroke="#12b76a" strokeWidth="3.2" strokeLinecap="round" />
      {/* awning */}
      <g>
        {stripes.map((i) => (
          <rect key={`s-${i}`} x={40 + i * 34.3} y="92" width="34.3" height="40" fill={i % 2 === 0 ? fill(p, "berry") : "#ffe3ec"} />
        ))}
        {stripes.map((i) => (
          <circle key={`c-${i}`} cx={57.15 + i * 34.3} cy="132" r="17.15" fill={i % 2 === 0 ? fill(p, "berry") : "#ffd3e1"} />
        ))}
        <rect x="40" y="88" width="240" height="10" rx="5" fill={fill(p, "berry")} />
      </g>
      {/* window */}
      <rect x="64" y="160" width="112" height="82" rx="18" fill={fill(p, "sky")} />
      <path d="M78 228 L120 172" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" opacity="0.38" />
      <path d="M100 236 L140 184" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.28" />
      {/* counter items: bowl + plant */}
      <ellipse cx="104" cy="232" rx="22" ry="8" fill="#0a6c9a" opacity="0.25" />
      <path d="M84 222 Q104 246 124 222 Z" fill={fill(p, "mango")} />
      <ellipse cx="104" cy="222" rx="20" ry="6" fill="#fff3d0" />
      <circle cx="98" cy="219" r="3" fill="#12b76a" />
      <circle cx="108" cy="218" r="2.6" fill="#ff5c8a" />
      <rect x="140" y="214" width="20" height="20" rx="6" fill={fill(p, "mango")} />
      <ellipse cx="146" cy="204" rx="7" ry="13" fill={fill(p, "leaf")} transform="rotate(-24 146 204)" />
      <ellipse cx="155" cy="203" rx="7" ry="13" fill={fill(p, "leaf")} transform="rotate(22 155 203)" />
      {/* door */}
      <rect x="192" y="158" width="64" height="108" rx="20" fill={fill(p, "violet")} />
      <rect x="202" y="170" width="44" height="40" rx="12" fill="#ffffff" opacity="0.22" />
      <circle cx="244" cy="222" r="5" fill={fill(p, "mango", true)} />
      {/* open tag */}
      <path d="M210 150 L224 136 L238 150" stroke="#8f86b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="204" y="148" width="40" height="22" rx="8" fill={fill(p, "mango")} />
      <circle cx="224" cy="159" r="3.5" fill="#ffffff" />
      <Gloss p={p} cx={110} cy={110} rx={70} ry={14} opacity={0.35} />
      <Sparkle x={290} y={70} size={10} color="#ffad1f" />
      <Sparkle x={28} y={124} size={7} color="#7c5cff" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Phone with WhatsApp-style chat                                      */
/* ------------------------------------------------------------------ */

export function PhoneChatIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 280" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={260} rx={80} ry={11} />
      <rect x="58" y="22" width="124" height="232" rx="30" fill={fill(p, "ink")} />
      <rect x="66" y="34" width="108" height="208" rx="22" fill="#f6f4ff" />
      <rect x="100" y="40" width="40" height="8" rx="4" fill="#2d2858" />
      {/* incoming bubble */}
      <rect x="74" y="62" width="70" height="30" rx="12" fill="#ffffff" />
      <rect x="82" y="72" width="44" height="5" rx="2.5" fill="#cdc9e0" />
      <rect x="82" y="81" width="28" height="5" rx="2.5" fill="#cdc9e0" />
      {/* outgoing order card */}
      <rect x="86" y="100" width="80" height="62" rx="14" fill={fill(p, "emerald")} />
      <circle cx="104" cy="120" r="9" fill="#ffffff" opacity="0.95" />
      <path d="M99.5 120.5 L103 124 L109 116.5" stroke="#12b76a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="118" y="114" width="38" height="5" rx="2.5" fill="#ffffff" opacity="0.9" />
      <rect x="118" y="123" width="26" height="5" rx="2.5" fill="#ffffff" opacity="0.65" />
      <rect x="96" y="140" width="60" height="12" rx="6" fill="#ffffff" opacity="0.28" />
      {/* second incoming */}
      <rect x="74" y="172" width="58" height="26" rx="12" fill="#ffffff" />
      <rect x="82" y="181" width="36" height="5" rx="2.5" fill="#cdc9e0" />
      {/* input bar */}
      <rect x="74" y="214" width="92" height="18" rx="9" fill="#ffffff" />
      <circle cx="157" cy="223" r="6" fill={fill(p, "emerald", true)} />
      <Gloss p={p} cx={92} cy={44} rx={22} ry={8} opacity={0.35} />
      {/* floating chat badge */}
      <g>
        <circle cx="186" cy="64" r="26" fill={fill(p, "emerald", true)} />
        <path d="M174 76 l4 -9 a14 14 0 1 1 6 5 z" fill="#ffffff" />
        <Gloss p={p} cx={180} cy={52} rx={12} ry={6} opacity={0.7} />
      </g>
      <g>
        <circle cx="50" cy="150" r="17" fill={fill(p, "berry", true)} />
        <path d="M43 149 c0 -6 7 -8 7 -2 c0 -6 7 -4 7 2 c0 5 -7 9 -7 9 s-7 -4 -7 -9z" fill="#ffffff" />
      </g>
      <Sparkle x={206} y={140} size={8} color="#ffad1f" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* UPI QR + coins                                                      */
/* ------------------------------------------------------------------ */

export function UpiQrIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  const cells = [
    [0, 0], [1, 0], [3, 0], [5, 1], [2, 1], [4, 2], [0, 3], [2, 3], [3, 3], [5, 3], [1, 4], [4, 4], [2, 5], [5, 5], [3, 2]
  ];
  return (
    <Frame p={p} viewBox="0 0 260 260" className={className} title={title}>
      <GroundShadow p={p} cx={128} cy={238} rx={96} ry={12} />
      <g transform="rotate(-8 112 120)">
        <rect x="40" y="30" width="144" height="176" rx="28" fill={fill(p, "cream")} />
        <rect x="58" y="48" width="108" height="108" rx="18" fill="#ffffff" stroke="#e8e4f5" strokeWidth="2" />
        {/* finder squares */}
        {[
          [66, 56],
          [134, 56],
          [66, 124]
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="24" height="24" rx="7" fill="#1d1a39" />
            <rect x={x + 6} y={y + 6} width="12" height="12" rx="3" fill="#ffffff" />
          </g>
        ))}
        {cells.map(([cx, cy]) => (
          <rect key={`${cx}-${cy}`} x={96 + cx * 7.5} y={90 + cy * 7.5} width="6" height="6" rx="1.6" fill="#1d1a39" />
        ))}
        <rect x="74" y="168" width="76" height="22" rx="11" fill={fill(p, "violet")} />
        <path d="M90 179h44" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </g>
      {/* coins */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx="196" cy={212 - i * 15} rx="38" ry="13" fill="#c97300" />
          <ellipse cx="196" cy={206 - i * 15} rx="38" ry="13" fill={fill(p, "mango")} />
        </g>
      ))}
      <ellipse cx="196" cy="176" rx="38" ry="13" fill={fill(p, "mango", true)} />
      <text x="196" y="182" textAnchor="middle" fontSize="17" fontWeight="800" fill="#b45f00" fontFamily="system-ui, sans-serif">₹</text>
      <circle cx="214" cy="112" r="20" fill={fill(p, "mango", true)} />
      <text x="214" y="119" textAnchor="middle" fontSize="18" fontWeight="800" fill="#b45f00" fontFamily="system-ui, sans-serif">₹</text>
      <Gloss p={p} cx={208} cy={104} rx={9} ry={5} opacity={0.85} />
      <Sparkle x={228} y={60} size={9} color="#12b76a" />
      <Sparkle x={30} y={64} size={7} color="#ff5c8a" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Steel tiffin box                                                    */
/* ------------------------------------------------------------------ */

export function TiffinIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  const tiers = [0, 1, 2];
  return (
    <Frame p={p} viewBox="0 0 240 260" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={238} rx={78} ry={11} />
      {/* handle */}
      <path d="M78 74 C78 28 162 28 162 74" stroke={fill(p, "steel")} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M78 74 C78 30 162 30 162 74" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
      {tiers.map((i) => {
        const y = 72 + i * 52;
        return (
          <g key={i}>
            <rect x="54" y={y} width="132" height="50" rx="20" fill={fill(p, "steel")} />
            <rect x="54" y={y + 40} width="132" height="10" rx="5" fill="#8f9bb4" opacity="0.35" />
            <rect x="62" y={y + 8} width="116" height="8" rx="4" fill="#ffffff" opacity="0.7" />
            <rect x="46" y={y + 18} width="12" height="18" rx="5" fill={fill(p, "mango")} />
            <rect x="182" y={y + 18} width="12" height="18" rx="5" fill={fill(p, "mango")} />
          </g>
        );
      })}
      <rect x="60" y="62" width="120" height="16" rx="8" fill={fill(p, "steel")} />
      <Gloss p={p} cx={92} cy={92} rx={26} ry={9} opacity={0.6} />
      {/* steam */}
      <path d="M100 52 c-8 -10 8 -14 0 -26" stroke="#c8bfe6" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M124 48 c-8 -10 8 -14 0 -26" stroke="#c8bfe6" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.6" />
      <Sparkle x={200} y={56} size={8} color="#ffad1f" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Food bowl (biryani / meals)                                         */
/* ------------------------------------------------------------------ */

export function BowlIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 220" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={198} rx={86} ry={11} />
      {/* food mound */}
      <ellipse cx="120" cy="108" rx="78" ry="34" fill={fill(p, "mango", true)} />
      <circle cx="94" cy="96" r="9" fill={fill(p, "berry", true)} />
      <circle cx="146" cy="92" r="8" fill={fill(p, "leaf", true)} />
      <circle cx="124" cy="84" r="7" fill={fill(p, "brown", true)} />
      <circle cx="108" cy="110" r="5" fill="#ffffff" opacity="0.9" />
      <circle cx="160" cy="108" r="5" fill="#ffffff" opacity="0.8" />
      <ellipse cx="74" cy="102" rx="10" ry="5" fill={fill(p, "leaf")} transform="rotate(-20 74 102)" />
      {/* bowl */}
      <path d="M34 112 Q36 196 120 196 Q204 196 206 112 Z" fill={fill(p, "berry")} />
      <ellipse cx="120" cy="112" rx="86" ry="14" fill="#ffd5e2" />
      <ellipse cx="120" cy="112" rx="78" ry="10" fill={fill(p, "mango")} />
      <path d="M52 132 Q66 178 112 184" stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.35" />
      {/* steam */}
      <path d="M92 64 c-8 -10 8 -14 0 -26" stroke="#c8bfe6" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M120 58 c-8 -10 8 -14 0 -26" stroke="#c8bfe6" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.65" />
      <path d="M148 64 c-8 -10 8 -14 0 -26" stroke="#c8bfe6" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.5" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Cake (home bakers)                                                  */
/* ------------------------------------------------------------------ */

export function CakeIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={216} rx={84} ry={11} />
      <ellipse cx="120" cy="204" rx="86" ry="14" fill={fill(p, "cream")} />
      <rect x="48" y="132" width="144" height="70" rx="24" fill={fill(p, "brown")} />
      <path d="M48 150 Q60 166 72 150 T96 150 T120 150 T144 150 T168 150 T192 150 L192 140 Q192 128 180 128 L60 128 Q48 128 48 140 Z" fill={fill(p, "berry")} />
      <rect x="72" y="80" width="96" height="56" rx="20" fill={fill(p, "brown")} />
      <path d="M72 96 Q82 110 92 96 T112 96 T132 96 T152 96 T168 96 L168 90 Q168 78 156 78 L84 78 Q72 78 72 90 Z" fill={fill(p, "cream")} />
      <circle cx="120" cy="66" r="13" fill={fill(p, "berry", true)} />
      <path d="M120 54 q6 -14 18 -16" stroke="#22803a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Gloss p={p} cx={116} cy={62} rx={5} ry={3} opacity={0.9} />
      <circle cx="80" cy="170" r="4" fill="#fff3d0" />
      <circle cx="120" cy="176" r="4" fill="#fff3d0" />
      <circle cx="160" cy="170" r="4" fill="#fff3d0" />
      <Sparkle x={200} y={74} size={9} color="#ffad1f" />
      <Sparkle x={38} y={100} size={7} color="#7c5cff" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Juice glass                                                         */
/* ------------------------------------------------------------------ */

export function JuiceIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 260" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={238} rx={62} ry={10} />
      <path d="M134 22 L150 22 L128 96" stroke={fill(p, "berry")} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 70 L170 70 L156 222 Q154 232 144 232 L96 232 Q86 232 84 222 Z" fill="#ffffff" opacity="0.65" />
      <path d="M76 100 L164 100 L156 218 Q154 226 146 226 L94 226 Q86 226 84 218 Z" fill={fill(p, "mango")} />
      <ellipse cx="120" cy="100" rx="44" ry="8" fill="#ffd27a" />
      <path d="M84 118 L92 210" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.4" />
      <circle cx="104" cy="150" r="5" fill="#ffffff" opacity="0.7" />
      <circle cx="132" cy="176" r="4" fill="#ffffff" opacity="0.6" />
      <circle cx="122" cy="132" r="3" fill="#ffffff" opacity="0.6" />
      {/* orange slice */}
      <circle cx="170" cy="76" r="26" fill={fill(p, "mango", true)} />
      <circle cx="170" cy="76" r="19" fill="#ffe7a3" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        // Rounded so server and browser produce identical path strings (no hydration mismatch).
        <path key={a} d={`M170 76 L${(170 + 18 * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(76 + 18 * Math.sin((a * Math.PI) / 180)).toFixed(2)}`} stroke="#ffad1f" strokeWidth="2.5" />
      ))}
      <ellipse cx="70" cy="70" rx="12" ry="20" fill={fill(p, "leaf")} transform="rotate(-30 70 70)" />
      <Sparkle x={42} y={140} size={8} color="#12b76a" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Salon scissors + comb                                               */
/* ------------------------------------------------------------------ */

export function SalonIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={218} rx={84} ry={11} />
      {/* comb */}
      <g transform="rotate(-18 120 150)">
        <rect x="40" y="150" width="160" height="30" rx="12" fill={fill(p, "violet")} />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={50 + i * 12.5} y="176" width="7" height="26" rx="3.5" fill={fill(p, "violet")} />
        ))}
        <rect x="48" y="154" width="140" height="6" rx="3" fill="#ffffff" opacity="0.4" />
      </g>
      {/* scissors */}
      <g transform="rotate(28 120 100)">
        <path d="M118 108 L98 22 Q96 12 104 14 L130 96 Z" fill={fill(p, "steel")} />
        <path d="M122 108 L142 22 Q144 12 136 14 L110 96 Z" fill={fill(p, "steel")} />
        <circle cx="120" cy="100" r="6" fill={fill(p, "ink", true)} />
        <circle cx="98" cy="138" r="22" fill="none" stroke={fill(p, "berry")} strokeWidth="12" />
        <circle cx="142" cy="138" r="22" fill="none" stroke={fill(p, "berry")} strokeWidth="12" />
        <path d="M108 114 L102 120" stroke={fill(p, "berry")} strokeWidth="12" strokeLinecap="round" />
        <path d="M132 114 L138 120" stroke={fill(p, "berry")} strokeWidth="12" strokeLinecap="round" />
      </g>
      <Sparkle x={196} y={48} size={10} color="#ffad1f" />
      <Sparkle x={44} y={64} size={7} color="#33b5f5" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Grocery basket                                                      */
/* ------------------------------------------------------------------ */

export function GroceryIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 230" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={208} rx={86} ry={11} />
      <path d="M70 104 Q120 30 170 104" stroke={fill(p, "brown")} strokeWidth="10" fill="none" strokeLinecap="round" />
      {/* produce */}
      <ellipse cx="92" cy="98" rx="14" ry="30" fill={fill(p, "mango")} transform="rotate(-22 92 98)" />
      <path d="M84 66 l-6 -12 M86 66 l2 -14" stroke="#22803a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="128" cy="96" r="24" fill={fill(p, "berry", true)} />
      <path d="M128 72 q4 -10 12 -12" stroke="#22803a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="160" cy="104" r="20" fill={fill(p, "leaf", true)} />
      <Gloss p={p} cx={120} cy={86} rx={8} ry={5} opacity={0.85} />
      {/* basket */}
      <path d="M40 110 L200 110 L182 196 Q180 204 170 204 L70 204 Q60 204 58 196 Z" fill={fill(p, "brown")} />
      <rect x="34" y="104" width="172" height="20" rx="10" fill={fill(p, "brown")} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${78 + i * 28} 132 L${82 + i * 26} 194`} stroke="#8d5420" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      ))}
      <path d="M58 156 L182 156" stroke="#8d5420" strokeWidth="4" opacity="0.3" />
      <rect x="42" y="108" width="150" height="5" rx="2.5" fill="#ffffff" opacity="0.4" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Growth chart                                                        */
/* ------------------------------------------------------------------ */

export function ChartIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  const bars: Array<[number, number, Tone]> = [
    [62, 70, "violet"],
    [106, 104, "ocean"],
    [150, 140, "emerald"]
  ];
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={216} rx={92} ry={11} />
      <rect x="30" y="186" width="180" height="26" rx="13" fill={fill(p, "cream")} />
      {bars.map(([x, h, tone]) => (
        <g key={x}>
          <rect x={x} y={192 - h} width="34" height={h} rx="12" fill={fill(p, tone)} />
          <rect x={x + 6} y={198 - h} width="8" height={h - 20} rx="4" fill="#ffffff" opacity="0.3" />
        </g>
      ))}
      <path d="M44 128 L94 98 L132 110 L192 50" stroke={fill(p, "mango")} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M170 44 L198 44 L198 72" stroke={fill(p, "mango")} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={210} y={110} size={9} color="#ff5c8a" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Happy customers                                                     */
/* ------------------------------------------------------------------ */

export function CustomersIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 260 230" className={className} title={title}>
      <GroundShadow p={p} cx={130} cy={210} rx={104} ry={11} />
      {/* person 1 */}
      <path d="M40 206 Q40 140 96 140 Q152 140 152 206 Z" fill={fill(p, "sky")} />
      <circle cx="96" cy="108" r="30" fill={fill(p, "brown", true)} />
      <path d="M68 100 Q72 70 100 74 Q126 76 126 100 Q112 86 90 90 Q76 92 68 100Z" fill="#2d2858" />
      {/* person 2 */}
      <path d="M118 206 Q118 150 168 150 Q218 150 218 206 Z" fill={fill(p, "berry")} />
      <circle cx="168" cy="122" r="27" fill={fill(p, "mango", true)} />
      <path d="M142 118 Q140 88 170 90 Q198 92 194 120 Q188 102 168 104 Q152 106 142 118Z" fill="#5a3410" />
      {/* heart bubble */}
      <circle cx="206" cy="58" r="26" fill={fill(p, "berry", true)} />
      <path d="M194 56 c0 -8 10 -10 12 -2 c2 -8 12 -6 12 2 c0 8 -12 14 -12 14 s-12 -6 -12 -14z" fill="#ffffff" />
      <Gloss p={p} cx={198} cy={46} rx={10} ry={5} opacity={0.75} />
      <circle cx="44" cy="62" r="14" fill={fill(p, "mango", true)} />
      <path d="M39 62 l4 4 l7 -8" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={140} y={44} size={8} color="#7c5cff" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Notification bell                                                   */
/* ------------------------------------------------------------------ */

export function BellIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={218} rx={70} ry={10} />
      <circle cx="120" cy="184" r="16" fill={fill(p, "mango", true)} />
      <path d="M58 168 Q72 150 72 116 Q72 62 120 58 Q168 62 168 116 Q168 150 182 168 Z" fill={fill(p, "mango")} />
      <rect x="50" y="160" width="140" height="22" rx="11" fill={fill(p, "mango")} />
      <circle cx="120" cy="52" r="10" fill={fill(p, "mango", true)} />
      <path d="M88 82 Q96 70 110 68" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.5" />
      <circle cx="170" cy="70" r="22" fill={fill(p, "berry", true)} />
      <text x="170" y="78" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">1</text>
      <path d="M36 96 Q28 116 36 136" stroke="#c8bfe6" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M204 104 Q212 124 204 144" stroke="#c8bfe6" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar with check                                                 */
/* ------------------------------------------------------------------ */

export function CalendarIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={218} rx={86} ry={11} />
      <rect x="38" y="48" width="164" height="160" rx="28" fill={fill(p, "cream")} />
      <path d="M38 76 Q38 48 66 48 L174 48 Q202 48 202 76 L202 92 L38 92 Z" fill={fill(p, "violet")} />
      <rect x="72" y="30" width="14" height="36" rx="7" fill={fill(p, "ink")} />
      <rect x="154" y="30" width="14" height="36" rx="7" fill={fill(p, "ink")} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={58 + c * 34} y={108 + r * 28} width="22" height="16" rx="6" fill={r === 1 && c === 2 ? "#ffad1f" : "#e8e4f5"} />
        ))
      )}
      <circle cx="184" cy="184" r="30" fill={fill(p, "emerald", true)} />
      <path d="M170 184 L180 194 L198 174" stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Gloss p={p} cx={176} cy={170} rx={12} ry={6} opacity={0.7} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Empty box                                                           */
/* ------------------------------------------------------------------ */

export function EmptyBoxIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 220" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={198} rx={86} ry={11} />
      <path d="M48 96 L120 120 L192 96 L192 178 Q192 186 184 189 L124 206 Q120 207 116 206 L56 189 Q48 186 48 178 Z" fill={fill(p, "violet")} />
      <path d="M120 120 L192 96 L192 178 Q192 186 184 189 L124 206 Q120 207 120 206 Z" fill="#5236d6" opacity="0.35" />
      <path d="M48 96 L20 66 L94 44 L120 72 Z" fill={fill(p, "violet")} />
      <path d="M192 96 L220 66 L146 44 L120 72 Z" fill={fill(p, "violet")} />
      <path d="M48 96 L120 72 L192 96 L120 120 Z" fill="#3e27a8" opacity="0.55" />
      <path d="M62 118 Q64 160 104 176" stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.3" />
      <Sparkle x={120} y={34} size={11} color="#ffad1f" />
      <Sparkle x={194} y={30} size={7} color="#12b76a" />
      <Sparkle x={44} y={34} size={6} color="#ff5c8a" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Success badge + confetti                                            */
/* ------------------------------------------------------------------ */

export function SuccessIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  const confetti: Array<[number, number, number, Tone]> = [
    [44, 58, -20, "berry"],
    [196, 52, 30, "mango"],
    [30, 150, 40, "sky"],
    [212, 142, -35, "violet"],
    [70, 26, 10, "emerald"],
    [168, 22, -10, "ocean"]
  ];
  return (
    <Frame p={p} viewBox="0 0 240 230" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={208} rx={72} ry={10} />
      {confetti.map(([x, y, r, tone]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="18" height="9" rx="4.5" fill={fill(p, tone)} transform={`rotate(${r} ${x + 9} ${y + 4.5})`} />
      ))}
      <circle cx="120" cy="114" r="74" fill={fill(p, "emerald", true)} />
      <circle cx="120" cy="114" r="58" fill="#ffffff" opacity="0.14" />
      <path d="M86 116 L110 140 L156 90" stroke="#ffffff" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Gloss p={p} cx={98} cy={74} rx={30} ry={14} opacity={0.6} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Shield (security / trust)                                           */
/* ------------------------------------------------------------------ */

export function ShieldIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={220} rx={70} ry={10} />
      <path d="M120 24 L192 52 Q194 150 120 208 Q46 150 48 52 Z" fill={fill(p, "ocean")} />
      <path d="M120 40 L178 62 Q178 140 120 188 Z" fill="#ffffff" opacity="0.12" />
      <rect x="92" y="108" width="56" height="46" rx="12" fill="#ffffff" />
      <path d="M102 108 L102 96 Q102 78 120 78 Q138 78 138 96 L138 108" stroke="#ffffff" strokeWidth="9" fill="none" />
      <circle cx="120" cy="128" r="7" fill={fill(p, "ocean", true)} />
      <rect x="117" y="130" width="6" height="12" rx="3" fill="#3039a8" />
      <Gloss p={p} cx={92} cy={66} rx={20} ry={10} opacity={0.6} />
      <Sparkle x={200} y={110} size={9} color="#12b76a" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Shopping bag                                                        */
/* ------------------------------------------------------------------ */

export function BagIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 240" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={220} rx={78} ry={11} />
      <path d="M86 84 L86 66 Q86 34 120 34 Q154 34 154 66 L154 84" stroke={fill(p, "ink")} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M50 80 Q52 70 62 70 L178 70 Q188 70 190 80 L198 196 Q199 210 185 210 L55 210 Q41 210 42 196 Z" fill={fill(p, "emerald")} />
      <path d="M62 86 L58 190" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      <circle cx="86" cy="92" r="7" fill="#08804a" />
      <circle cx="154" cy="92" r="7" fill="#08804a" />
      <rect x="92" y="122" width="56" height="44" rx="14" fill="#ffffff" opacity="0.95" />
      <path d="M108 144 L116 152 L132 134" stroke="#12b76a" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="rotate(14 186 64)">
        <rect x="166" y="48" width="44" height="30" rx="9" fill={fill(p, "mango")} />
        <circle cx="176" cy="63" r="4" fill="#ffffff" />
      </g>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Rocket (launch / growth)                                            */
/* ------------------------------------------------------------------ */

export function RocketIllustration({ className, title }: IllustrationProps) {
  const p = useClayPrefix();
  return (
    <Frame p={p} viewBox="0 0 240 260" className={className} title={title}>
      <GroundShadow p={p} cx={120} cy={240} rx={60} ry={9} opacity={0.15} />
      <path d="M100 196 Q120 250 140 196 Z" fill={fill(p, "mango")} />
      <path d="M110 196 Q120 228 130 196 Z" fill="#fff3d0" />
      <path d="M84 150 L60 196 L92 186 Z" fill={fill(p, "berry")} />
      <path d="M156 150 L180 196 L148 186 Z" fill={fill(p, "berry")} />
      <path d="M120 22 Q170 70 160 196 L80 196 Q70 70 120 22 Z" fill={fill(p, "cream")} />
      <path d="M120 22 Q150 52 156 96 L84 96 Q90 52 120 22 Z" fill={fill(p, "berry")} />
      <circle cx="120" cy="128" r="22" fill={fill(p, "sky", true)} stroke="#ffffff" strokeWidth="6" />
      <Gloss p={p} cx={112} cy={120} rx={8} ry={5} opacity={0.9} />
      <path d="M96 106 L96 180" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      <Sparkle x={42} y={60} size={10} color="#ffad1f" />
      <Sparkle x={200} y={86} size={8} color="#7c5cff" />
      <Sparkle x={196} y={30} size={6} color="#12b76a" />
    </Frame>
  );
}

export const clayIllustrations = {
  shop: ShopIllustration,
  phone: PhoneChatIllustration,
  upi: UpiQrIllustration,
  tiffin: TiffinIllustration,
  bowl: BowlIllustration,
  cake: CakeIllustration,
  juice: JuiceIllustration,
  salon: SalonIllustration,
  grocery: GroceryIllustration,
  chart: ChartIllustration,
  customers: CustomersIllustration,
  bell: BellIllustration,
  calendar: CalendarIllustration,
  empty: EmptyBoxIllustration,
  success: SuccessIllustration,
  shield: ShieldIllustration,
  bag: BagIllustration,
  rocket: RocketIllustration
} as const;

export type ClayIllustrationName = keyof typeof clayIllustrations;

export function ClayIllustration({ name, className, title }: IllustrationProps & { name: ClayIllustrationName }) {
  const Component = clayIllustrations[name];
  return <Component className={className} title={title} />;
}

/** Picks a fitting clay illustration for a business type name (used as image placeholders). */
export function illustrationNameForBusinessType(businessType: string | null | undefined): ClayIllustrationName {
  const type = (businessType ?? "").toLowerCase();
  if (type.includes("tiffin")) return "tiffin";
  if (type.includes("bakery") || type.includes("sweet") || type.includes("cake")) return "cake";
  if (type.includes("juice") || type.includes("cafe") || type.includes("coffee")) return "juice";
  if (type.includes("salon") || type.includes("spa") || type.includes("beauty")) return "salon";
  if (type.includes("grocery") || type.includes("kirana") || type.includes("pharmacy") || type.includes("store")) return "grocery";
  if (type.includes("restaurant") || type.includes("kitchen") || type.includes("catering") || type.includes("food") || type.includes("hotel")) return "bowl";
  if (type.includes("laundry") || type.includes("tailor") || type.includes("service") || type.includes("fitness") || type.includes("yoga")) return "calendar";
  return "bag";
}
