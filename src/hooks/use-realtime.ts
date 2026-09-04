"use client"

import { useEffect, useRef, useState } from "react"
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs"
import SockJS from "sockjs-client"
import { SOCKJS_URL } from "@/lib/config"
import { useAuth } from "@/providers/auth-provider"

export type ConnectionState = "connecting" | "connected" | "offline"

export interface EventMeta {
	topic: string
	body: string
	receivedAt: string
}

type Handler = (payload: unknown, meta: EventMeta) => void

interface Options {
	topics: string[]
	onEvent: Handler
	enabled?: boolean
}

export function useRealtime({ topics, onEvent, enabled = true }: Options): ConnectionState {
	const { token } = useAuth()

	const [state, setState] = useState<ConnectionState>("connecting")

	const handlerRef = useRef(onEvent)

	const subsRef = useRef<StompSubscription[]>([])

	handlerRef.current = onEvent

	const topicKey = topics.filter(Boolean).sort().join("|")

	useEffect(() => {
		if (!enabled || !token || !topicKey) {
			setState("offline")

			return
		}

		let disposed = false

		setState("connecting")

		const client = new Client({
			webSocketFactory: () => new SockJS(SOCKJS_URL) as unknown as WebSocket,
			connectHeaders: { Authorization: `Bearer ${token}` },
			reconnectDelay: 4000,
			heartbeatIncoming: 10_000,
			heartbeatOutgoing: 10_000,
			debug: () => undefined
		})

		const deliver = (topic: string) => (frame: IMessage) => {
			const meta: EventMeta = { topic, body: frame.body, receivedAt: new Date().toISOString() }

			let payload: unknown = null

			try {
				payload = JSON.parse(frame.body)
			} catch {
				payload = null
			}

			handlerRef.current(payload, meta)
		}

		client.onConnect = () => {
			if (disposed) return

			setState("connected")
			subsRef.current = topicKey.split("|").map((topic) => client.subscribe(topic, deliver(topic)))
		}

		client.onWebSocketClose = () => {
			if (!disposed) setState("connecting")
		}
		client.onStompError = () => {
			if (!disposed) setState("offline")
		}

		client.activate()

		return () => {
			disposed = true
			subsRef.current.forEach((sub) => {
				try {
					sub.unsubscribe()
				} catch {
				}
			})
			subsRef.current = []
			void client.deactivate()
		}
	}, [enabled, token, topicKey])

	return state
}
