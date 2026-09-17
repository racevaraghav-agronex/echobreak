/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        eco: {
          400: "#34d399",
          600: "#059669",
          800: "#065f46",
          950: "#022c22",
        },
      },
    },
  },
  plugins: [],
};
