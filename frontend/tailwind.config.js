/** @type {import('tailwindcss').Config} */
// 中文注释：Tailwind 配置 — 品牌色板（米白+浅灰+哑光金）、Playfair/Cairo 字体、RTL 翻转插件
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 启用 RTL 翻转：direction 变 rtl 时，left/right、ml/mr、pl/pr 等镜像翻转
  plugins: [require('tailwindcss-rtl')],
  theme: {
    extend: {
      colors: {
        ceramic: {
          cream: '#FAF7F2',
          offWhite: '#F3EFE9',
          pearl: '#EDE7DC',
          ash: '#8A857C',
          graphite: '#2C2A26',
          gold: {
            matte: '#B89778',
            soft: '#D4B896',
            light: '#E8D5B7',
            deep: '#8A6E4F',
          },
          border: '#E5DFD3',
        },
      },
      fontFamily: {
        // LTR：衬线标题 Playfair Display + 无衬线正文 Inter
        serif: ['"Playfair Display"', '"Noto Serif"', 'Georgia', 'serif'],
        sans: ['Inter', '"Noto Sans"', 'system-ui', 'sans-serif'],
        // RTL（阿拉伯）：使用 Cairo 谷歌字体
        arabic: ['Cairo', '"Amiri"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 10px 40px -10px rgba(184, 151, 120, 0.35)',
        soft: '0 4px 24px -12px rgba(44, 42, 38, 0.08)',
      },
      letterSpacing: {
        luxury: '0.08em',
      },
      borderRadius: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: 0.7 },
          '80%, 100%': { transform: 'scale(1.4)', opacity: 0 },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.8s cubic-bezier(0.4,0,0.2,1) both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
};
