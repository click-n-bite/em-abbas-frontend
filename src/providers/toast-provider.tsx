"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"

type ToastTone = "success" | "error" | "info"

interface Toast {
	id: number
	tone: ToastTone
	message: string
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const remove = useCallback((id: number) => {
		setToasts((current) => current.filter((toast) => toast.id !== id))
	}, [])

	const push = useCallback(
		(message: string, tone: ToastTone = "info") => {
			counter += 1
			const id = counter

			setToasts((current) => [...current, { id, tone, message }])
			window.setTimeout(() => remove(id), 4200)
		},
		[remove]
	)

	const value = useMemo(() => ({ push }), [push])

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className='pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4'>
				{toasts.map((toast) => {
					const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertTriangle : Info

					const tone =
						toast.tone === "success"
							? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
							: toast.tone === "error"
								? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
								: "border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"

					return (
						<div
							key={toast.id}
							role='status'
							className={`pointer-events-auto flex w-full max-w-md animate-slide-in items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${tone}`}>
							<Icon className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
							<p className='flex-1 leading-5'>{toast.message}</p>
							<button
								type='button'
								onClick={() => remove(toast.id)}
								className='rounded p-0.5 opacity-60 transition hover:opacity-100'
								aria-label='Dismiss'>
								<X className='h-4 w-4' aria-hidden='true' />
							</button>
						</div>
					)
				})}
			</div>
		</ToastContext.Provider>
	)
}

export function useToast() {
	const ctx = useContext(ToastContext)

	if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")

	return ctx
}
