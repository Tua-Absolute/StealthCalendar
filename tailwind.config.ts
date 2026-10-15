import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          container: 'var(--color-surface-container)',
          elevated: 'var(--color-surface-elevated)',
        },
        border: {
          default: 'var(--color-border-default)',
        },
        foreground: {
          emphasis: 'var(--color-foreground-emphasis)',
          default: 'var(--color-foreground-default)',
          'de-emphasis': 'var(--color-foreground-de-emphasis)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
