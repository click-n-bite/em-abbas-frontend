import { colorFromString, initials } from "@/lib/utils"

interface Props {
	name: string | null | undefined
	seed?: string
	size?: "sm" | "md" | "lg"
}

const sizes = {
	sm: "h-8 w-8 text-[11px]",
	md: "h-10 w-10 text-xs",
	lg: "h-12 w-12 text-sm"
} as const

export function Avatar({ name, seed, size = "md" }: Props) {
	const label = name?.trim() || seed || "?"

	return (
		<span
			aria-hidden='true'
			className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizes[size]}`}
			style={{ backgroundColor: colorFromString(seed ?? label) }}>
			{initials(name ?? seed)}
		</span>
	)
}
