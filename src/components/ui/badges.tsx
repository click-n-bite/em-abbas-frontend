import { Bot, Clock, Headphones } from "lucide-react"
import type { Mode, Role } from "@/lib/types"
import { useI18n } from "@/providers/i18n-provider"

const modeStyles: Record<Mode, string> = {
	bot: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
	waiting: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
	agent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
}

const modeIcons: Record<Mode, typeof Bot> = {
	bot: Bot,
	waiting: Clock,
	agent: Headphones
}

export function ModeBadge({ mode }: { mode: Mode }) {
	const { t } = useI18n()

	const Icon = modeIcons[mode] ?? Bot

	return (
		<span className={`badge ${modeStyles[mode] ?? modeStyles.bot}`}>
			<Icon className='h-3 w-3' aria-hidden='true' />
			{t(`mode.${mode}`)}
		</span>
	)
}

const roleStyles: Record<Role, string> = {
	superadmin: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
	admin: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
	agent: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
}

export function RoleBadge({ role }: { role: Role }) {
	const { t } = useI18n()

	return <span className={`badge ${roleStyles[role]}`}>{t(`users.roles.${role}`)}</span>
}

export function StatusDot({ active }: { active: boolean }) {
	const { t } = useI18n()

	return (
		<span className='inline-flex items-center gap-2 text-sm'>
			<span
				className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-ink-300 dark:bg-ink-600"}`}
				aria-hidden='true'
			/>
			{t(active ? "users.active" : "users.inactive")}
		</span>
	)
}
