"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Search, ShieldAlert, Trash2, Pencil, Users as UsersIcon } from "lucide-react"
import { adminApi, type UserPayload } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { RoleBadge, StatusDot } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { UserFormModal } from "@/components/users/user-form-modal"
import { cn } from "@/lib/utils"
import type { PortalUser } from "@/lib/types"

export default function UsersPage() {
	const { t, formatDateTime } = useI18n()

	const { agent, role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [users, setUsers] = useState<PortalUser[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [query, setQuery] = useState("")

	const [formOpen, setFormOpen] = useState(false)

	const [editing, setEditing] = useState<PortalUser | null>(null)

	const [pendingDelete, setPendingDelete] = useState<PortalUser | null>(null)

	const load = useCallback(async () => {
		try {
			const list = await adminApi.listUsers()

			setUsers(list)
			setFailure(null)
		} catch (error) {
			setFailure(errorKey(error))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (!canManageUsers) {
			setLoading(false)

			return
		}

		void load()
	}, [canManageUsers, load])

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase()

		if (!needle) return users

		return users.filter((user) =>
			[user.displayName, user.username, t(`users.roles.${user.role}`)].join(" ").toLowerCase().includes(needle)
		)
	}, [users, query, t])

	const submit = async (payload: UserPayload) => {
		try {
			if (editing) {
				const updated = await adminApi.updateUser(editing.id, payload)

				setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)))
			} else {
				const created = await adminApi.createUser(payload)

				setUsers((current) => [created, ...current])
			}

			push(t("users.saved"), "success")
			setFormOpen(false)
			setEditing(null)
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const remove = async (user: PortalUser) => {
		if (user.id === agent?.id) {
			push(t("users.cannotDeleteSelf"), "error")

			return
		}

		try {
			await adminApi.deleteUser(user.id)
			setUsers((current) => current.filter((entry) => entry.id !== user.id))
			push(t("users.deleted"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	if (!canManageUsers) {
		return (
			<AppShell title={t("users.title")}>
				<section className='card'>
					<EmptyState
						icon={<ShieldAlert className='h-5 w-5' aria-hidden='true' />}
						title={t("users.forbidden")}
						description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
					/>
				</section>
			</AppShell>
		)
	}

	return (
		<AppShell
			title={t("users.title")}
			subtitle={failure ? t(failure) : t("users.subtitle")}
			actions={
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={() => void load()}
						className='btn-secondary px-3 py-2'
						aria-label={t("common.refresh")}
						title={t("common.refresh")}>
						<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
					</button>
					<button
						type='button'
						className='btn-primary'
						onClick={() => {
							setEditing(null)
							setFormOpen(true)
						}}>
						<Plus className='h-4 w-4' aria-hidden='true' />
						{t("users.addUser")}
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				<header className='border-b border-ink-200 p-4 dark:border-ink-700'>
					<div className='relative max-w-sm'>
						<Search
							className='pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400'
							aria-hidden='true'
						/>
						<input
							className='input ps-9'
							placeholder={t("common.search")}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							aria-label={t("common.search")}
						/>
					</div>
				</header>

				{loading && users.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2, 3].map((index) => (
							<li key={index} className='flex items-center gap-3'>
								<span className='skeleton h-10 w-10 rounded-full' />
								<span className='flex-1 space-y-2'>
									<span className='skeleton block h-3 w-1/4' />
									<span className='skeleton block h-3 w-1/2' />
								</span>
							</li>
						))}
					</ul>
				) : filtered.length === 0 ? (
					<EmptyState icon={<UsersIcon className='h-5 w-5' aria-hidden='true' />} title={t("users.empty")} />
				) : (
					<>
						{/* Table on wide screens */}
						<div className='hidden overflow-x-auto lg:block'>
							<table className='w-full text-sm'>
								<thead className='bg-ink-50 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900/60 dark:text-ink-400'>
									<tr>
										<th className='px-5 py-3 text-start font-medium'>{t("users.name")}</th>
										<th className='px-5 py-3 text-start font-medium'>{t("users.role")}</th>
										<th className='px-5 py-3 text-start font-medium'>{t("users.status")}</th>
										<th className='px-5 py-3 text-start font-medium'>{t("users.created")}</th>
										<th className='px-5 py-3 text-end font-medium'>{t("users.actions")}</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-ink-100 dark:divide-ink-700/70'>
									{filtered.map((user) => (
										<tr key={user.id} className='transition hover:bg-ink-50 dark:hover:bg-ink-700/40'>
											<td className='px-5 py-3'>
												<div className='flex items-center gap-3'>
													<Avatar name={user.displayName} seed={user.username} size='sm' />
													<div className='min-w-0'>
														<p className='truncate font-medium text-ink-900 dark:text-ink-50'>{user.displayName}</p>
														<p dir='ltr' className='truncate text-xs text-ink-500 dark:text-ink-400'>
															{user.username}
														</p>
													</div>
												</div>
											</td>
											<td className='px-5 py-3'>
												<RoleBadge role={user.role} />
											</td>
											<td className='px-5 py-3'>
												<StatusDot active={user.isActive} />
											</td>
											<td className='px-5 py-3 text-ink-500 dark:text-ink-400'>{formatDateTime(user.createdAt)}</td>
											<td className='px-5 py-3'>
												<div className='flex items-center justify-end gap-1'>
													<button
														type='button'
														className='btn-ghost px-2 py-1.5'
														aria-label={t("common.edit")}
														title={t("common.edit")}
														onClick={() => {
															setEditing(user)
															setFormOpen(true)
														}}>
														<Pencil className='h-4 w-4' aria-hidden='true' />
													</button>
													<button
														type='button'
														className='btn-ghost px-2 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950'
														aria-label={t("common.delete")}
														title={t("common.delete")}
														disabled={user.id === agent?.id}
														onClick={() => setPendingDelete(user)}>
														<Trash2 className='h-4 w-4' aria-hidden='true' />
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Cards on small screens */}
						<ul className='divide-y divide-ink-100 dark:divide-ink-700/70 lg:hidden'>
							{filtered.map((user) => (
								<li key={user.id} className='space-y-3 p-4'>
									<div className='flex items-start gap-3'>
										<Avatar name={user.displayName} seed={user.username} size='sm' />
										<div className='min-w-0 flex-1'>
											<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>{user.displayName}</p>
											<p dir='ltr' className='truncate text-xs text-ink-500 dark:text-ink-400'>
												{user.username}
											</p>
										</div>
										<RoleBadge role={user.role} />
									</div>
									<div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500 dark:text-ink-400'>
										<StatusDot active={user.isActive} />
										<span>{formatDateTime(user.createdAt)}</span>
									</div>
									<div className='flex gap-2'>
										<button
											type='button'
											className='btn-secondary flex-1'
											onClick={() => {
												setEditing(user)
												setFormOpen(true)
											}}>
											<Pencil className='h-4 w-4' aria-hidden='true' />
											{t("common.edit")}
										</button>
										<button
											type='button'
											className='btn-danger flex-1'
											disabled={user.id === agent?.id}
											onClick={() => setPendingDelete(user)}>
											<Trash2 className='h-4 w-4' aria-hidden='true' />
											{t("common.delete")}
										</button>
									</div>
								</li>
							))}
						</ul>
					</>
				)}
			</section>

			<UserFormModal
				open={formOpen}
				user={editing}
				onClose={() => {
					setFormOpen(false)
					setEditing(null)
				}}
				onSubmit={submit}
			/>

			<ConfirmDialog
				open={pendingDelete !== null}
				title={t("users.deleteTitle")}
				body={t("users.deleteBody", { name: pendingDelete?.displayName ?? "" })}
				confirmLabel={t("common.delete")}
				onConfirm={async () => {
					if (pendingDelete) await remove(pendingDelete)
				}}
				onClose={() => setPendingDelete(null)}
			/>
		</AppShell>
	)
}
