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
          // Kept as an alias so any future "gold" references still resolve.
          DEFAULT: "#F58220",
          light: "#FCA04A",
          dark: "#D96B0F",
        },
        // Sodiq School primary brand orange (from the logo).
        brand: {
          DEFAULT: "#F58220",
          light: "#FCA04A",
          dark: "#D96B0F",
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
