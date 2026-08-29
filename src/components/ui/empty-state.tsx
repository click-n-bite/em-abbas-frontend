import type { ReactNode } from "react"

interface Props {
	icon?: ReactNode
	title: string
	description?: string
	action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
	return (
		<div className='flex flex-col items-center justify-center gap-3 px-6 py-14 text-center'>
			{icon ? (
				<div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-700 dark:text-ink-300'>
					{icon}
				</div>
			) : null}
			<p className='text-sm font-medium text-ink-700 dark:text-ink-200'>{title}</p>
			{description ? <p className='max-w-sm text-sm text-ink-500 dark:text-ink-400'>{description}</p> : null}
			{action}
		</div>
	)
}
