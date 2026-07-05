/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 主题色通过 CSS 变量驱动,便于深/浅色切换
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel-2)",
        border: "var(--border)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        danger: "var(--danger)",
        row: "var(--row)",
        rowHover: "var(--row-hover)",
        rowActive: "var(--row-active)",
      },
      fontFamily: {
        sans: ["HarmonyOS Sans SC", "Microsoft YaHei", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
