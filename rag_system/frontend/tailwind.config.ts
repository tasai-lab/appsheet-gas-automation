import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#4286a8",
          light: "#5a9fc4",
          dark: "#2f6280",
        },
        secondary: {
          DEFAULT: "#0d8331",
          light: "#1aa344",
          dark: "#095c23",
        },
        accent: {
          DEFAULT: "#abd36f",
          light: "#c2e08f",
          dark: "#8ab954",
        },
        surface: {
          light: "#fffeff",
          dark: "#1a1a1a",
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
} satisfies Config;
