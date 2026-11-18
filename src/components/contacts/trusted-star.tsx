import { Star } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { cn } from "@/lib/utils"

export function TrustedStar({ className }: { className?: string }) {
	const { t } = useI18n()

	return (
		<span className={cn("inline-flex shrink-0", className)} title={t("contacts.trusted")}>
			<Star className='h-3.5 w-3.5 fill-amber-400 text-amber-500' aria-hidden='true' />
			<span className='sr-only'>{t("contacts.trusted")}</span>
		</span>
	)
}
