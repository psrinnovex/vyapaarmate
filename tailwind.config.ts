import type { Config } from "tailwindcss";

/**
 * VyapaarMate "Marigold Bazaar" design tokens.
 *
 * Source of truth: the VyapaarMate design system (tokens.json). The palette is built on the
 * logo — black (ink-950), logo green (green-500) and white (paper) — warmed by an ivory canvas
 * and marigold price tags. Peacock is for information and kumkum for errors.
 *
 * Contrast rules: text on green-500 or marigold-500 is always ink; green words on paper use
 * green-700 (or `text-brand-text`, which lifts to green-400 inside `.theme-dark`).
 */
const green = {
  50: "#effbec",
  100: "#d8f6d2",
  200: "#b2eca8",
  300: "#7fe076",
  400: "#3fd645",
  500: "#1ec926",
  600: "#12a51a",
  700: "#0b7a10",
  800: "#075c0c",
  900: "#064a0a",
  950: "#032a06"
};

const marigold = {
  50: "#fef8e8",
  100: "#fdebc4",
  200: "#fbd98a",
  300: "#f8c45a",
  400: "#f5b031",
  500: "#f2a20c",
  600: "#d08300",
  700: "#8f5400",
  800: "#6b3f00",
  900: "#4a2c00",
  950: "#2b1900"
};

const peacock = {
  50: "#ecf7f7",
  100: "#d4eeef",
  200: "#a8dcdf",
  300: "#74c9ce",
  400: "#3fb2ba",
  500: "#119aa5",
  600: "#0e7c86",
  700: "#0a5f67",
  800: "#08484e",
  900: "#063338",
  950: "#031d20"
};

const kumkum = {
  50: "#fdf2ef",
  100: "#fbe1db",
  200: "#f6c2b7",
  300: "#ef9886",
  400: "#e76c57",
  500: "#df5540",
  600: "#d8432e",
  700: "#b3311d",
  800: "#8a2517",
  900: "#5f1a10",
  950: "#380e08"
};

// Warm neutrals from the logo black up to the ivory canvas.
const ink = {
  DEFAULT: "#0b0d0b",
  50: "#faf7f0",
  100: "#f3eee2",
  200: "#e6dfcf",
  300: "#d3cab6",
  400: "#8f8a7f",
  500: "#625f57",
  600: "#4b4a43",
  700: "#3a3f39",
  800: "#262a25",
  900: "#151815",
  950: "#0b0d0b"
};

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        green,
        marigold,
        peacock,
        kumkum,
        ink,
        ivory: { 50: "#faf7f0", 100: "#f3eee2" },
        sand: { 200: "#e6dfcf", 300: "#d3cab6" },
        paper: "#ffffff",
        // Semantic brand roles; `.theme-dark` swaps them for dark surfaces.
        brand: "rgb(var(--vm-brand) / <alpha-value>)",
        "brand-text": "rgb(var(--vm-brand-text) / <alpha-value>)",
        "on-brand": "rgb(var(--vm-on-brand) / <alpha-value>)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)"
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)"
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)"
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)"
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)"
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)"
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)"
        }
      },
      // 8 / 12 / 16 / 24 / 32 match the system's radius-xs…radius-xl.
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "2.5rem"
      },
      boxShadow: {
        soft: "0 24px 60px -26px rgba(84, 58, 18, 0.30)",
        glow: "0 0 0 6px rgba(30, 201, 38, 0.14), 0 14px 32px -12px rgba(11, 122, 16, 0.45)",
        clay: "0 22px 40px -22px rgba(84, 58, 18, 0.40), 0 8px 16px -12px rgba(84, 58, 18, 0.18), inset 0 -6px 14px rgba(140, 100, 40, 0.07), inset 0 3px 6px rgba(255, 255, 255, 0.9)",
        "clay-sm": "0 10px 18px -12px rgba(84, 58, 18, 0.30), inset 0 -3px 8px rgba(120, 84, 30, 0.06), inset 0 2px 4px rgba(255, 255, 255, 0.9)",
        "clay-lg": "0 40px 70px -34px rgba(84, 58, 18, 0.48), 0 14px 26px -18px rgba(84, 58, 18, 0.22)",
        "clay-inset": "inset 0 3px 8px rgba(84, 58, 18, 0.10), inset 0 -2px 4px rgba(255, 255, 255, 0.9)",
        glass: "0 18px 50px -24px rgba(60, 40, 10, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.75)",
        sticker: "0 6px 10px -5px rgba(84, 58, 18, 0.35)",
        "lip-brand": "0 4px 0 #0b7a10",
        "lip-ink": "0 4px 0 #000000",
        "lip-accent": "0 4px 0 #d08300",
        "lip-paper": "0 4px 0 #d3cab6",
        "lip-danger": "0 4px 0 #7d2012"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(circle at 12% 10%, rgba(30, 201, 38, 0.12), transparent 32%), radial-gradient(circle at 88% 6%, rgba(242, 162, 12, 0.14), transparent 30%), linear-gradient(180deg, #fffdf8 0%, #faf7f0 100%)",
        "clay-green": "linear-gradient(180deg, #45dc4b 0%, #1ec926 55%, #19b821 100%)",
        "clay-ink": "linear-gradient(180deg, #2a2f29 0%, #0b0d0b 100%)",
        "clay-marigold": "linear-gradient(180deg, #f8c45a 0%, #f2a20c 55%, #e59700 100%)",
        "clay-kumkum": "linear-gradient(180deg, #e46a55 0%, #d8432e 55%, #c33a26 100%)",
        "clay-peacock": "linear-gradient(180deg, #2fb0ba 0%, #0e7c86 60%, #0a6f78 100%)",
        "clay-paper": "linear-gradient(180deg, #ffffff 0%, #faf7f0 100%)",
        awning: "repeating-linear-gradient(90deg, #1ec926 0 18px, #ffffff 18px 36px)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "float-tilt": {
          "0%, 100%": { transform: "translateY(0) rotate(-3deg)" },
          "50%": { transform: "translateY(-8px) rotate(3deg)" }
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)" }
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" }
        },
        "blob-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(18px, -14px) scale(1.05)" },
          "66%": { transform: "translate(-12px, 10px) scale(0.97)" }
        },
        "tag-swing": {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(2deg)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "float-tilt": "float-tilt 7s ease-in-out infinite",
        pop: "pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
        wiggle: "wiggle 2.4s ease-in-out infinite",
        "blob-drift": "blob-drift 18s ease-in-out infinite",
        "tag-swing": "tag-swing 5s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
