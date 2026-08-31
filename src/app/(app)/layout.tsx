"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { Spinner } from "@/components/ui/spinner"

export default function AppLayout({ children }: { children: ReactNode }) {
	const { token, ready } = useAuth()

	const router = useRouter()

	const pathname = usePathname()

	const { t } = useI18n()

	useEffect(() => {
		if (ready && !token) {
			const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""

			router.replace(`/login${next}`)
		}
	}, [ready, token, router, pathname])

	if (!ready || !token) {
		return (
			<div className='flex min-h-screen items-center justify-center gap-3 bg-ink-50 text-sm text-ink-500 dark:bg-ink-900 dark:text-ink-400'>
				<Spinner />
				{t("common.loading")}
			</div>
		)
	}

	return <>{children}</>
}
