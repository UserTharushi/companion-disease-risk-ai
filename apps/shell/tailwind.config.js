/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#e9fbfb",
          100: "#c8f5f4",
          500: "#0ea5a2",
          600: "#0b8b88",
          700: "#0a7472",
          900: "#11404b"
        },
        accent: {
          500: "#ff8a5b",
          600: "#f97346"
        },
        danger: {
          500: "#ef4444",
          600: "#dc2626"
        },
        warning: {
          500: "#f59e0b",
          600: "#d97706"
        },
        surface: {
          50: "#f4f8ff",
          100: "#e9f0ff",
          200: "#d5e1f8"
        }
      },
      fontFamily: {
        sans: ["Nunito Sans", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
