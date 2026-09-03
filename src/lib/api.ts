import { authApi } from "./features/auth/api"
import { blacklistApi } from "./features/blacklist/api"
import { blockedNumbersApi } from "./features/blocked-numbers/api"
import { conversationsApi } from "./features/conversations/api"
import { notifyPhonesApi } from "./features/notify-phones/api"
import { notificationsApi } from "./features/notifications/api"
import { usersApi } from "./features/users/api"

export { ApiError, clearSession, decodeJwt, readToken, refreshAccessToken, request } from "./http"

export type { RequestOptions } from "./http"

export { authApi, blacklistApi, blockedNumbersApi, conversationsApi, notificationsApi, notifyPhonesApi, usersApi }

export type { LoginResponse } from "./features/auth/types"

export type { UserPayload } from "./features/users/types"

export type { CreateNotifyPhonePayload, UpdateNotifyPhonePayload } from "./features/notify-phones/types"

export type { BlockCountryPayload } from "./features/blacklist/types"

export type { BlockNumberPayload } from "./features/blocked-numbers/types"

export const api = {
	login: authApi.login,
	conversations: conversationsApi.list,
	conversation: conversationsApi.get,
	messages: conversationsApi.messages,
	markConversationRead: conversationsApi.markRead,
	uploadMedia: conversationsApi.uploadMedia,
	mediaBlobUrl: conversationsApi.mediaBlobUrl,
	sendMessage: conversationsApi.sendMessage,
	takeover: conversationsApi.takeover,
	handoffToAi: conversationsApi.handoffToAi,
	deleteConversation: conversationsApi.remove,
	clearConversationMessages: conversationsApi.clearMessages,
	notifications: notificationsApi.list,
	markNotificationRead: notificationsApi.markRead
}

export const adminApi = {
	listUsers: usersApi.list,
	createUser: usersApi.create,
	updateUser: usersApi.update,
	deleteUser: usersApi.remove,
	listBlockedCountries: blacklistApi.list,
	blockCountry: blacklistApi.block,
	unblockCountry: blacklistApi.unblock,
	listBlockedNumbers: blockedNumbersApi.list,
	blockNumber: blockedNumbersApi.block,
	unblockNumber: blockedNumbersApi.unblock,
	listNotifyPhones: notifyPhonesApi.list,
	addNotifyPhone: notifyPhonesApi.add,
	updateNotifyPhone: notifyPhonesApi.update,
	deleteNotifyPhone: notifyPhonesApi.remove
}
