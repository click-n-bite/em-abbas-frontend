"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
	steps: { key: string; label: string }[]
	current: number
	onSelect: (index: number) => void
}

export function CampaignStepper({ steps, current, onSelect }: Props) {
	return (
		<ol className='card flex items-center gap-2 p-3 md:px-5 md:py-4'>
			{steps.map((step, index) => {
				const done = index < current

				const active = index === current

				return (
					<li key={step.key} className='flex min-w-0 flex-1 items-center gap-2 last:flex-none'>
						<button
							type='button'
							disabled={index > current}
							aria-current={active ? "step" : undefined}
							onClick={() => onSelect(index)}
							className='flex min-h-11 min-w-0 items-center gap-2 rounded-lg pe-1 text-start disabled:cursor-default'>
							<span
								className={cn(
									"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
									done
										? "bg-emerald-500 text-white"
										: active
											? "bg-brand-600 text-white"
											: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300"
								)}>
								{done ? <Check className='h-4 w-4' aria-hidden='true' /> : index + 1}
							</span>
							<span
								className={cn(
									"truncate text-sm font-medium",
									active ? "text-ink-900 dark:text-ink-50" : "hidden text-ink-500 dark:text-ink-400 md:inline"
								)}>
								{step.label}
							</span>
						</button>
						{index < steps.length - 1 ? (
							<span
								aria-hidden='true'
								className={cn(
									"h-px flex-1",
									done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-ink-200 dark:bg-ink-700"
								)}
							/>
						) : null}
					</li>
				)
			})}
		</ol>
	)
}
