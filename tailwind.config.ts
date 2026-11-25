import type { Config } from "tailwindcss";

/**
 * VyapaarMate "Clay & Glass" design tokens.
 *
 * The legacy colour names (ink, ocean, violet, emerald, mist, line) are kept so every
 * existing screen picks up the new palette; mango, berry, sky and cream are new accents.
 * Radii are rounder across the board and the clay/glass shadows give surfaces depth.
 */
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
        ink: { DEFAULT: "#1d1a39", soft: "#4a4668", muted: "#7a7694" },
        ocean: { DEFAULT: "#4f5bd5", soft: "#eceeff", deep: "#3640b0" },
        violet: { DEFAULT: "#7c5cff", soft: "#f0ebff", deep: "#5a3de0" },
        emerald: {
          DEFAULT: "#12b76a",
          soft: "#e1f8ec",
          deep: "#08804a",
          50: "#ecfbf3",
          100: "#d4f6e4",
          200: "#a9ecc9",
          300: "#72dda8",
          400: "#3ccb87",
          500: "#12b76a",
          600: "#0e9a59",
          700: "#0b7d49",
          800: "#0b633c",
          900: "#0a5133"
        },
        mango: { DEFAULT: "#ffad1f", soft: "#fff4d9", deep: "#d97f00" },
        berry: { DEFAULT: "#ff5c8a", soft: "#ffe8ef", deep: "#d93a68" },
        sky: { DEFAULT: "#33b5f5", soft: "#e2f5fe", deep: "#0b86c2" },
        mist: "#f6f4ff",
        cream: "#fff8ef",
        line: "#e8e4f5",
        // Neutral greys carry a faint violet tint so they sit well on the lavender canvas.
        slate: {
          50: "#f8f7fc",
          100: "#f1effa",
          200: "#e4e1f1",
          300: "#cdc9e0",
          400: "#a19cbc",
          500: "#77729a",
          600: "#5c5880",
          700: "#46426a",
          800: "#2f2c4d",
          900: "#1f1c39",
          950: "#13112a"
        },
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
        soft: "0 24px 60px -24px rgba(48, 36, 120, 0.3)",
        glow: "0 0 0 6px rgba(18, 183, 106, 0.12), 0 14px 32px -10px rgba(18, 183, 106, 0.5)",
        clay: "0 22px 44px -22px rgba(55, 41, 130, 0.38), 0 8px 18px -12px rgba(55, 41, 130, 0.18), inset 0 -6px 14px rgba(84, 64, 168, 0.07), inset 0 3px 6px rgba(255, 255, 255, 0.95)",
        "clay-sm": "0 12px 24px -16px rgba(55, 41, 130, 0.4), inset 0 -3px 8px rgba(84, 64, 168, 0.07), inset 0 2px 4px rgba(255, 255, 255, 0.95)",
        "clay-lg": "0 44px 80px -36px rgba(55, 41, 130, 0.42), 0 18px 34px -22px rgba(55, 41, 130, 0.24), inset 0 -10px 22px rgba(84, 64, 168, 0.08), inset 0 4px 8px rgba(255, 255, 255, 0.95)",
        "clay-inset": "inset 0 3px 8px rgba(55, 41, 130, 0.12), inset 0 -2px 4px rgba(255, 255, 255, 0.9)",
        glass: "0 18px 50px -24px rgba(31, 27, 58, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
        sticker: "0 5px 0 -1px rgba(29, 26, 57, 0.14), 0 12px 20px -10px rgba(29, 26, 57, 0.4)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-sans)"]
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(circle at 18% 18%, rgba(124, 92, 255, 0.16), transparent 30%), radial-gradient(circle at 82% 10%, rgba(18, 183, 106, 0.16), transparent 28%), radial-gradient(circle at 60% 92%, rgba(255, 173, 31, 0.14), transparent 30%), linear-gradient(135deg, #f7f5ff 0%, #f1fbf6 48%, #fff8ef 100%)",
        "clay-emerald": "linear-gradient(180deg, #33d38f 0%, #12b76a 52%, #0b9a57 100%)",
        "clay-ink": "linear-gradient(180deg, #3a3566 0%, #1d1a39 100%)",
        "clay-ocean": "linear-gradient(180deg, #7c87f0 0%, #4f5bd5 55%, #3d48c2 100%)",
        "clay-mango": "linear-gradient(180deg, #ffd166 0%, #ffad1f 55%, #f39300 100%)",
        "clay-berry": "linear-gradient(180deg, #ff8fb0 0%, #ff5c8a 55%, #ec4373 100%)",
        "clay-violet": "linear-gradient(180deg, #a48bff 0%, #7c5cff 55%, #6a48f0 100%)"
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
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "float-tilt": "float-tilt 7s ease-in-out infinite",
        pop: "pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
        wiggle: "wiggle 2.4s ease-in-out infinite",
        "blob-drift": "blob-drift 18s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
