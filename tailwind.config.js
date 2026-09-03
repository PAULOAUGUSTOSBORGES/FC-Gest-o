/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand-color, #2563eb)',
        'brand-dark': 'var(--brand-color-dark, #1d4ed8)',
        'brand-light': 'var(--brand-color-light, #eff6ff)',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] }
    }
  },
  plugins: [],
}
