/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./resources/**/*.{js,ts,jsx,tsx}",
    "./app.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'highlight-flash': 'highlight-flash 1s ease-out',
      },
      keyframes: {
        'highlight-flash': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(20, 184, 166, 0.4), inset 0 0 0 2px rgba(20, 184, 166, 0.6)',
          },
          '50%': {
            boxShadow: '0 0 20px 4px rgba(20, 184, 166, 0.3), inset 0 0 0 2px rgba(20, 184, 166, 0.4)',
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(20, 184, 166, 0), inset 0 0 0 2px rgba(20, 184, 166, 0)',
          },
        },
      },
    },
  },
  plugins: [],
}