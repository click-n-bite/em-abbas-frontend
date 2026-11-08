"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bot,
  ChevronDown,
  ChevronUp,
  Contact,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  History,
  Image as ImageIcon,
  KeyRound,
  ListChecks,
  MapPin,
  Mic,
  MessageSquare,
  MoreVertical,
  MousePointerClick,
  Paperclip,
  Pencil,
  Play,
  Search,
  Send,
  SendHorizontal,
  ShieldOff,
  Trash2,
  Undo2,
  UserRound,
  UserRoundPlus,
  Workflow,
  X,
} from "lucide-react";
import { adminApi, api, ApiError } from "@/lib/api";
import { errorDetail, errorKey } from "@/lib/errors";
import { cn, colorFromString, textDirOf, uuid } from "@/lib/utils";
import { useI18n } from "@/providers/i18n-provider";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { ModeBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BlockNumberFormModal } from "@/components/blocked-numbers/block-number-form-modal";
import { LeadFormModal } from "@/components/leads/lead-form-modal";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { usePoll } from "@/hooks/use-poll";
import { useRealtime, type ConnectionState } from "@/hooks/use-realtime";
import type { Conversation, Message, RealtimeEvent } from "@/lib/types";
import { statusIcon, statusTint } from "@/lib/message-status";
import {
  createVoiceRecorder,
  pickVoiceRecordFormat,
  primeVoiceContext,
  voiceFileFromChunks,
} from "@/lib/voice-recording";
import { WhatsAppAudioPlayer } from "./audio-player";

interface Props {
  conversation: Conversation | null;
  onConversationChange: (conversation: Conversation) => void;
  onBack?: () => void;
  onConversationDeleted?: (id: string) => void;
  onToggleHide?: (id: string, hide: boolean) => void | Promise<void>;
}

function formatTimeAmPm(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDateTimeAmPm(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function startOfLocalDay(value: string | number | Date): number {
  const d = new Date(value);

  d.setHours(0, 0, 0, 0);

  return d.getTime();
}

function daysAgo(value: string | number | Date): number {
  return Math.round(
    (startOfLocalDay(Date.now()) - startOfLocalDay(value)) / 86_400_000,
  );
}

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"،؛؟…]+$/;

// Within this distance of the bottom the chat keeps following new messages.
const NEAR_BOTTOM_PX = 80;

// Further than this from the bottom, show the "jump to latest" button.
const FAR_FROM_BOTTOM_PX = 400;

function agentKeyOf(message: Message): string | null {
  const key = message.agentId ?? message.agentName ?? null;

  return key && key.trim() ? key.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function messageFromRealtime(event: RealtimeEvent): Message | null {
  const root = asRecord(event);

  if (!root) return null;

  const nested = asRecord(root.message);

  const raw = nested ? { ...root, ...nested } : root;

  const rawId = raw.id ?? raw.messageId;

  if (typeof rawId !== "string" && typeof rawId !== "number") return null;

  const id = String(rawId);

  if (!id) return null;

  const conversationId = raw.conversationId ?? raw.conversation_id;

  return {
    ...(raw as unknown as Message),
    id,
    conversationId: conversationId == null ? "" : String(conversationId),
  };
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return current;

  const byId = new Map<string, Message>();

  const order: string[] = [];

  const put = (message: Message) => {
    if (!message?.id) return;

    const existingKey = message.clientMessageId
      ? order.find(
          (key) => byId.get(key)?.clientMessageId === message.clientMessageId,
        )
      : undefined;

    const key = existingKey ?? message.id;

    if (!byId.has(key)) order.push(key);

    const previous = byId.get(key);

    if (
      previous &&
      (previous.deliveryVersion ?? 0) > (message.deliveryVersion ?? 0)
    )
      return;

    byId.set(
      key,
      previous ? { ...previous, ...message, optimistic: false } : message,
    );
  };

  current.forEach(put);
  incoming.forEach(put);

  return order
    .map((key) => byId.get(key) as Message)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

function useVisualViewport(): { height: number; top: number } | null {
  const [state, setState] = useState<{ height: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) return;

    const mobile = window.matchMedia("(max-width: 1023px)");

    let settleTimer: number | null = null;

    const update = () => {
      if (!mobile.matches) {
        setState((prev) => (prev === null ? prev : null));

        return;
      }

      const next = { height: viewport.height, top: viewport.offsetTop };

      setState((prev) =>
        prev && prev.height === next.height && prev.top === next.top
          ? prev
          : next,
      );
    };

    const updateAfterBlur = () => {
      if (settleTimer) window.clearTimeout(settleTimer);

      settleTimer = window.setTimeout(() => {
        update();
        settleTimer = window.setTimeout(() => {
          settleTimer = null;
          update();
        }, 250);
      }, 100);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    mobile.addEventListener("change", update);
    window.addEventListener("focusout", updateAfterBlur);
    window.addEventListener("orientationchange", updateAfterBlur);

    return () => {
      if (settleTimer) window.clearTimeout(settleTimer);

      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      mobile.removeEventListener("change", update);
      window.removeEventListener("focusout", updateAfterBlur);
      window.removeEventListener("orientationchange", updateAfterBlur);
    };
  }, []);

  return state;
}

const MEDIA_BLOB_CACHE_MAX = 200;

const mediaBlobCache = new Map<string, string>();

function getCachedMediaBlobUrl(mediaId: string): string | undefined {
  const cached = mediaBlobCache.get(mediaId);

  if (cached !== undefined) {
    mediaBlobCache.delete(mediaId);
    mediaBlobCache.set(mediaId, cached);
  }

  return cached;
}

function setCachedMediaBlobUrl(mediaId: string, url: string): void {
  const existing = mediaBlobCache.get(mediaId);

  if (existing !== undefined) {
    if (existing !== url) URL.revokeObjectURL(existing);

    mediaBlobCache.delete(mediaId);
  }

  mediaBlobCache.set(mediaId, url);

  if (mediaBlobCache.size > MEDIA_BLOB_CACHE_MAX) {
    const oldestKey = mediaBlobCache.keys().next().value;

    if (oldestKey !== undefined) {
      const oldestUrl = mediaBlobCache.get(oldestKey);

      mediaBlobCache.delete(oldestKey);

      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }
  }
}

function useMediaBlobUrl(mediaId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() =>
    mediaId ? (getCachedMediaBlobUrl(mediaId) ?? null) : null,
  );

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mediaId) {
      setUrl(null);
      setError(false);

      return;
    }

    const cached = getCachedMediaBlobUrl(mediaId);

    if (cached) {
      setUrl(cached);
      setError(false);
      setLoading(false);

      return;
    }

    let cancelled = false;

    const controller = new AbortController();

    setLoading(true);
    setError(false);

    api
      .mediaBlobUrl(mediaId, controller.signal)
      .then((blobUrl) => {
        setCachedMediaBlobUrl(mediaId, blobUrl);

        if (cancelled) return;

        setUrl(blobUrl);
      })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;

        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mediaId]);

  return { url, loading, error };
}

function MessageMedia({
  message,
  outbound,
}: {
  message: Message;
  outbound: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);

  if (!message.mediaId) {
    if (message.filename) {
      return (
        <div
          className={cn(
            "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900",
          )}
        >
          <Spinner />
          <span className="truncate">{message.filename}</span>
        </div>
      );
    }

    return null;
  }

  return (
    <LoadedMedia
      message={message}
      outbound={outbound}
      lightbox={lightbox}
      setLightbox={setLightbox}
    />
  );
}

