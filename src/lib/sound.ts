/**
 * Short two-tone "new message" chime, synthesized with the Web Audio API so
 * the app doesn't need to ship or fetch a binary audio asset. Throttled so a
 * burst of realtime events for the same message can't stack multiple chimes.
 *
 * Browsers refuse to actually produce sound from an AudioContext until it has
 * been "unlocked" by a real user gesture (click/tap/keydown) somewhere on the
 * page — resuming it later from inside a WebSocket/STOMP callback (not a
 * gesture) silently stays suspended. So we listen for the first gesture on
 * the page and unlock the context right then, well before any realtime
 * message can arrive.
 */

let ctx: AudioContext | null = null

let unlocked = false

let lastPlayedAt = 0

function getContext(): AudioContext | null {
	if (typeof window === "undefined") return null

	const Ctor =
		window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

	if (!Ctor) return null

	if (!ctx) ctx = new Ctor()

	return ctx
}

function unlock() {
	const audioCtx = getContext()

	if (!audioCtx) return

	// A silent blip played synchronously inside the gesture handler is what
	// actually flips Safari/Chrome's "this tab may play audio" flag — just
	// calling resume() isn't always enough on its own.
	const osc = audioCtx.createOscillator()
	const gain = audioCtx.createGain()

	gain.gain.value = 0
	osc.connect(gain)
	gain.connect(audioCtx.destination)
	osc.start()
	osc.stop(audioCtx.currentTime + 0.01)

	void audioCtx.resume().then(() => {
		unlocked = true
	})
}

if (typeof window !== "undefined") {
	const opts: AddEventListenerOptions = { once: true, capture: true }

	window.addEventListener("pointerdown", unlock, opts)
	window.addEventListener("keydown", unlock, opts)
	window.addEventListener("touchstart", unlock, opts)
}

function tone(audioCtx: AudioContext, freq: number, start: number, duration: number, peak: number) {
	const osc = audioCtx.createOscillator()

	const gain = audioCtx.createGain()

	osc.type = "sine"
	osc.frequency.value = freq
	osc.connect(gain)
	gain.connect(audioCtx.destination)

	const t0 = audioCtx.currentTime + start

	gain.gain.setValueAtTime(0, t0)
	gain.gain.linearRampToValueAtTime(peak, t0 + 0.02)
	gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

	osc.start(t0)
	osc.stop(t0 + duration + 0.02)
}

export function playNotificationSound(): void {
	try {
		const audioCtx = getContext()

		if (!audioCtx) return

		const now = Date.now()

		if (now - lastPlayedAt < 600) return

		lastPlayedAt = now

		if (audioCtx.state === "suspended") {
			// Not unlocked yet (no gesture has happened at all, e.g. the very
			// first tab load) — try anyway, most browsers still allow this once
			// the page itself has focus, but this is the one case that can
			// legitimately stay silent until the user clicks something.
			void audioCtx.resume()
		}

		if (audioCtx.state !== "running" && !unlocked) return

		tone(audioCtx, 880, 0, 0.14, 0.18)
		tone(audioCtx, 1175, 0.12, 0.18, 0.15)
	} catch {
		// Audio is a nice-to-have; never let it break the chat.
	}
}
