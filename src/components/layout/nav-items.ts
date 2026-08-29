import { Activity, Ban, Bell, LayoutDashboard, MessageSquare, Settings, Smartphone, Users } from "lucide-react"
import type { Role } from "@/lib/types"

export interface NavItem {
	href: string
	labelKey: string
	icon: typeof Bell
	roles?: Role[]
}

export const navItems: NavItem[] = [
	{ href: "/overview", labelKey: "nav.dashboard", icon: LayoutDashboard },
	{ href: "/conversations", labelKey: "nav.conversations", icon: MessageSquare },
	{ href: "/notifications", labelKey: "nav.notifications", icon: Bell },
	{ href: "/users", labelKey: "nav.users", icon: Users, roles: ["superadmin", "admin"] },
	{ href: "/blacklist", labelKey: "nav.blacklist", icon: Ban, roles: ["superadmin", "admin"] },
	{
		href: "/notify-phones",
		labelKey: "nav.notifyPhones",
		icon: Smartphone,
		roles: ["superadmin", "admin"]
	},
	{ href: "/settings", labelKey: "nav.settings", icon: Settings }
]

export function visibleNavItems(role: Role): NavItem[] {
	return navItems.filter((item) => !item.roles || item.roles.includes(role))
}