function LoadedMedia({
  message,
  outbound,
  lightbox,
  setLightbox,
}: {
  message: Message;
  outbound: boolean;
  lightbox: boolean;
  setLightbox: (value: boolean) => void;
}) {
  const { t } = useI18n();

  const { url, loading, error } = useMediaBlobUrl(message.mediaId);

  if (loading) {
    return (
      <div className="mb-1 flex h-32 w-full min-w-48 items-center justify-center rounded-lg bg-black/10">
        <Spinner />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div
        className={cn(
          "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
          outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900",
        )}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {t("chat.mediaFailed")}
      </div>
    );
  }

  if (message.type === "image" || message.type === "sticker") {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="mb-1 block w-full overflow-hidden rounded-lg bg-black/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image can't optimize it */}
          <img
            src={url}
            alt={message.filename ?? t("chat.image")}
            className="h-auto max-h-64 w-full object-contain"
          />
        </button>

        {lightbox ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightbox(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={message.filename ?? t("chat.image")}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>

            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </>
    );
  }

  if (message.type === "video") {
    return (
      <video src={url} controls className="mb-1 max-h-64 w-full rounded-lg" />
    );
  }

  if (message.type === "audio") {
    return (
      <WhatsAppAudioPlayer
        src={url}
        sentTime={formatTimeAmPm(message.createdAt)}
        status={message.status}
        outbound={outbound}
      />
    );
  }

  return (
    <a
      href={url}
      download={message.filename ?? "file"}
      className={cn(
        "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-90",
        outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900",
      )}
    >
      <FileText className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {message.filename ?? t("chat.download")}
      </span>
      <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
    </a>
  );
}

const RICH_TYPES = new Set([
  "buttons",
  "list",
  "template",
  "otp",
  "location",
  "contacts",
  "flow",
]);

const VISUAL_MEDIA_TYPES = new Set(["image", "video", "sticker"]);

const FILE_MEDIA_TYPES = new Set(["document", "audio"]);

function RichBody({ message }: { message: Message }) {
  if (!message.text) return null;

  return (
    <p
      dir={textDirOf(message.text)}
      className="mb-2 whitespace-pre-wrap break-words"
    >
      {message.text}
    </p>
  );
}

function RichPanel({
  outbound,
  children,
}: {
  outbound: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs",
        outbound ? "bg-white/10" : "bg-ink-50 dark:bg-ink-900/60",
      )}
    >
      {children}
    </div>
  );
}

function RichLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
      {icon}
      {children}
    </p>
  );
}

