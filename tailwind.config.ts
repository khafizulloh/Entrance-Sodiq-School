import type { Config } from "tailwindcss";

/**
 * Tailwind configuration with Sodiq School branding.
 * Brand palette: dark blue (navy), white, and gold.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Sodiq School brand colors
        navy: {
          DEFAULT: "#0B2447",
          light: "#19376D",
          dark: "#061633",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E6C766",
          dark: "#B8932E",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
