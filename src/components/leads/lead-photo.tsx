"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, ImageOff, X } from "lucide-react";
import { conversationsApi } from "@/lib/features/conversations/api";
import { imageUrlOf, mediaIdOf } from "@/lib/features/leads/collected-fields";
import { useI18n } from "@/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";

function PhotoPreview({
  src,
  label,
  onClose,
}: {
  src: string;
  label: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  const { t } = useI18n();

  const closePreview = () => {
    dialog.current?.close();
    onClose();
  };

  useEffect(() => {
    const element = dialog.current;

    const overflow = document.body.style.overflow;

    element?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        closePreview();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
      className="fixed inset-0 m-auto h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-black/85 p-4 text-white backdrop:bg-black/50 open:flex sm:p-10"
    >
      <button
        type="button"
        onClick={closePreview}
        className="absolute end-4 top-4 rounded-full bg-white/15 p-2 transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* Authenticated object URLs must stay in the browser, without an image proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </dialog>
  );
}

export function LeadPhoto({ value, label }: { value: unknown; label: string }) {
  const { t } = useI18n();

  const mediaId = mediaIdOf(value);

  const imageUrl = imageUrlOf(value);

  const [src, setSrc] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [failed, setFailed] = useState(false);

  const [open, setOpen] = useState(false);

  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    let objectUrl: string | null = null;

    setSrc(null);
    setFailed(false);
    setOpen(false);
    setLoading(Boolean(mediaId));

    if (!mediaId) {
      setSrc(imageUrl);

      return () => controller.abort();
    }

    void conversationsApi
      .mediaBlobUrl(mediaId, controller.signal)
      .then((url) => {
        objectUrl = url;

        if (controller.signal.aborted) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);

          objectUrl = null;

          return;
        }

        setSrc(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();

      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, imageUrl]);

  return (
    <figure className="min-w-0">
      {loading ? (
        <div
          className="flex aspect-[4/3] items-center justify-center rounded-xl border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-900"
          role="status"
          aria-label={t("common.loading")}
        >
          <Spinner />
        </div>
      ) : src && !failed ? (
        <button
          ref={trigger}
          type="button"
          className="group relative flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-ink-200 bg-ink-50 p-2 transition hover:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-ink-700 dark:bg-ink-900"
          onClick={() => setOpen(true)}
          aria-label={t("leads.viewImage", { label })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
          <span className="absolute bottom-2 end-2 rounded-md bg-white/90 p-1.5 text-ink-600 shadow-sm dark:bg-ink-800/90 dark:text-ink-200">
            <Expand className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50 p-3 text-center text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          {t("leads.imageUnavailable")}
        </div>
      )}
      <figcaption
        dir="auto"
        className="mt-2 break-words text-xs leading-5 text-ink-500 dark:text-ink-400"
      >
        {label}
      </figcaption>
      {open && src && !failed ? (
        <PhotoPreview src={src} label={label} onClose={close} />
      ) : null}
    </figure>
  );
}
