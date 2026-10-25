/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#6d5dfc',
          600: '#5b21b6',
          700: '#4c1d95',
        },
        surface: {
          DEFAULT: '#ffffff',
          elevated: '#fafafa',
          hover: '#f5f5f7',
        },
        border: {
          DEFAULT: '#e4e4e7',
          light: '#f2f2f4',
        },
        ink: {
          DEFAULT: '#18181b',
          muted: '#71717a',
          subtle: '#a1a1aa',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.02)',
      },
      spacing: {
        '18': '4.5rem',
      },
    },
  },
  plugins: [],
}
