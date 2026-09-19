/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          bg: "#FFFFFF",
          surface: "#F7F6F5",
          hover: "#EFEFED",
          border: "#E9E9E8",
          borderDark: "#D3D3D0",
          text: "#37352F",
          muted: "#787774",
          subtle: "#9B9A97",
          tagGray: "#F1F1EF",
          tagGrayText: "#5A5A58",
          tagBlue: "#E7F3F8",
          tagBlueText: "#28456C",
          tagGreen: "#EDF3EC",
          tagGreenText: "#2B593F",
          tagAmber: "#FBEDD6",
          tagAmberText: "#89632A",
          tagRed: "#FBE4E4",
          tagRedText: "#932C2C",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Helvetica",
          '"Apple Color Emoji"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SFMono-Regular"',
          "Menlo",
          "Consolas",
          '"PT Mono"',
          '"Liberation Mono"',
          "Courier",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
