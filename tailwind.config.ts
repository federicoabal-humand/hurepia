import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Never apply dark-mode variants — demo is light-only
  darkMode: "class",
  theme: {
    extend: {
      /* ── Brand palette ───────────────────────────────────────────── */
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          hover:   "#1D4ED8",
          light:   "#DBEAFE",
          50:      "#EFF6FF",
        },
        /* Humand semantic surfaces */
        surface: {
          0:   "#FFFFFF",
          50:  "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
        },
        /* Named aliases used in existing code */
        bg:    "#F9FAFB",
        text: {
          primary:   "#111827",
          secondary: "#6B7280",
          muted:     "#9CA3AF",
        },
        border: "#E5E7EB",
      },

      /* ── Typography ──────────────────────────────────────────────── */
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },

      /* ── Spacing / radius aligned with Humand components ─────────── */
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      /* ── Elevation (box shadows) ─────────────────────────────────── */
      boxShadow: {
        "hu-sm":  "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "hu-md":  "0 4px 16px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
        "hu-lg":  "0 20px 40px -8px rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.06)",
        "hu-xl":  "0 32px 64px -12px rgb(0 0 0 / 0.14), 0 12px 24px -6px rgb(0 0 0 / 0.08)",
      },

      /* ── Transitions ─────────────────────────────────────────────── */
      transitionDuration: {
        "250": "250ms",
      },

      /* ── Animations ──────────────────────────────────────────────── */
      keyframes: {
        "slide-in-right": {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 250ms ease-out",
        "slide-out-right": "slide-out-right 200ms ease-in",
        "fade-in":         "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
