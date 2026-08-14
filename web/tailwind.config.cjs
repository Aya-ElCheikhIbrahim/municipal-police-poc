/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#1F3864',
        'accent-mission': '#2E5496',
        available: '#2E7D32',
        pending: '#F9A825',
        panic: '#C62828',
        offduty: '#9E9E9E',
      },
    },
  },
  plugins: [],
}