import { authApi } from "./features/auth/api"
import { blacklistApi } from "./features/blacklist/api"
import { conversationsApi } from "./features/conversations/api"
import { notifyPhonesApi } from "./features/notify-phones/api"
import { notificationsApi } from "./features/notifications/api"
import { usersApi } from "./features/users/api"

export { ApiError, clearSession, decodeJwt, readToken, request } from "./http"

export type { RequestOptions } from "./http"

export { authApi, blacklistApi, conversationsApi, notificationsApi, notifyPhonesApi, usersApi }

export type { LoginResponse } from "./features/auth/types"

export type { UserPayload } from "./features/users/types"

export type { NotifyPhonePayload } from "./features/notify-phones/types"

export type { BlockCountryPayload } from "./features/blacklist/types"

/** Endpoints on the deployed EMA backend. */
export const api = {
	login: authApi.login,
	conversations: conversationsApi.list,
	conversation: conversationsApi.get,
	messages: conversationsApi.messages,
	sendMessage: conversationsApi.sendMessage,
	takeover: conversationsApi.takeover,
	handoffToAi: conversationsApi.handoffToAi,
	notifications: notificationsApi.list,
	markNotificationRead: notificationsApi.markRead
}

/** User & country-block management on the real EMA backend (/api/admin/**). */
export const adminApi = {
	listUsers: usersApi.list,
	createUser: usersApi.create,
	updateUser: usersApi.update,
	deleteUser: usersApi.remove,
	listBlockedCountries: blacklistApi.list,
	blockCountry: blacklistApi.block,
	unblockCountry: blacklistApi.unblock,
	listNotifyPhones: notifyPhonesApi.list,
	addNotifyPhone: notifyPhonesApi.add,
	deleteNotifyPhone: notifyPhonesApi.remove
}
