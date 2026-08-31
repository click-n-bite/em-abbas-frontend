"use client"

import { STORAGE_KEYS } from "./config"

/**
 * Short "new message" ping, synthesized with the WebAudio API so the portal
 * doesn't need to ship/host an audio file. Two quick tones, like a
 * lightweight WhatsApp-style notification chime.
 */

let ctx: AudioContext | null = null

let unlocked = false

function getContext(): AudioContext | null {
	if (typeof window === "undefined") return null

	const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

	if (!Ctor) return null

	ctx ??= new Ctor()

	return ctx
}

/**
 * Browsers block audio until a user gesture happens on the page. Call this
 * once on the first click/keypress/touch so the AudioContext is warmed up
 * and later programmatic pings (triggered by a STOMP event, not a click)
 * actually play instead of failing silently.
 */
export function unlockSoundOnFirstInteraction(): void {
	if (typeof window === "undefined" || unlocked) return

	const unlock = () => {
		unlocked = true

		const audioCtx = getContext()

		if (audioCtx?.state === "suspended") void audioCtx.resume()

		window.removeEventListener("pointerdown", unlock)
		window.removeEventListener("keydown", unlock)
	}

	window.addEventListener("pointerdown", unlock, { once: true })
	window.addEventListener("keydown", unlock, { once: true })
}

export function isSoundEnabled(): boolean {
	if (typeof window === "undefined") return true

	return window.localStorage.getItem(STORAGE_KEYS.soundEnabled) !== "off"
}

export function setSoundEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return

	window.localStorage.setItem(STORAGE_KEYS.soundEnabled, enabled ? "on" : "off")
	window.dispatchEvent(new CustomEvent("ema:sound-preference", { detail: enabled }))
}

function tone(audioCtx: AudioContext, frequency: number, startAt: number, duration: number, gain: number): void {
	const oscillator = audioCtx.createOscillator()
	const gainNode = audioCtx.createGain()

	oscillator.type = "sine"
	oscillator.frequency.value = frequency

	gainNode.gain.setValueAtTime(0, startAt)
	gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.015)
	gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

	oscillator.connect(gainNode)
	gainNode.connect(audioCtx.destination)

	oscillator.start(startAt)
	oscillator.stop(startAt + duration + 0.02)
}

/** Play the "new message" ping, unless the person muted notification sounds. */
export function playMessageSound(): void {
	if (!isSoundEnabled()) return

	const audioCtx = getContext()

	if (!audioCtx) return

	if (audioCtx.state === "suspended") void audioCtx.resume()

	const now = audioCtx.currentTime

	tone(audioCtx, 880, now, 0.14, 0.18)
	tone(audioCtx, 1175, now + 0.11, 0.16, 0.16)
}
