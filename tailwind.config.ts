import type { Config } from "tailwindcss";

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
        ink: "#0d1321",
        ocean: "#1246a0",
        violet: "#6c3df4",
        emerald: "#11a66a",
        mist: "#f5f8fb",
        line: "#dce6f1",
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
      boxShadow: {
        soft: "0 24px 80px rgba(18, 70, 160, 0.16)",
        glow: "0 0 42px rgba(17, 166, 106, 0.26)"
      },
      fontFamily: {
        sans: ["var(--font-inter)"]
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(circle at 20% 20%, rgba(17,166,106,0.18), transparent 28%), radial-gradient(circle at 78% 12%, rgba(108,61,244,0.18), transparent 24%), linear-gradient(135deg, #f8fbff 0%, #eef7f2 42%, #f8f8ff 100%)"
      }
    }
  },
  plugins: []
};

export default config;
