"use client"

import { useEffect, useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import { useAuth } from "@/providers/auth-provider"
import type { PortalUser, Role } from "@/lib/types"
import type { UserPayload } from "@/lib/api"

interface Props {
	open: boolean
	user: PortalUser | null
	onClose: () => void
	onSubmit: (payload: UserPayload) => Promise<void>
}

const ALL_ROLES: Role[] = ["superadmin", "admin", "agent"]

export function UserFormModal({ open, user, onClose, onSubmit }: Props) {
	const { t } = useI18n()

	const { role: callerRole } = useAuth()

	const [displayName, setDisplayName] = useState("")

	const [username, setUsername] = useState("")

	const [role, setRole] = useState<Role>("agent")

	const [password, setPassword] = useState("")

	const [isActive, setIsActive] = useState(true)

	const [busy, setBusy] = useState(false)

	const [touched, setTouched] = useState(false)

	// Reset the form whenever the modal opens for a different record.
	useEffect(() => {
		if (!open) return

		setDisplayName(user?.displayName ?? "")
		setUsername(user?.username ?? "")
		setRole(user?.role ?? "agent")
		setIsActive(user?.isActive ?? true)
		setPassword("")
		setTouched(false)
		setBusy(false)
	}, [open, user])

	const roles = useMemo(
		() => (callerRole === "superadmin" ? ALL_ROLES : ALL_ROLES.filter((r) => r !== "superadmin")),
		[callerRole]
	)

	const usernameValid = username.trim().length > 1

	const passwordValid = Boolean(user) || password.trim().length > 0

	const valid = displayName.trim().length > 1 && usernameValid && passwordValid

	const submit = async () => {
		setTouched(true)

		if (!valid || busy) return

		setBusy(true)

		try {
			await onSubmit({
				username: username.trim(),
				displayName: displayName.trim(),
				role,
				isActive,
				...(password.trim() ? { password: password.trim() } : {})
			})
		} finally {
			setBusy(false)
		}
	}

	return (
		<Modal
			open={open}
			title={user ? t("users.editUser") : t("users.addUser")}
			onClose={busy ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={busy}>
						{t("common.cancel")}
					</button>
					<button type='button' className='btn-primary' onClick={() => void submit()} disabled={busy}>
						{busy ? <Spinner /> : null}
						{busy ? t("common.saving") : t("common.save")}
					</button>
				</>
			}>
			<form
				className='space-y-4'
				onSubmit={(event) => {
					event.preventDefault()
					void submit()
				}}>
				<div>
					<label className='label' htmlFor='user-name'>
						{t("users.name")}
					</label>
					<input
						id='user-name'
						className='input'
						value={displayName}
						onChange={(event) => setDisplayName(event.target.value)}
						autoComplete='off'
						required
					/>
				</div>

				<div>
					<label className='label' htmlFor='user-username'>
						{t("users.username")}
					</label>
					<input
						id='user-username'
						type='text'
						dir='ltr'
						className='input'
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						aria-invalid={touched && !usernameValid}
						autoComplete='off'
						required
						disabled={Boolean(user)}
					/>
				</div>

				<div>
					<label className='label' htmlFor='user-role'>
						{t("users.role")}
					</label>
					<select
						id='user-role'
						className='input'
						value={role}
						onChange={(event) => setRole(event.target.value as Role)}>
						{roles.map((value) => (
							<option key={value} value={value}>
								{t(`users.roles.${value}`)}
							</option>
						))}
					</select>
					<p className='mt-1.5 text-xs text-ink-500 dark:text-ink-400'>{t(`users.roleHelp.${role}`)}</p>
				</div>

				<div>
					<label className='label' htmlFor='user-password'>
						{t("users.password")}{" "}
						{user ? <span className='font-normal lowercase tracking-normal'>({t("common.optional")})</span> : null}
					</label>
					<input
						id='user-password'
						type='password'
						dir='ltr'
						className='input'
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						aria-invalid={touched && !passwordValid}
						autoComplete='new-password'
						required={!user}
					/>
					<p className='mt-1.5 text-xs text-ink-500 dark:text-ink-400'>
						{user ? t("users.passwordHint") : t("users.passwordRequired")}
					</p>
				</div>

				<label className='flex items-center gap-3 text-sm text-ink-700 dark:text-ink-200'>
					<input
						type='checkbox'
						checked={isActive}
						onChange={(event) => setIsActive(event.target.checked)}
						className='h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500'
					/>
					{t("users.active")}
				</label>

				{touched && !valid ? (
					<p className='text-xs text-rose-600 dark:text-rose-400'>
						{!usernameValid ? t("users.username") : t("users.passwordRequired")}
					</p>
				) : null}

				<button type='submit' className='sr-only'>
					{t("common.save")}
				</button>
			</form>
		</Modal>
	)
}
