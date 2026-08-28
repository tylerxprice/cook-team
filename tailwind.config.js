/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/client/index.html",
    "./src/client/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gas: {
          blue: "#1a73e8",
          red: "#ea4335",
          yellow: "#fbbc04",
          green: "#34a853",
        },
      },
    },
  },
  plugins: [],
};
