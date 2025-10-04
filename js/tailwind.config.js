/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#052438',
        'brand-dark-alt': '#072436',
        'brand-dark-alt2': '#052437',
        'brand-dark-alt3': '#062437',
        'brand-white': '#ffffff',
      },
    },
  },
  plugins: [],
}