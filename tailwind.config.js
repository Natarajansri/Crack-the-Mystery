/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050811',
          900: '#0a0f1d',
          850: '#0e1629',
          800: '#141f36',
          750: '#17243e',
          700: '#1e2d4d',
          600: '#2a3e68',
        },
        cyber: {
          cyan: '#00f0ff',
          teal: '#0df2c9',
          gold: '#ffd15c',
          amber: '#ff9e00',
          purple: '#9d4edd',
          pink: '#f72585',
          blue: '#3a86ff',
          red: '#ff0055',
          green: '#10b981',
        }
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -3px rgba(0, 240, 255, 0.45)',
        'glow-teal': '0 0 20px -3px rgba(13, 242, 201, 0.45)',
        'glow-gold': '0 0 20px -3px rgba(255, 209, 92, 0.45)',
        'glow-purple': '0 0 20px -3px rgba(157, 78, 221, 0.45)',
        'glow-amber': '0 0 20px -3px rgba(255, 158, 0, 0.45)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.8', filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.4))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 16px rgba(0, 240, 255, 0.8))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