function MessageRichContent({
  message,
  outbound,
}: {
  message: Message;
  outbound: boolean;
}) {
  const { t } = useI18n();

  const payload = message.payload ?? {};

  const chipClass = cn(
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
    outbound ? "border-white/30" : "border-ink-300 dark:border-ink-600",
  );

  if (message.type === "buttons") {
    const buttons = Array.isArray(payload.buttons) ? payload.buttons : [];

    return (
      <div className="mb-1">
        <RichBody message={message} />

        {buttons.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {buttons.map((button) => (
              <span key={button.id} className={chipClass}>
                {button.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (message.type === "list") {
    const sections = Array.isArray(payload.sections) ? payload.sections : [];

    return (
      <div className="mb-1" dir={textDirOf(message.text)}>
        <RichBody message={message} />

        <RichPanel outbound={outbound}>
          {payload.buttonText ? (
            <RichLabel
              icon={<ListChecks className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {payload.buttonText}
            </RichLabel>
          ) : null}

          {sections.map((section, sectionIndex) => (
            <div
              dir={textDirOf(message.text)}
              key={`${section.title ?? "section"}-${sectionIndex}`}
              className="mb-2 last:mb-0"
            >
              {section.title ? (
                <p className="mb-1 text-[11px] font-semibold opacity-70">
                  {section.title}
                </p>
              ) : null}

              <ul className="list-disc ps-4">
                {(section.rows ?? []).map((row) => (
                  <li key={row.id} className="mb-0.5 last:mb-0">
                    <span className="font-medium">{row.title}</span>

                    {row.description ? (
                      <span className="opacity-70"> — {row.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </RichPanel>
      </div>
    );
  }

  if (message.type === "template" || message.type === "otp") {
    const isOtp = message.type === "otp";

    return (
      <div className="mb-1">
        <RichBody message={message} />

        <RichPanel outbound={outbound}>
          <RichLabel
            icon={
              isOtp ? (
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
          >
            {isOtp ? t("chat.rich.otpTemplate") : t("chat.rich.template")}
          </RichLabel>

          {payload.templateName ? (
            <p className="font-mono text-[11px] opacity-90">
              {payload.templateName}
            </p>
          ) : null}

          {Array.isArray(payload.bodyParams) &&
          payload.bodyParams.length > 0 ? (
            <ul className="mt-1 list-disc ps-4">
              {payload.bodyParams.map((param, index) => (
                <li key={index}>{param}</li>
              ))}
            </ul>
          ) : null}

          {isOtp && payload.code ? (
            <p className="mt-1">
              <span className="opacity-70">{t("chat.rich.code")}: </span>
              <span className="font-mono font-semibold tracking-widest">
                {payload.code}
              </span>
            </p>
          ) : null}
        </RichPanel>
      </div>
    );
  }

  if (message.type === "location") {
    const hasCoords =
      typeof payload.latitude === "number" &&
      typeof payload.longitude === "number";

    return (
      <div className="mb-1">
        <RichBody message={message} />

        <RichPanel outbound={outbound}>
          <RichLabel
            icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {t("chat.rich.location")}
          </RichLabel>

          {payload.locationName ? (
            <p className="font-medium">{payload.locationName}</p>
          ) : null}

          {payload.address ? (
            <p className="opacity-70">{payload.address}</p>
          ) : null}

          {hasCoords ? (
            <a
              href={`https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 underline underline-offset-2"
            >
              {t("chat.rich.viewOnMap")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </RichPanel>
      </div>
    );
  }

  if (message.type === "contacts") {
    return (
      <div className="mb-1">
        <RichBody message={message} />

        <RichPanel outbound={outbound}>
          <RichLabel
            icon={<Contact className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {t("chat.rich.contact")}
          </RichLabel>

          {payload.contactName ? (
            <p className="font-medium">{payload.contactName}</p>
          ) : null}
          {payload.phone ? (
            <p dir="ltr" className="opacity-70">
              {payload.phone}
            </p>
          ) : null}
        </RichPanel>
      </div>
    );
  }

  if (message.type === "flow") {
    return (
      <div className="mb-1">
        <RichBody message={message} />

        <div className={chipClass}>
          <Workflow className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {payload.flowCta || t("chat.rich.flowCta")}
        </div>
      </div>
    );
  }

  return null;
}

function MessageTapHint({
  message,
  outbound,
}: {
  message: Message;
  outbound: boolean;
}) {
  const { t } = useI18n();

  if (message.type !== "interactive" && message.type !== "button") return null;

  const payload = message.payload ?? {};

  const title =
    payload.button_reply?.title ?? payload.list_reply?.title ?? null;

  if (!title) return null;

  return (
    <p
      className={cn(
        "mb-1 flex items-center gap-1 text-[11px] font-medium opacity-80",
        outbound ? "text-white" : "text-ink-500",
      )}
    >
      <MousePointerClick className="h-3 w-3" aria-hidden="true" />
      {t("chat.rich.tapped")}
    </p>
  );
}

function MediaThumb({
  message,
  onOpen,
}: {
  message: Message;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  const { url, loading, error } = useMediaBlobUrl(message.mediaId);

  if (loading) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-900">
        <Spinner />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-ink-100 p-2 text-center text-[10px] text-ink-400 dark:bg-ink-900">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {t("chat.mediaFailed")}
      </div>
    );
  }

  if (message.type === "video") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative aspect-square overflow-hidden rounded-lg bg-black"
        aria-label={t("chat.mediaPreview.video")}
      >
        <video
          src={url}
          className="h-full w-full object-cover opacity-80 transition group-hover:opacity-60"
          muted
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group aspect-square overflow-hidden rounded-lg"
      aria-label={message.filename ?? t("chat.image")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image can't optimize it */}
      <img
        src={url}
        alt={message.filename ?? t("chat.image")}
        className="h-full w-full object-cover transition group-hover:opacity-90"
      />
    </button>
  );
}

function MediaLightbox({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const { url, loading, error } = useMediaBlobUrl(message.mediaId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full"
      >
        {loading ? (
          <Spinner />
        ) : error || !url ? (
          <p className="text-sm text-white">{t("chat.mediaFailed")}</p>
        ) : message.type === "video" ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={message.filename ?? t("chat.image")}
            className="max-h-[85vh] max-w-full rounded-lg"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function MediaListItem({ message }: { message: Message }) {
  const { t } = useI18n();

  const { url, loading, error } = useMediaBlobUrl(message.mediaId);

  if (message.type === "audio") {
    return (
      <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
          <span className="flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            {t("chat.voiceMessage")}
          </span>
          <span dir="ltr">{formatDateTimeAmPm(message.createdAt)}</span>
        </div>

        {loading ? (
          <Spinner />
        ) : error || !url ? (
          <p className="text-xs text-rose-500">{t("chat.mediaFailed")}</p>
        ) : (
          <WhatsAppAudioPlayer
            src={url}
            sentTime={formatDateTimeAmPm(message.createdAt)}
          />
        )}
      </div>
    );
  }

  return (
    <a
      href={url ?? undefined}
      download={message.filename ?? "file"}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm transition hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700/40",
        (!url || loading) && "pointer-events-none opacity-60",
      )}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-300">
        {loading ? (
          <Spinner />
        ) : (
          <FileText className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink-900 dark:text-ink-50">
          {message.filename ?? t("chat.download")}
        </span>
        <span dir="ltr" className="block text-xs text-ink-400">
          {formatDateTimeAmPm(message.createdAt)}
        </span>
      </span>
      {error ? (
        <AlertCircle
          className="h-4 w-4 flex-shrink-0 text-rose-500"
          aria-hidden="true"
        />
      ) : (
        <Download
          className="h-4 w-4 flex-shrink-0 text-ink-400"
          aria-hidden="true"
        />
      )}
    </a>
  );
}

function MediaTab({ messages }: { messages: Message[] }) {
  const { t } = useI18n();

  const [selected, setSelected] = useState<Message | null>(null);

  const visualMedia = useMemo(
    () =>
      messages
        .filter(
          (message) => VISUAL_MEDIA_TYPES.has(message.type) && message.mediaId,
        )
        .slice()
        .reverse(),
    [messages],
  );

  const fileMedia = useMemo(
    () =>
      messages
        .filter(
          (message) => FILE_MEDIA_TYPES.has(message.type) && message.mediaId,
        )
        .slice()
        .reverse(),
    [messages],
  );

  if (visualMedia.length === 0 && fileMedia.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
          title={t("chat.mediaEmpty")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6">
      {visualMedia.length > 0 ? (
        <section className="mb-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("chat.mediaImages")}
            <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
              {visualMedia.length}
            </span>
          </h3>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {visualMedia.map((message) => (
              <MediaThumb
                key={message.id}
                message={message}
                onOpen={() => setSelected(message)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {fileMedia.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t("chat.mediaDocuments")}
            <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
              {fileMedia.length}
            </span>
          </h3>

          <div className="flex flex-col gap-2">
            {fileMedia.map((message) => (
              <MediaListItem key={message.id} message={message} />
            ))}
          </div>
        </section>
      ) : null}

      {selected ? (
        <MediaLightbox message={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

export function ChatPanel({
  conversation,
  onConversationChange,
  onBack,
  onToggleHide,
}: Props) {
  const { t, dir } = useI18n();

  const { agent, role, canManageUsers } = useAuth();

  const canChangeMode = role === "agent";

  const { push } = useToast();

  const visualViewport = useVisualViewport();

  const [messages, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);

  const [draft, setDraft] = useState("");

  const [sending, setSending] = useState(false);

  const [modeBusy, setModeBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const [, setPendingDelete] = useState(false);

  const [pendingClear, setPendingClear] = useState(false);

  const [unblocking, setUnblocking] = useState(false);

  const [blockedEntryId, setBlockedEntryId] = useState<string | null>(null);

  const [hideBusy, setHideBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<"messages" | "media" | "activity">(
    "messages",
  );

  const [searchOpen, setSearchOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [searchActiveIndex, setSearchActiveIndex] = useState(0);

  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const [renameModalOpen, setRenameModalOpen] = useState(false);

  const [renameDraft, setRenameDraft] = useState("");

  const [renaming, setRenaming] = useState(false);

  // Messages that arrived while the agent was scrolled away from the bottom.
  const [unseenCount, setUnseenCount] = useState(0);

  // The first of those messages — the "New messages" line is drawn above it.
  const [, setDividerId] = useState<string | null>(null);

  // True when the agent is far enough up that a "jump to latest" button helps.
  const [showJump, setShowJump] = useState(false);

  const messageRefs = useRef(new Map<string, HTMLDivElement>());

  const menuRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversationId = conversation?.id ?? null;

  // True while the agent hasn't scrolled away from the bottom. Only then do we
  // follow new messages / content growth; otherwise the view stays put.
  const pinnedToBottomRef = useRef(true);

  const unseenCountRef = useRef(0);

  unseenCountRef.current = unseenCount;

  // Ids (and client ids) of every message we have already seen, so a message
  // that arrives through realtime AND catch-up is only counted once, and our
  // own optimistic sends are never counted as "new".
  const knownMessagesRef = useRef<Set<string>>(new Set());

  const lastSearchScrollKeyRef = useRef("");

  const scrollToEnd = useCallback((smooth = true) => {
    const node = scrollRef.current;

    if (!node) return;

    node.scrollTo({
      top: node.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const rememberMessages = useCallback((list: Message[]) => {
    for (const message of list) {
      knownMessagesRef.current.add(message.id);

      if (message.clientMessageId)
        knownMessagesRef.current.add(message.clientMessageId);
    }
  }, []);

  // Returns only the messages we haven't seen before, and remembers them.
  const takeArrivals = useCallback(
    (list: Message[]): Message[] => {
      const fresh = list.filter(
        (message) =>
          !knownMessagesRef.current.has(message.id) &&
          !(
            message.clientMessageId &&
            knownMessagesRef.current.has(message.clientMessageId)
          ),
      );

      rememberMessages(fresh);

      return fresh;
    },
    [rememberMessages],
  );

  // New messages: follow them only if the agent is at the bottom. If they are
  // reading higher up (or searching), don't move — count them and mark where
  // the new messages start instead.
  const handleArrivals = useCallback(
    (added: Message[]) => {
      if (added.length === 0) return;

      if (pinnedToBottomRef.current) {
        window.setTimeout(() => scrollToEnd(), 20);

        return;
      }

      if (unseenCountRef.current === 0) setDividerId(added[0].id);

      unseenCountRef.current += added.length;
      setUnseenCount((current) => current + added.length);
    },
    [scrollToEnd],
  );

  const jumpToLatest = () => {
    pinnedToBottomRef.current = true;
    setUnseenCount(0);
    scrollToEnd();
  };

  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) scrollToEnd(false);
    });

    return () => resizeObserverRef.current?.disconnect();
  }, [scrollToEnd]);

  const messageListContentRef = useCallback((node: HTMLDivElement | null) => {
    const observer = resizeObserverRef.current;

    if (!observer) return;

    observer.disconnect();

    if (node) observer.observe(node);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) return;

    const updatePinned = () => {
      const distanceFromBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight;

      const near = distanceFromBottom <= NEAR_BOTTOM_PX;

      pinnedToBottomRef.current = near;
      setShowJump(distanceFromBottom > FAR_FROM_BOTTOM_PX);

      // Back at the bottom: the new messages have been seen.
      if (near) {
        unseenCountRef.current = 0;
        setUnseenCount((current) => (current === 0 ? current : 0));
      }
    };

    node.addEventListener("scroll", updatePinned, { passive: true });

    return () => node.removeEventListener("scroll", updatePinned);
  }, [conversationId, activeTab]);

  // Coming back to the Messages tab lands on the latest message.
  useEffect(() => {
    if (activeTab !== "messages") return;

    pinnedToBottomRef.current = true;
    unseenCountRef.current = 0;
    setUnseenCount(0);

    const timer = window.setTimeout(() => scrollToEnd(false), 30);

    return () => window.clearTimeout(timer);
  }, [activeTab, scrollToEnd]);

  const onConversationChangeRef = useRef(onConversationChange);

  onConversationChangeRef.current = onConversationChange;

  const conversationRef = useRef(conversation);

  conversationRef.current = conversation;

  const agentRef = useRef(agent);

  agentRef.current = agent;

  const markReadTimer = useRef<number | null>(null);

  const catchUpTimer = useRef<number | null>(null);

  const scheduleMarkRead = useCallback((id: string) => {
    if (markReadTimer.current) window.clearTimeout(markReadTimer.current);

    markReadTimer.current = window.setTimeout(() => {
      markReadTimer.current = null;
      void api.markConversationRead(id).catch(() => undefined);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (markReadTimer.current) window.clearTimeout(markReadTimer.current);

      if (catchUpTimer.current) window.clearTimeout(catchUpTimer.current);
    };
  }, [conversationId]);

  useEffect(() => {
    setMenuOpen(false);
    setBlockModalOpen(false);
    setPendingDelete(false);
    setPendingClear(false);
    setActiveTab("messages");
    setSearchOpen(false);
    setSearchQuery("");
    setSearchActiveIndex(0);
    setLeadModalOpen(false);
    setRenameModalOpen(false);
    setRenameDraft("");
    setUnseenCount(0);
    setDividerId(null);
    setShowJump(false);
    unseenCountRef.current = 0;
    knownMessagesRef.current = new Set();
    lastSearchScrollKeyRef.current = "";
  }, [conversationId]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);

      return;
    }

    const controller = new AbortController();

    pinnedToBottomRef.current = true;
    knownMessagesRef.current = new Set();
    setLoading(true);
    setFailure(null);
    setDraft("");
    setMessages([]);

    api
      .messages(conversationId, { markRead: true, signal: controller.signal })
      .then((list) => {
        // The initial thread is not "new".
        rememberMessages(list);
        setMessages((prev) => mergeMessages(prev, list));
        window.setTimeout(() => scrollToEnd(false), 30);

        const current = conversationRef.current;

        if (
          current &&
          current.id === conversationId &&
          (current.unreadCount ?? 0) > 0
        ) {
          onConversationChangeRef.current({ ...current, unreadCount: 0 });
        }
      })
      .catch((error) => {
        if ((error as Error)?.name === "AbortError") return;

        setFailure(errorKey(error));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [conversationId, scrollToEnd, rememberMessages]);

  useEffect(() => {
    if (!conversationId) return;

    const controller = new AbortController();

    api
      .conversation(conversationId, controller.signal)
      .then((fresh) => {
        const current = conversationRef.current;

        if (current && current.id === conversationId) {
          onConversationChangeRef.current({ ...current, ...fresh });
        }
      })
      .catch((error) => {
        if ((error as Error)?.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [conversationId]);

  const catchUp = useCallback(
    async (id: string) => {
      try {
        const [list, fresh] = await Promise.all([
          api.messages(id),
          api.conversation(id),
        ]);

        if (conversationRef.current?.id !== id) return;

        onConversationChangeRef.current({
          ...conversationRef.current,
          ...fresh,
        });

        const added = takeArrivals(list);

        setMessages((prev) => mergeMessages(prev, list));

        handleArrivals(added);

        const addedInbound = added.some(
          (message) => message.direction === "inbound",
        );

        if (!addedInbound) return;

        const current = conversationRef.current;

        if (current && (current.unreadCount ?? 0) !== 0) {
          onConversationChangeRef.current({ ...current, unreadCount: 0 });
        }

        scheduleMarkRead(id);
      } catch {
        /* keep the thread we already have */
      }
    },
    [takeArrivals, handleArrivals, scheduleMarkRead],
  );

  const scheduleCatchUp = useCallback(
    (id: string) => {
      if (catchUpTimer.current) window.clearTimeout(catchUpTimer.current);

      catchUpTimer.current = window.setTimeout(() => {
        catchUpTimer.current = null;
        void catchUp(id);
      }, 200);
    },
    [catchUp],
  );

  const onRealtimeEvent = useCallback(
    (payload: unknown) => {
      const event = payload as RealtimeEvent | null;

      const current = conversationRef.current;

      if (!event || typeof event.event !== "string" || !current) return;

      if (event.event === "message.created") {
        const message = messageFromRealtime(event);

        if (!message) {
          scheduleCatchUp(current.id);

          return;
        }

        if (message.conversationId && message.conversationId !== current.id)
          return;

        const incoming = { ...message, conversationId: current.id };

        const added = takeArrivals([incoming]);

        setMessages((prev) => mergeMessages(prev, [incoming]));

        // Follows the message only when the agent is at the bottom.
        handleArrivals(added);

        if (message.direction === "inbound") {
          if ((current.unreadCount ?? 0) !== 0) {
            onConversationChangeRef.current({ ...current, unreadCount: 0 });
          }

          scheduleMarkRead(current.id);
        }

        return;
      }

      if (event.event === "conversation.upserted") {
        const upsertedId = event.id ?? event.conversationId;

        if (upsertedId == null || String(upsertedId) !== current.id) return;

        scheduleCatchUp(current.id);

        return;
      }

      if (event.event === "message.status") {
        if (
          event.conversationId != null &&
          String(event.conversationId) !== current.id
        )
          return;

        const status = event.status as Message["status"] | undefined;

        const id = event.id as string | undefined;

        if (!status || !id) return;

        setMessages((prev) =>
          prev.map((message) =>
            message.id === id &&
            Number(event.deliveryVersion ?? 0) >= (message.deliveryVersion ?? 0)
              ? ({ ...message, ...event, id, status } as Message)
              : message,
          ),
        );

        return;
      }

      if (event.event === "conversation.window") {
        if (String(event.id) !== current.id) return;

        onConversationChangeRef.current({
          ...current,
          lastCustomerMessageAt: event.lastCustomerMessageAt as string | null,
          serviceWindowExpiresAt: event.serviceWindowExpiresAt as string | null,
          serviceWindowOpen: event.serviceWindowOpen as boolean | null,
        });

        return;
      }

      if (event.event === "conversation.assigned") {
        if (event.conversationId !== current.id) return;

        const nextAssigneeId =
          (event.assigneeId as string | null | undefined) ?? null;

        const agentNow = agentRef.current;

        onConversationChangeRef.current({
          ...current,
          mode: (event.mode as Conversation["mode"]) ?? current.mode,
          assigneeId: nextAssigneeId,
          assignee:
            nextAssigneeId && agentNow && nextAssigneeId === agentNow.id
              ? { id: agentNow.id, name: agentNow.name, email: agentNow.email }
              : null,
        });

        if (nextAssigneeId && nextAssigneeId !== agentNow?.id) {
          void api
            .conversation(current.id)
            .then((fresh) => {
              if (conversationRef.current?.id === current.id) {
                onConversationChangeRef.current({
                  ...conversationRef.current,
                  assignee: fresh.assignee ?? null,
                });
              }
            })
            .catch(() => undefined);
        }

        return;
      }

      if (event.event === "conversation.blocked") {
        if (event.conversationId !== current.id) return;

        onConversationChangeRef.current({
          ...current,
          blocked: Boolean(event.blocked),
          whatsappStatus:
            (event.whatsappStatus as Conversation["whatsappStatus"]) ?? null,
        });

        return;
      }

      if (event.event === "conversation.renamed") {
        if (event.id !== current.id) return;

        onConversationChangeRef.current({
          ...current,
          customerName:
            (event.customerName as string | null | undefined) ?? null,
          metaCustomerName:
            (event.metaCustomerName as string | null | undefined) ?? null,
          nameOverridden: Boolean(event.nameOverridden),
        });
      }
    },
    [takeArrivals, handleArrivals, scheduleMarkRead, scheduleCatchUp],
  );

  const socketTopics = useMemo(
    () =>
      conversationId
        ? [`/topic/conversation/${conversationId}`, "/topic/inbox"]
        : [],
    [conversationId],
  );

  const connectionState: ConnectionState = useRealtime({
    topics: socketTopics,
    onEvent: onRealtimeEvent,
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (!conversationId || connectionState !== "connected" || loading) return;

    scheduleCatchUp(conversationId);
  }, [conversationId, connectionState, loading, scheduleCatchUp]);

  usePoll(
    () => {
      if (conversationId) void catchUp(conversationId);
    },
    2500,
    Boolean(conversationId) && connectionState !== "connected",
  );

  const mine = Boolean(
    conversation?.assigneeId && conversation.assigneeId === agent?.id,
  );

  const blocked = Boolean(conversation?.blocked);

  const canReply = conversation?.mode === "agent" && mine && !blocked;

  const [windowNow, setWindowNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setWindowNow(Date.now()), 30000);

    return () => window.clearInterval(timer);
  }, []);
  const windowClosed =
    conversation?.serviceWindowOpen === false ||
    Boolean(
      conversation?.serviceWindowExpiresAt &&
        new Date(conversation.serviceWindowExpiresAt).getTime() <= windowNow,
    );

  const assigneeName =
    conversation?.assignee?.name?.trim() ||
    conversation?.assignee?.email ||
    null;

  const lockedReason =
    conversation == null
      ? null
      : blocked
        ? t("chat.inputLockedBlocked")
        : conversation.mode !== "agent"
          ? t("chat.inputLockedBot")
          : !mine
            ? canManageUsers && assigneeName
              ? t("chat.inputLockedOtherNamed", { name: assigneeName })
              : t("chat.inputLockedOther")
            : null;

  const phoneForBlockLookup = conversation?.phone ?? null;

  useEffect(() => {
    if (!blocked || !phoneForBlockLookup) {
      setBlockedEntryId(null);

      return;
    }

    let cancelled = false;

    const controller = new AbortController();

    adminApi
      .listBlockedNumbers("blocked", phoneForBlockLookup, controller.signal)
      .then((entries) => {
        if (!cancelled) setBlockedEntryId(entries[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setBlockedEntryId(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [blocked, phoneForBlockLookup]);

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();

  const searchMatches = useMemo(() => {
    if (!trimmedSearchQuery) return [];

    return messages
      .filter((message) =>
        message.text?.toLowerCase().includes(trimmedSearchQuery),
      )
      .map((message) => message.id);
  }, [messages, trimmedSearchQuery]);

  // Jump to the last match only when the QUERY changes — not every time a new
  // matching message arrives (that would yank the view while reading).
  useEffect(() => {
    setSearchActiveIndex(
      searchMatches.length > 0 ? searchMatches.length - 1 : 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedSearchQuery]);

  // Scroll ONLY the message list, and only when the query or the active match
  // actually changed. Incoming messages / status updates re-create
  // `searchMatches`, which must not re-scroll the view.
  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) {
      lastSearchScrollKeyRef.current = "";

      return;
    }

    const id = searchMatches[searchActiveIndex];

    const key = `${trimmedSearchQuery}|${searchActiveIndex}|${id}`;

    if (key === lastSearchScrollKeyRef.current) return;

    lastSearchScrollKeyRef.current = key;

    const node = id ? messageRefs.current.get(id) : undefined;

    const container = scrollRef.current;

    if (!node || !container) return;

    const containerRect = container.getBoundingClientRect();

    const nodeRect = node.getBoundingClientRect();

    const top =
      container.scrollTop +
      (nodeRect.top - containerRect.top) -
      container.clientHeight / 2 +
      node.clientHeight / 2;

    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [searchOpen, searchMatches, searchActiveIndex, trimmedSearchQuery]);

  const goToPreviousMatch = () => {
    if (searchMatches.length === 0) return;

    setSearchActiveIndex(
      (current) => (current - 1 + searchMatches.length) % searchMatches.length,
    );
  };

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;

    setSearchActiveIndex((current) => (current + 1) % searchMatches.length);
  };

  const closeSearch = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setSearchOpen(false);
    setSearchQuery("");
  };

  function highlightMatches(
    text: string,
    isActiveMatch: boolean,
  ): React.ReactNode {
    if (!trimmedSearchQuery) return text;

    const lowerText = text.toLowerCase();

    const parts: React.ReactNode[] = [];

    let cursor = 0;

    let index = lowerText.indexOf(trimmedSearchQuery);

    if (index === -1) return text;

    let key = 0;

    while (index !== -1) {
      if (index > cursor) parts.push(text.slice(cursor, index));

      parts.push(
        <mark
          key={key++}
          className={cn(
            "rounded-sm px-0.5",
            isActiveMatch
              ? "bg-amber-400 text-ink-900"
              : "bg-amber-200/70 text-ink-900",
          )}
        >
          {text.slice(index, index + trimmedSearchQuery.length)}
        </mark>,
      );

      cursor = index + trimmedSearchQuery.length;
      index = lowerText.indexOf(trimmedSearchQuery, cursor);
    }

    if (cursor < text.length) parts.push(text.slice(cursor));

    return parts;
  }

  function renderMessageText(
    text: string,
    isActiveMatch: boolean,
    outbound: boolean,
  ): React.ReactNode {
    const nodes: React.ReactNode[] = [];

    let last = 0;

    let key = 0;

    for (const match of text.matchAll(URL_REGEX)) {
      const index = match.index ?? 0;

      const trailing = match[0].match(TRAILING_PUNCTUATION)?.[0] ?? "";

      const url = match[0].slice(0, match[0].length - trailing.length);

      if (!url) continue;

      if (index > last) {
        nodes.push(
          <Fragment key={key++}>
            {highlightMatches(text.slice(last, index), isActiveMatch)}
          </Fragment>,
        );
      }

      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className={cn(
            "break-all underline underline-offset-2 [unicode-bidi:isolate]",
            outbound
              ? "text-white hover:text-brand-100"
              : "text-brand-600 hover:text-brand-700 dark:text-brand-300",
          )}
        >
          {highlightMatches(url, isActiveMatch)}
        </a>,
      );

      last = index + url.length;
    }

    if (last < text.length) {
      nodes.push(
        <Fragment key={key++}>
          {highlightMatches(text.slice(last), isActiveMatch)}
        </Fragment>,
      );
    }

    return nodes;
  }

  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recording, setRecording] = useState(false);

  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const recordedChunksRef = useRef<Blob[]>([]);

  const streamRef = useRef<MediaStream | null>(null);

  const releaseRecordingRef = useRef<(() => void) | null>(null);

  const voiceBusyRef = useRef(false);

  const recordTimerRef = useRef<number | null>(null);

  const recordShouldSendRef = useRef(true);

  const recordingSupported =
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopRecordTimer = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const releaseMic = () => {
    releaseRecordingRef.current?.();
    releaseRecordingRef.current = null;
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (
      !canReply ||
      recording ||
      uploading ||
      voiceBusyRef.current ||
      !recordingSupported
    )
      return;

    if (!window.isSecureContext) {
      push("Microphone needs HTTPS", "error");

      return;
    }

    const format = pickVoiceRecordFormat((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    );

    if (!format) {
      push(t("chat.recordingUnsupported"), "error");

      return;
    }

    const voiceContext = primeVoiceContext();

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      void voiceContext?.close();
      const name = (err as DOMException)?.name ?? "unknown";

      console.error("getUserMedia failed:", name, err);

      push(
        name === "NotAllowedError" || name === "SecurityError"
          ? `${t("chat.micDenied")} (${name})`
          : name === "NotFoundError"
            ? "No microphone found on this device"
            : name === "NotReadableError"
              ? "Microphone is being used by another app"
              : `Microphone error: ${name}`,
        "error",
      );

      return;
    }

    try {
      const opened = await createVoiceRecorder(
        stream,
        format.mimeType,
        voiceContext,
      );

      streamRef.current = stream;
      releaseRecordingRef.current = opened.release;
      recordedChunksRef.current = [];
      recordShouldSendRef.current = true;

      const recorder = opened.recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        releaseMic();
        stopRecordTimer();

        const shouldSend = recordShouldSendRef.current;

        const chunks = recordedChunksRef.current;

        recordedChunksRef.current = [];
        setRecording(false);
        setRecordSeconds(0);

        if (!shouldSend || chunks.length === 0) return;

        voiceBusyRef.current = true;

        void (async () => {
          try {
            const file = await voiceFileFromChunks(chunks, format.container);

            await sendFileRef.current(file);
          } catch (error) {
            console.error("Voice encode failed:", error);
            push(t("chat.recordingUnsupported"), "error");
          } finally {
            voiceBusyRef.current = false;
          }
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(
        () => setRecordSeconds((seconds) => seconds + 1),
        1000,
      );
    } catch (err) {
      console.error("MediaRecorder failed:", err);
      releaseMic();
      push(t("chat.recordingUnsupported"), "error");
    }
  };

  const finishRecording = (send: boolean) => {
    recordShouldSendRef.current = send;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      releaseMic();
      stopRecordTimer();
      setRecording(false);
      setRecordSeconds(0);
    }
  };

  useEffect(() => {
    return () => {
      stopRecordTimer();
      releaseMic();
    };
  }, []);

  function formatRecordTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);

    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  // The agent sending something always follows it to the bottom.
  const followOwnMessage = () => {
    pinnedToBottomRef.current = true;
    unseenCountRef.current = 0;
    setUnseenCount(0);
    setDividerId(null);
    window.setTimeout(() => scrollToEnd(), 20);
  };

  const send = async () => {
    const text = draft.trim();

    if (!conversationId || !text || sending || !conversation) return;

    const clientMessageId = uuid();

    const sentAt = new Date().toISOString();

    const optimistic: Message = {
      id: `local-${clientMessageId}`,
      conversationId,
      direction: "outbound",
      source: "agent",
      type: "text",
      text,
      mediaId: null,
      mediaUrl: null,
      mimeType: null,
      filename: null,
      status: "pending",
      wamid: null,
      clientMessageId,
      createdAt: sentAt,
      optimistic: true,
    };

    rememberMessages([optimistic]);
    setMessages((current) => mergeMessages(current, [optimistic]));
    setDraft("");
    setSending(true);
    followOwnMessage();

    onConversationChangeRef.current({
      ...conversation,
      preview: text,
      lastMessageAt: sentAt,
    });

    try {
      const saved = await api.sendMessage(
        conversationId,
        { type: "text", text },
        clientMessageId,
      );

      rememberMessages([saved]);
      setMessages((current) =>
        mergeMessages(current, [
          { ...optimistic, ...saved, optimistic: false },
        ]),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, status: "failed", optimistic: false }
            : message,
        ),
      );
      push(t(errorKey(error)), "error");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const sendRef = useRef(send);

  sendRef.current = send;

  useEffect(() => {
    const node = textareaRef.current;

    if (!node) return;

    const onBeforeInput = (event: Event) => {
      const input = event as InputEvent;

      if (input.inputType !== "insertLineBreak") return;

      event.preventDefault();
      void sendRef.current();
    };

    node.addEventListener("beforeinput", onBeforeInput);

    return () => node.removeEventListener("beforeinput", onBeforeInput);
  }, [conversationId, canReply, recording, activeTab, blocked, lockedReason]);

  const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

  function mediaTypeOf(
    mimeType: string,
  ): "image" | "audio" | "video" | "document" {
    if (mimeType.startsWith("image/")) return "image";

    if (mimeType.startsWith("audio/")) return "audio";

    if (mimeType.startsWith("video/")) return "video";

    return "document";
  }

  const sendFile = async (file: File) => {
    if (!conversationId || !conversation || uploading) return;

    if (file.size > MAX_MEDIA_BYTES) {
      push(t("chat.mediaTooLarge"), "error");

      return;
    }

    const clientMessageId = uuid();

    const sentAt = new Date().toISOString();

    const type = mediaTypeOf(file.type || "application/octet-stream");

    const optimistic: Message = {
      id: `local-${clientMessageId}`,
      conversationId,
      direction: "outbound",
      source: "agent",
      type,
      text: null,
      mediaId: null,
      mediaUrl: null,
      mimeType: file.type || null,
      filename: file.name,
      status: "pending",
      wamid: null,
      clientMessageId,
      createdAt: sentAt,
      optimistic: true,
    };

    rememberMessages([optimistic]);
    setMessages((current) => mergeMessages(current, [optimistic]));
    setUploading(true);
    followOwnMessage();

    onConversationChangeRef.current({
      ...conversation,
      preview: t(`chat.mediaPreview.${type}`),
      lastMessageAt: sentAt,
    });

    try {
      const uploaded = await api.uploadMedia(file);

      const saved = await api.sendMessage(
        conversationId,
        { type, mediaId: uploaded.mediaId },
        clientMessageId,
      );

      rememberMessages([saved]);
      setMessages((current) =>
        mergeMessages(current, [
          { ...optimistic, ...saved, optimistic: false },
        ]),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, status: "failed", optimistic: false }
            : message,
        ),
      );
      push(t(errorKey(error)), "error");
    } finally {
      setUploading(false);

      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendFileRef = useRef(sendFile);

  sendFileRef.current = sendFile;

  const changeMode = async (action: "takeover" | "handoff") => {
    if (!conversationId || modeBusy || !canChangeMode) return;

    setModeBusy(true);

    try {
      const updated =
        action === "takeover"
          ? await api.takeover(conversationId)
          : await api.handoffToAi(conversationId);

      onConversationChange(updated);

      if (action === "takeover") textareaRef.current?.focus();
    } catch (error) {
      push(t(errorKey(error)), "error");
    } finally {
      setModeBusy(false);
    }
  };

  const submitBlock = async ({
    phone,
    reason,
  }: {
    phone: string;
    reason?: string | null;
  }) => {
    if (!conversation) return;

    try {
      await adminApi.blockNumber({ phone, reason });
      onConversationChange({
        ...conversation,
        blocked: true,
        whatsappStatus: "pending",
      });
      push(t("chat.blockedContact"), "success");
      setBlockModalOpen(false);
      setMenuOpen(false);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    }
  };

  const handleUnblock = async () => {
    if (!conversation || !blockedEntryId || unblocking) return;

    setUnblocking(true);

    try {
      await adminApi.unblockNumber(blockedEntryId);

      onConversationChange({
        ...conversation,
        blocked: false,
        whatsappStatus: "unblocked",
      });
      setBlockedEntryId(null);
      push(t("chat.contactUnblocked"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setUnblocking(false);
    }
  };

  const handleToggleHide = async () => {
    if (!conversationId || !conversation || hideBusy) return;

    const hide = !conversation.hidden;

    setHideBusy(true);
    setMenuOpen(false);

    try {
      if (onToggleHide) {
        await onToggleHide(conversationId, hide);
      } else {
        const updated = hide
          ? await api.hideConversation(conversationId)
          : await api.unhideConversation(conversationId);

        onConversationChange(updated);
        push(
          t(hide ? "chat.conversationHidden" : "chat.conversationUnhidden"),
          "success",
        );
      }

      if (hide) onBack?.();
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setHideBusy(false);
    }
  };

  const submitLead = async (payload: {
    conversationId: string;
    serviceId: number;
    note?: string;
  }) => {
    try {
      await api.createLead(payload);
      push(t("chat.leadAdded"), "success");
      setLeadModalOpen(false);
      setMenuOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        push(t("chat.leadAlreadyOpen"), "error");
      } else {
        push(errorDetail(error) ?? t(errorKey(error)), "error");
      }

      throw error;
    }
  };

  const confirmClear = async () => {
    if (!conversationId || !conversation) return;

    try {
      await api.clearConversationMessages(conversationId);
      setMessages([]);
      setUnseenCount(0);
      setDividerId(null);
      onConversationChange({
        ...conversation,
        preview: null,
        lastMessageId: null,
      });
      push(t("chat.messagesCleared"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setMenuOpen(false);
    }
  };

  const openRenameModal = () => {
    if (!conversation) return;

    setRenameDraft(conversation.customerName ?? "");
    setRenameModalOpen(true);
  };

  const submitRename = async (name: string) => {
    if (!conversationId || !conversation || renaming) return;

    setRenaming(true);

    try {
      const updated = await api.renameConversation(conversationId, name.trim());

      onConversationChange(updated);
      push(t(name.trim() ? "chat.nameUpdated" : "chat.nameReset"), "success");
      setRenameModalOpen(false);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setRenaming(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
          title={t("inbox.selectHint")}
        />
      </div>
    );
  }

  let lastDay = "";

  const showJumpButton = showJump || unseenCount > 0;

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white dark:bg-ink-800 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-30"
      style={
        visualViewport
          ? { height: visualViewport.height, top: visualViewport.top }
          : undefined
      }
    >
      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-ink-200 p-3 dark:border-ink-700 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("chat.back")}
              title={t("chat.back")}
              className="btn-ghost -ms-1 flex-shrink-0 p-2 lg:hidden"
            >
              {dir === "rtl" ? (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : null}
          <Avatar name={conversation.customerName} seed={conversation.phone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p
                dir={textDirOf(conversation.customerName)}
                className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50"
              >
                {conversation.customerName?.trim() || conversation.phone}
              </p>
              <button
                type="button"
                onClick={openRenameModal}
                className="btn-ghost h-6 w-6 flex-shrink-0 p-0"
                aria-label={t("chat.renameContact")}
                title={t("chat.renameContact")}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p
              className="truncate text-xs text-ink-500 dark:text-ink-400"
              dir="ltr"
            >
              {conversation.phone}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 ps-1 lg:ms-auto lg:flex-nowrap lg:ps-0">
          <ModeBadge mode={conversation.mode} />

          {blocked ? (
            <span
              className="badge bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
              title={t("chat.blockedBadgeHint")}
            >
              <ShieldOff className="h-3 w-3" aria-hidden="true" />
              {t(
                conversation.whatsappStatus === "blocked"
                  ? "chat.blockedBadge"
                  : conversation.whatsappStatus === "failed" ||
                      conversation.whatsappStatus === "unblocked"
                    ? "chat.blockedBadgeLocalOnly"
                    : "chat.blockedBadgePending",
              )}
            </span>
          ) : null}

          {connectionState !== "connected" ? (
            <span
              className="flex items-center gap-1 text-[11px] text-ink-400"
              title={t(
                connectionState === "connecting"
                  ? "chat.reconnecting"
                  : "chat.offlinePolling",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              {t(
                connectionState === "connecting"
                  ? "chat.reconnecting"
                  : "chat.offlinePolling",
              )}
            </span>
          ) : null}

          {!canChangeMode ? null : conversation.mode === "agent" && mine ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => changeMode("handoff")}
              disabled={modeBusy}
            >
              {modeBusy ? (
                <Spinner />
              ) : (
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              )}
              {modeBusy ? t("chat.handingOff") : t("chat.handoff")}
            </button>
          ) : conversation.mode !== "agent" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => changeMode("takeover")}
              disabled={modeBusy}
            >
              {modeBusy ? (
                <Spinner />
              ) : (
                <Headphones className="h-4 w-4" aria-hidden="true" />
              )}
              {modeBusy ? t("chat.takingOver") : t("chat.takeover")}
            </button>
          ) : null}

          <button
            type="button"
            className="btn-secondary px-2.5"
            onClick={() => {
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
            aria-pressed={searchOpen}
            aria-label={t("chat.search")}
            title={t("chat.search")}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="btn-secondary px-2.5"
            onClick={() => setLeadModalOpen(true)}
            aria-label={t("chat.addLead")}
            title={t("chat.addLead")}
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{t("chat.addLead")}</span>
          </button>

          {canManageUsers ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="btn-secondary px-2.5"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t("chat.moreActions")}
                title={t("chat.moreActions")}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute end-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={blocked}
                    onClick={() => {
                      setBlockModalOpen(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-200 dark:hover:bg-ink-700"
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    {blocked
                      ? t("chat.contactAlreadyBlocked")
                      : t("chat.blockContact")}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={hideBusy}
                    onClick={() => void handleToggleHide()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-200 dark:hover:bg-ink-700"
                  >
                    {hideBusy ? (
                      <Spinner />
                    ) : conversation.hidden ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t(
                      conversation.hidden
                        ? "chat.unhideConversation"
                        : "chat.hideConversation",
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPendingClear(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
                  >
                    <Eraser className="h-4 w-4" aria-hidden="true" />
                    {t("chat.clearMessages")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div
        role="tablist"
        className="flex flex-shrink-0 gap-1 border-b border-ink-200 bg-white px-3 pt-2 dark:border-ink-700 dark:bg-ink-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "messages"}
          onClick={() => setActiveTab("messages")}
          className={cn(
            "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition",
            activeTab === "messages"
              ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300"
              : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {t("chat.tabMessages")}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "media"}
          onClick={() => setActiveTab("media")}
          className={cn(
            "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition",
            activeTab === "media"
              ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300"
              : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t("chat.tabMedia")}
        </button>

        {canManageUsers ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition",
              activeTab === "activity"
                ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300"
                : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
            )}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {t("chat.tabActivity")}
          </button>
        ) : null}
      </div>

      {searchOpen && activeTab === "messages" ? (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-ink-200 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-800">
          <Search
            className="h-4 w-4 flex-shrink-0 text-ink-400"
            aria-hidden="true"
          />
          <input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();

                if (event.shiftKey) goToPreviousMatch();
                else goToNextMatch();
              }

              if (event.key === "Escape") closeSearch();
            }}
            placeholder={t("chat.searchPlaceholder")}
            aria-label={t("chat.searchPlaceholder")}
            className="input h-8 flex-1 py-1 text-base lg:text-sm"
          />
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-ink-400">
            {trimmedSearchQuery
              ? searchMatches.length > 0
                ? t("chat.searchResultCount", {
                    current: searchActiveIndex + 1,
                    total: searchMatches.length,
                  })
                : t("chat.searchNoResults")
              : null}
          </span>
          <button
            type="button"
            className="btn-ghost h-8 w-8 flex-shrink-0 p-0"
            onClick={goToPreviousMatch}
            disabled={searchMatches.length === 0}
            aria-label={t("chat.searchPrevious")}
            title={t("chat.searchPrevious")}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 flex-shrink-0 p-0"
            onClick={goToNextMatch}
            disabled={searchMatches.length === 0}
            aria-label={t("chat.searchNext")}
            title={t("chat.searchNext")}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 flex-shrink-0 p-0"
            onClick={closeSearch}
            aria-label={t("chat.searchClose")}
            title={t("chat.searchClose")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {windowClosed && canReply ? (
        <p
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("chat.windowClosedAuto")}
        </p>
      ) : null}

      {activeTab === "activity" ? (
        <ActivityPanel
          conversationId={conversation.id}
          active={activeTab === "activity"}
        />
      ) : activeTab === "media" ? (
        <MediaTab messages={messages} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
          >
            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "skeleton h-12",
                      index % 2 === 0 ? "me-auto w-2/3" : "ms-auto w-1/2",
                    )}
                  />
                ))}
              </div>
            ) : failure ? (
              <EmptyState
                icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
                title={t(failure)}
              />
            ) : messages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
                title={t("chat.emptyThread")}
              />
            ) : (
              <div ref={messageListContentRef}>
                {messages.map((message) => {
                  const outbound = message.direction === "outbound";

                  const StatusIcon = statusIcon(message.status);

                  const queueLabel =
                    message.queueState === "waiting_for_customer"
                      ? t(
                          message.relatedTemplateMessageId
                            ? "chat.waitingWithTemplate"
                            : "chat.waitingForCustomer",
                        )
                      : message.queueState === "resending"
                        ? t("chat.autoResending")
                        : message.queueState === "expired"
                          ? t("chat.queueExpired")
                          : message.queueState === "uncertain"
                            ? t("chat.sendUncertain")
                            : null;

                  const agentKey =
                    message.source === "agent" ? agentKeyOf(message) : null;

                  const fromMe =
                    agentKey !== null &&
                    (agentKey === agent?.id ||
                      agentKey === agent?.name ||
                      agentKey === agent?.email);

                  const tint =
                    outbound &&
                    agentKey &&
                    !fromMe &&
                    message.status !== "failed"
                      ? colorFromString(agentKey)
                      : null;

                  const diff = daysAgo(message.createdAt);

                  const dayLabel =
                    diff === 0
                      ? t("chat.today")
                      : diff === 1
                        ? t("chat.yesterday")
                        : new Date(message.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          );

                  const showDay = dayLabel !== lastDay;

                  lastDay = dayLabel;

                  const isActiveSearchMatch =
                    trimmedSearchQuery.length > 0 &&
                    searchMatches[searchActiveIndex] === message.id;

                  const isSearchMatch =
                    trimmedSearchQuery.length > 0 &&
                    searchMatches.includes(message.id);

                  const isVisualMedia =
                    (message.type === "image" || message.type === "video") &&
                    Boolean(message.mediaId);

                  return (
                    <div
                      key={message.id}
                      id={`message-${message.id}`}
                      ref={(node) => {
                        if (node) messageRefs.current.set(message.id, node);
                        else messageRefs.current.delete(message.id);
                      }}
                    >
                      {showDay ? (
                        <p className="my-4 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400">
                          {dayLabel}
                        </p>
                      ) : null}

                      {/* {message.id === dividerId ? (
                        <div
                          role="separator"
                          className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300"
                        >
                          <span className="h-px flex-1 bg-brand-200 dark:bg-brand-800" />
                          <span>{t("chat.newMessagesDivider")}</span>
                          <span className="h-px flex-1 bg-brand-200 dark:bg-brand-800" />
                        </div>
                      ) : null} */}

                      <div
                        className={cn(
                          "flex py-1",
                          outbound ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          style={tint ? { backgroundColor: tint } : undefined}
                          title={
                            message.status === "failed" && message.errorReason
                              ? message.errorReason
                              : undefined
                          }
                          className={cn(
                            "max-w-[85%] animate-fade-in rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                            isVisualMedia && "w-full",
                            outbound
                              ? cn(
                                  "bubble-out text-white",
                                  !tint && "bg-brand-600",
                                )
                              : "bubble-in bg-white text-ink-800 dark:bg-ink-800 dark:text-ink-100",
                            message.status === "failed" && "bg-rose-600",
                            isSearchMatch && "ring-2 ring-amber-400",
                            isActiveSearchMatch && "ring-2 ring-amber-500",
                          )}
                        >
                          {outbound && agentKey && !fromMe ? (
                            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-white/90">
                              <UserRound
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              {message.agentName?.trim() ||
                                t("chat.otherAgent")}
                            </p>
                          ) : null}

                          {message.source === "bot" ||
                          (outbound && message.source !== "agent") ? (
                            <p
                              className={cn(
                                "mb-1 flex items-center gap-1 text-[11px] font-medium",
                                outbound ? "text-brand-100" : "text-ink-400",
                              )}
                            >
                              <Bot className="h-3 w-3" aria-hidden="true" />
                              {t(
                                message.type === "template"
                                  ? "chat.autoTemplate"
                                  : "chat.bot",
                              )}
                            </p>
                          ) : null}

                          <MessageMedia message={message} outbound={outbound} />

                          <MessageTapHint
                            message={message}
                            outbound={outbound}
                          />

                          {RICH_TYPES.has(message.type) ? (
                            <MessageRichContent
                              message={message}
                              outbound={outbound}
                            />
                          ) : message.text ||
                            (!message.mediaId && !message.filename) ? (
                            <p
                              dir={textDirOf(message.text)}
                              className="whitespace-pre-wrap break-words"
                            >
                              {message.text
                                ? renderMessageText(
                                    message.text,
                                    isActiveSearchMatch,
                                    outbound,
                                  )
                                : `[${message.type}]`}
                            </p>
                          ) : null}

                          {queueLabel ? (
                            <p
                              role="status"
                              className="mt-1 text-[11px] text-white/90"
                            >
                              {queueLabel}
                            </p>
                          ) : null}
                          {message.queueState &&
                          message.relatedTemplateMessageId ? (
                            <a
                              className="mt-1 block text-[11px] underline"
                              href={`#message-${message.relatedTemplateMessageId}`}
                            >
                              {t("chat.viewAutoTemplate")}
                            </a>
                          ) : null}
                          {(message.status === "failed" ||
                            message.queueState === "waiting_for_customer") &&
                          message.errorReason ? (
                            <p className="mt-1 text-[11px] text-rose-100">
                              {message.errorReason}
                            </p>
                          ) : null}

                          {message.type !== "audio" ? (
                            <p
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                outbound ? "text-brand-100/90" : "text-ink-400",
                              )}
                            >
                              <span dir="ltr">
                                {formatTimeAmPm(message.createdAt)}
                              </span>

                              {outbound ? (
                                <>
                                  <StatusIcon
                                    className={cn(
                                      "h-3 w-3",
                                      statusTint(message.status),
                                    )}
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">
                                    {t(
                                      `chat.status${message.status.charAt(0).toUpperCase()}${message.status.slice(1)}`,
                                    )}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showJumpButton ? (
            <button
              type="button"
              onClick={jumpToLatest}
              aria-label={t("chat.scrollToLatest")}
              title={t("chat.scrollToLatest")}
              className="absolute bottom-3 end-4 z-10 flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2 py-2 text-xs font-medium text-ink-700 shadow-lg transition hover:bg-ink-50 dark:border-ink-600 dark:bg-ink-700 dark:text-ink-100 dark:hover:bg-ink-600"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              {unseenCount > 0 ? (
                <span className="absolute -top-2.5 right-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {unseenCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      )}

      {activeTab === "messages" ? (
        <footer className="flex-shrink-0 border-t border-ink-200 p-3 dark:border-ink-700">
          {blocked ? (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              <ShieldOff
                className="h-3.5 w-3.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{lockedReason}</span>
              <button
                type="button"
                onClick={() => void handleUnblock()}
                disabled={unblocking || !blockedEntryId}
                className="btn-ghost h-7 flex-shrink-0 px-2.5 py-0 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-900"
              >
                {unblocking ? (
                  <Spinner />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {unblocking ? t("chat.unblocking") : t("chat.unblockContact")}
              </button>
            </div>
          ) : lockedReason ? (
            <p className="rounded-xl bg-ink-100 px-3 py-2 text-center text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400">
              {lockedReason}
            </p>
          ) : recording ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => finishRecording(false)}
                className="btn-ghost h-[2.6rem] flex-shrink-0 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                aria-label={t("chat.cancelRecording")}
                title={t("chat.cancelRecording")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="input flex h-[2.6rem] flex-1 items-center gap-2.5 py-0">
                <span
                  className="relative flex h-2.5 w-2.5 flex-shrink-0"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                </span>
                <span
                  dir="ltr"
                  className="text-sm font-medium tabular-nums text-ink-700 dark:text-ink-200"
                >
                  {formatRecordTime(recordSeconds)}
                </span>
                <span className="truncate text-xs text-ink-400">
                  {t("chat.recording")}
                </span>
              </div>

              <button
                type="button"
                onClick={() => finishRecording(true)}
                className="btn-primary h-[2.6rem] flex-shrink-0 px-4"
                aria-label={t("chat.sendRecording")}
                title={t("chat.sendRecording")}
              >
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) void sendFile(file);
                }}
              />
              <button
                type="button"
                className="btn-secondary h-[2.6rem] flex-shrink-0 px-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canReply || uploading}
                aria-label={t("chat.attach")}
                title={t("chat.attach")}
              >
                {uploading ? (
                  <Spinner />
                ) : (
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <textarea
                ref={textareaRef}
                enterKeyHint="send"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={t("chat.inputPlaceholder")}
                aria-label={t("chat.inputPlaceholder")}
                disabled={!canReply}
                className="input max-h-32 text-base min-h-[2.6rem] resize-y py-2.5"
              />
              {draft.trim().length === 0 && recordingSupported ? (
                <button
                  type="button"
                  className="btn-primary h-[2.6rem] flex-shrink-0 px-4"
                  onClick={() => void startRecording()}
                  disabled={!canReply || uploading}
                  aria-label={t("chat.recordVoice")}
                  title={t("chat.recordVoice")}
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary h-[2.6rem] flex-shrink-0 px-4"
                  onClick={() => void send()}
                  disabled={
                    !canReply ||
                    sending ||
                    uploading ||
                    draft.trim().length === 0
                  }
                  aria-label={t("chat.send")}
                >
                  {sending ? (
                    <Spinner />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {sending ? t("chat.sending") : t("chat.send")}
                  </span>
                </button>
              )}
            </div>
          )}
          {lockedReason || recording ? null : (
            <p className="mt-1.5 text-[11px] text-ink-400">
              {t("chat.typingHint")}
            </p>
          )}
        </footer>
      ) : null}

      <BlockNumberFormModal
        open={blockModalOpen}
        initialPhone={conversation.phone}
        onClose={() => setBlockModalOpen(false)}
        onSubmit={submitBlock}
      />

      <LeadFormModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSubmit={submitLead}
        fixedConversation={{
          id: conversation.id,
          label: conversation.customerName?.trim() || conversation.phone,
        }}
      />

      {renameModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRenameModalOpen(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-5 shadow-xl dark:border-ink-700 dark:bg-ink-800"
          >
            <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
              {t("chat.renameContact")}
            </h3>

            {conversation.nameOverridden && conversation.metaCustomerName ? (
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                {t("chat.whatsappSays", {
                  name: conversation.metaCustomerName,
                })}
              </p>
            ) : null}

            <input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitRename(renameDraft);

                if (event.key === "Escape") setRenameModalOpen(false);
              }}
              maxLength={255}
              placeholder={t("chat.renamePlaceholder")}
              aria-label={t("chat.renameContact")}
              className="input mb-3 w-full"
            />

            <p className="mb-4 text-[11px] text-ink-400">
              {t("chat.renameHint")}
            </p>

            <div className="flex items-center justify-between gap-2">
              {conversation.nameOverridden ? (
                <button
                  type="button"
                  onClick={() => void submitRename("")}
                  disabled={renaming}
                  className="btn-ghost px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950"
                >
                  {t("chat.resetName")}
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  disabled={renaming}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void submitRename(renameDraft)}
                  disabled={renaming || renameDraft.trim().length === 0}
                  className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {renaming ? <Spinner /> : null}
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingClear}
        title={t("chat.clearMessages")}
        body={t("chat.clearMessagesBody")}
        confirmLabel={t("chat.clearMessages")}
        tone="danger"
        onConfirm={confirmClear}
        onClose={() => setPendingClear(false)}
      />
    </div>
  );
}
