import {
  ACTIVE_VOICE_STATUSES,
  type VoiceCallStatus,
} from "./features/voice/types";

export function isActiveCall(status: VoiceCallStatus | string): boolean {
  return (ACTIVE_VOICE_STATUSES as readonly string[]).includes(status);
}

/** `m:ss`, or `h:mm:ss` from one hour. */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";

  const total = Math.floor(ms / 1000);

  const hours = Math.floor(total / 3600);

  const minutes = Math.floor((total % 3600) / 60);

  const seconds = total % 60;

  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;

  return `${minutes}:${ss}`;
}

/** Elapsed time of a live call, from `startedAt`. */
export function elapsedSince(startedAt: string, now: number): number {
  const started = new Date(startedAt).getTime();

  return Number.isFinite(started) ? Math.max(0, now - started) : 0;
}

/** `YYYY-MM-DD` (local day) to an inclusive ISO start-of-day timestamp. */
export function dayStartIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);

  return new Date(y, m - 1, d).toISOString();
}

/** `YYYY-MM-DD` (local day) to the exclusive ISO start of the NEXT day. */
export function dayEndExclusiveIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);

  return new Date(y, m - 1, d + 1).toISOString();
}

/** Translate with a fallback when the key has no dictionary entry. */
export function tOr(
  t: (key: string, vars?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  const value = t(key, vars);

  return value === key ? fallback : value;
}

export function humanizeCode(code: string): string {
  return code.replace(/[_-]+/g, " ").trim();
}
