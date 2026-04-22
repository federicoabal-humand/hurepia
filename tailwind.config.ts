import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          light: "#DBEAFE",
        },
        bg: "#F9FAFB",
        text: {
          primary: "#111827",
          secondary: "#6B7280",
        },
        border: "#E5E7EB",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 200ms ease-out",
        "slide-out-right": "slide-out-right 200ms ease-in",
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
