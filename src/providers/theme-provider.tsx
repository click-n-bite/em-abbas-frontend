"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { STORAGE_KEYS } from "@/lib/config"

type Theme = "light" | "dark"

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>("light")

	useEffect(() => {
		const stored = window.localStorage.getItem(STORAGE_KEYS.theme)

		if (stored === "dark" || stored === "light") setThemeState(stored)
	}, [])

	useEffect(() => {
		document.documentElement.dataset.theme = theme
		document.documentElement.classList.toggle("dark", theme === "dark")
	}, [theme])

	const setTheme = (next: Theme) => {
		setThemeState(next)
		window.localStorage.setItem(STORAGE_KEYS.theme, next)
	}

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
	const ctx = useContext(ThemeContext)

	if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")

	return ctx
}
