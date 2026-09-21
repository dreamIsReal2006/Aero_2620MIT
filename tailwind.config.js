/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { aero: { blue: '#0A84FF', ink: '#1c1e21', muted: '#65676b', danger: '#FF3B30' } },
      boxShadow: { glass: '0 8px 32px rgba(31, 38, 135, 0.07)', card: '0 4px 20px -2px rgba(0,0,0,.04), 0 12px 32px -4px rgba(0,0,0,.06)' },
      transitionTimingFunction: { spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', soft: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    }
  },
  plugins: []
};
