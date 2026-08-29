"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/providers/auth-provider"
import { I18nProvider } from "@/providers/i18n-provider"
import { ThemeProvider } from "@/providers/theme-provider"
import { ToastProvider } from "@/providers/toast-provider"
import { NotificationsProvider } from "@/providers/notifications-provider"

/**
 * Single place where every client-side context is mounted. Order matters:
 * notifications need the session, and every provider needs translations.
 */
export function Providers({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider>
			<I18nProvider>
				<ToastProvider>
					<AuthProvider>
						<NotificationsProvider>{children}</NotificationsProvider>
					</AuthProvider>
				</ToastProvider>
			</I18nProvider>
		</ThemeProvider>
	)
}
