"use client"

import { useState, type ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

interface Props {
	title: string
	subtitle?: string
	actions?: ReactNode
	children: ReactNode
	/** Chat needs a full-height, non-scrolling body. */
	flush?: boolean
}

export function AppShell({ title, subtitle, actions, children, flush = false }: Props) {
	const [menuOpen, setMenuOpen] = useState(false)

	return (
		<div className='flex min-h-screen bg-ink-50 dark:bg-ink-900'>
			<Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
			<div className='flex min-w-0 flex-1 flex-col'>
				<Topbar title={title} subtitle={subtitle} actions={actions} onMenu={() => setMenuOpen(true)} />
				<main className={flush ? "min-h-0 flex-1 overflow-hidden p-4 sm:p-6" : "flex-1 space-y-6 p-4 sm:p-6"}>
					{children}
				</main>
			</div>
		</div>
	)
}
