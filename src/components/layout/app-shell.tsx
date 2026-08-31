"use client"

import { useState, type ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { cn } from "@/lib/utils"

interface Props {
	title: string
	subtitle?: string
	actions?: ReactNode
	children: ReactNode
	flush?: boolean
}

export function AppShell({ title, subtitle, actions, children, flush = false }: Props) {
	const [menuOpen, setMenuOpen] = useState(false)

	return (
		<div
			className={cn(
				"flex bg-ink-50 dark:bg-ink-900",
				flush ? "h-dvh overflow-hidden" : "min-h-screen"
			)}
		>
			<Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
			<div className={cn("flex min-w-0 flex-1 flex-col", flush && "min-h-0")}>
				<Topbar title={title} subtitle={subtitle} actions={actions} onMenu={() => setMenuOpen(true)} />
				<main className={flush ? "min-h-0 flex-1 overflow-hidden p-4 sm:p-6" : "flex-1 space-y-6 p-4 sm:p-6"}>
					{children}
				</main>
			</div>
		</div>
	)
}