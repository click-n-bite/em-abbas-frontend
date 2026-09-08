import { authApi } from "./features/auth/api"
import { blacklistApi } from "./features/blacklist/api"
import { blockedNumbersApi } from "./features/blocked-numbers/api"
import { conversationsApi } from "./features/conversations/api"
import { notifyPhonesApi } from "./features/notify-phones/api"
import { notificationsApi } from "./features/notifications/api"
import { usersApi } from "./features/users/api"
import { leadsApi } from "./features/leads/api"
import { activityApi } from "./features/activity/api"

export { ApiError, clearSession, decodeJwt, readToken, refreshAccessToken, request } from "./http"

export type { RequestOptions } from "./http"

export {
	authApi,
	blacklistApi,
	blockedNumbersApi,
	conversationsApi,
	notificationsApi,
	notifyPhonesApi,
	usersApi,
	leadsApi,
	activityApi
}

export type { LoginResponse } from "./features/auth/types"

export type { UserPayload } from "./features/users/types"

export type { CreateNotifyPhonePayload, UpdateNotifyPhonePayload } from "./features/notify-phones/types"

export type { BlockCountryPayload } from "./features/blacklist/types"

export type { BlockNumberPayload } from "./features/blocked-numbers/types"

export type { CreateLeadPayload, Lead, LeadService, LeadsListParams, LeadsPage, UpdateLeadPayload } from "./features/leads/types"

export type { ConversationActivityEvent, ConversationActivityResponse } from "./features/activity/types"

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
	clearConversationMessages: conversationsApi.clearMessages,
	hideConversation: conversationsApi.hide,
	unhideConversation: conversationsApi.unhide,
	hiddenConversations: conversationsApi.listHidden,
	notifications: notificationsApi.list,
	markNotificationRead: notificationsApi.markRead,
	leads: leadsApi.list,
	leadServices: leadsApi.services,
	createLead: leadsApi.create,
	conversationActivity: activityApi.get
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
	deleteNotifyPhone: notifyPhonesApi.remove,
	updateLead: leadsApi.update
}
