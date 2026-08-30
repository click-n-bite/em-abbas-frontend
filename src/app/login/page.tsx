"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, MessageCircle } from "lucide-react"
import { API_URL } from "@/lib/config"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Spinner } from "@/components/ui/spinner"

function LoginForm() {
	const router = useRouter()

	const params = useSearchParams()

	const { t } = useI18n()

	const { signIn, agent, ready } = useAuth()

	const [username, setUsername] = useState("")

	const [password, setPassword] = useState("")

	const [reveal, setReveal] = useState(false)

	const [busy, setBusy] = useState(false)

	const [error, setError] = useState<{ key: string; detail: string | null } | null>(null)

	const next = params.get("next") || "/conversations"

	useEffect(() => {
		if (ready && agent) router.replace(next)
	}, [ready, agent, router, next])

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setBusy(true)
		setError(null)

		try {
			await signIn(username.trim(), password)
			router.replace(next)
		} catch (caught) {
			setError({ key: errorKey(caught), detail: errorDetail(caught) })
			setBusy(false)
		}
	}

	return (
		<div className='flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900'>
			<div className='flex items-center justify-end gap-2 p-4'>
				<LanguageSwitcher />
				<ThemeToggle />
			</div>

			<div className='flex flex-1 items-center justify-center px-4 pb-16'>
				<div className='w-full max-w-md'>
					<div className='mb-6 flex flex-col items-center gap-3 text-center'>
						<span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white'>
							<MessageCircle className='h-6 w-6' aria-hidden='true' />
						</span>
						<div>
							<h1 className='text-xl font-semibold text-ink-900 dark:text-ink-50'>{t("login.title")}</h1>
							<p className='mt-1 text-sm text-ink-500 dark:text-ink-400'>{t("login.subtitle")}</p>
						</div>
					</div>

					<form onSubmit={onSubmit} className='card animate-fade-in space-y-4 p-6' noValidate>
						<div>
							<label className='label' htmlFor='username'>
								{t("login.username")}
							</label>
							<input
								id='username'
								type='text'
								autoComplete='username'
								dir='ltr'
								required
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								className='input'
								placeholder='superadmin'
							/>
						</div>

						<div>
							<label className='label' htmlFor='password'>
								{t("login.password")}
							</label>
							<div className='relative'>
								<input
									id='password'
									type={reveal ? "text" : "password"}
									autoComplete='current-password'
									dir='ltr'
									required
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									className='input pe-11'
									placeholder='••••••••'
								/>
								<button
									type='button'
									onClick={() => setReveal((value) => !value)}
									aria-label={t(reveal ? "login.hidePassword" : "login.showPassword")}
									className='absolute inset-y-0 end-2 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100'>
									{reveal ? (
										<EyeOff className='h-4 w-4' aria-hidden='true' />
									) : (
										<Eye className='h-4 w-4' aria-hidden='true' />
									)}
								</button>
							</div>
						</div>

						{error ? (
							<div
								role='alert'
								className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200'>
								<p>{t(error.key === "errors.generic" ? "login.failed" : error.key)}</p>
								{error.detail ? <p className='mt-1 text-xs opacity-80'>{error.detail}</p> : null}
							</div>
						) : null}

						<button type='submit' className='btn-primary w-full' disabled={busy}>
							{busy ? <Spinner /> : null}
							{t(busy ? "login.submitting" : "login.submit")}
						</button>
					</form>

					<p className='mt-4 text-center text-xs text-ink-400 dark:text-ink-500' dir='ltr'>
						{t("login.apiTarget")}: {API_URL}
					</p>
				</div>
			</div>
		</div>
	)
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className='flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-900'>
					<Spinner />
				</div>
			}>
			<LoginForm />
		</Suspense>
	)
}
