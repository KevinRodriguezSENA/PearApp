/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'pear-green': 'var(--theme-color)',
        'pear-dark-green': 'var(--theme-color)',
        'pear-yellow': '#FFCA28',
        'pear-neutral': '#F5F5F5',
        'pear-dark': '#4A4A4A',
      },
    },
  },
  variants: {
    extend: {
      display: ['group-hover'],
    },
  },
  plugins: [],
}