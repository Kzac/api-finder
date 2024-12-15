/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#eff6ff',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        green: {
          50: '#f0fdf4',
          600: '#16a34a',
          700: '#15803d',
        },
        yellow: {
          600: '#ca8a04',
          700: '#a16207',
        },
      },
    },
  },
  plugins: [],
}
