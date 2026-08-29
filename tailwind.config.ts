import type { Config } from "tailwindcss"

const config: Config = {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#eef6ff",
					100: "#d9ebff",
					200: "#bcdcff",
					300: "#8ec6ff",
					400: "#59a6ff",
					500: "#3282f6",
					600: "#1f63eb",
					700: "#1a4ed8",
					800: "#1c41af",
					900: "#1c3a8a"
				},
				ink: {
					50: "#f6f7f9",
					100: "#eceef2",
					200: "#d5d9e2",
					300: "#b1b8c8",
					400: "#8791a8",
					500: "#68738c",
					600: "#525b72",
					700: "#43495c",
					800: "#393e4d",
					900: "#181b22"
				}
			},
			fontFamily: {
				sans: ["var(--font-sans)", "system-ui", "sans-serif"]
			},
			keyframes: {
				"fade-in": {
					from: { opacity: "0", transform: "translateY(4px)" },
					to: { opacity: "1", transform: "translateY(0)" }
				},
				"slide-in": {
					from: { opacity: "0", transform: "translateY(-8px)" },
					to: { opacity: "1", transform: "translateY(0)" }
				}
			},
			animation: {
				"fade-in": "fade-in .18s ease-out",
				"slide-in": "slide-in .2s ease-out"
			}
		}
	},
	plugins: []
}

export default config
