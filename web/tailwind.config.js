/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sandstone: "#b1824c",
        terracotta: "#8a4f2a",
        moss: "#495e42",
        dusk: "#1f2937",
      },
      boxShadow: {
        heritage: "0 10px 40px rgba(46, 30, 17, 0.25)",
      },
      backgroundImage: {
        "temple-gradient":
          "linear-gradient(135deg, rgba(34,29,22,1) 0%, rgba(128,78,43,1) 55%, rgba(190,138,82,1) 100%)",
      },
    },
  },
  plugins: [],
};
