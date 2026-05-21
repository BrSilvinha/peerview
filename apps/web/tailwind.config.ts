import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#13131A",
        border: "#1E1E2E",
        accent: "#6366F1",
        "accent-hover": "#4F46E5",
        "text-primary": "#F1F5F9",
        "text-muted": "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "#1E1E2E",
      },
    },
  },
  plugins: [],
};

export default config;
