"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  MessageSquare,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { leadsApi } from "@/lib/features/leads/api";
import { errorDetail, errorKey } from "@/lib/errors";
import { safeReturnTo, withReturnTo } from "@/lib/return-to";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { CloseLeadModal } from "@/components/leads/close-lead-modal";
import { LeadCollectedInformation } from "@/components/leads/lead-collected-information";
import { cn, textDirOf } from "@/lib/utils";
import type { Lead } from "@/lib/types";

function SourceBadge({ source }: { source: Lead["source"] }) {
  const { t } = useI18n();

  if (source === "ai") {
    return (
      <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Bot className="h-3 w-3" aria-hidden="true" />
        {t("leads.sourceLabel.ai")}
      </span>
    );
  }

  return (
    <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
      <UserRound className="h-3 w-3" aria-hidden="true" />
      {t("leads.sourceLabel.agent")}
    </span>
  );
}

function StatusBadge({ status }: { status: Lead["status"] }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "badge",
        status === "open"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
      )}
    >
      {t(`leads.status.${status}`)}
    </span>
  );
}

function initialsOf(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/);

  const first = parts[0]?.[0] ?? "";

  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";

  return (first + second).toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
];

function avatarColorOf(seed: string): string {
  let hash = 0;

  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// Focus on mount with the caret at the end of the existing text.
// Defined at module level so its identity is stable. An inline function
// would be re-called on every render and move the caret while typing.
function focusAtEnd(node: HTMLTextAreaElement | null) {
  if (!node) return;

  node.focus();

  const end = node.value.length;

  node.setSelectionRange(end, end);
  node.scrollTop = node.scrollHeight;
}

// useSearchParams needs a Suspense boundary in the App Router.
export default function LeadDetailsPage() {
  return (
    <Suspense fallback={null}>
      <LeadDetailsContent />
    </Suspense>
  );
}

function LeadDetailsContent() {
  const params = useParams<{ id: string }>();

  const router = useRouter();

  const searchParams = useSearchParams();

  const { t, formatDateTime, locale } = useI18n();

  const { push } = useToast();

  const rtl = locale === "ar";

  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  const leadId = Number(params?.id);

  // Where the back arrow goes: the list the user came from (with its filters,
  // search and page), or /leads if returnTo is missing or not an allowed URL.
  const returnTo = safeReturnTo(searchParams?.get("returnTo"));

  const backTarget = returnTo ?? "/leads";

  // This page's own URL, passed on to the conversation so its back arrow
  // returns here (and from here, back to the list).
  const detailUrl = withReturnTo(`/leads/${leadId}`, returnTo);

  const [lead, setLead] = useState<Lead | null>(null);

  const [loading, setLoading] = useState(true);

  const [notFound, setNotFound] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const [closing, setClosing] = useState(false);

  const [editingNote, setEditingNote] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");

  const [savingNote, setSavingNote] = useState(false);

  const [editingCloseNote, setEditingCloseNote] = useState(false);

  const [closeNoteDraft, setCloseNoteDraft] = useState("");

  const [savingCloseNote, setSavingCloseNote] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(leadId)) {
      setNotFound(true);
      setLoading(false);

      return;
    }

    setLoading(true);
    setFailure(null);
    setNotFound(false);

    try {
      const fresh = await leadsApi.get(leadId);

      setLead(fresh);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      } else {
        setFailure(errorKey(error));
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditNote = () => {
    setNoteDraft(lead?.note ?? "");
    setEditingNote(true);
  };

  const cancelEditNote = () => {
    setEditingNote(false);
    setNoteDraft("");
  };

  const saveNote = async () => {
    if (!lead) return;

    setSavingNote(true);

    try {
      const updated = await leadsApi.update(lead.id, { note: noteDraft });

      setLead(updated);
      push(t("leads.noteSaved"), "success");
      setEditingNote(false);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setSavingNote(false);
    }
  };

  const startEditCloseNote = () => {
    setCloseNoteDraft(lead?.closeNote ?? "");
    setEditingCloseNote(true);
  };

  const cancelEditCloseNote = () => {
    setEditingCloseNote(false);
    setCloseNoteDraft("");
  };

  const saveCloseNote = async () => {
    if (!lead) return;

    setSavingCloseNote(true);

    try {
      const updated = await leadsApi.update(lead.id, {
        closeNote: closeNoteDraft,
      });

      setLead(updated);
      push(t("leads.noteSaved"), "success");
      setEditingCloseNote(false);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setSavingCloseNote(false);
    }
  };

  const reopenLead = async () => {
    if (!lead) return;

    setBusy(true);

    try {
      const updated = await leadsApi.update(lead.id, { status: "open" });

      setLead(updated);
      setEditingCloseNote(false);
      push(t("leads.reopened"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setBusy(false);
    }
  };

  const closeLead = async (closeNote: string) => {
    if (!lead) return;

    setBusy(true);

    try {
      const updated = await leadsApi.update(lead.id, {
        status: "closed",
        closeNote,
      });

      setLead(updated);
      push(t("leads.closed"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");

      throw error;
    } finally {
      setBusy(false);
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={() => router.push(backTarget)}
      className="btn-ghost -ms-2 inline-flex items-center gap-1.5 px-2 py-1.5 text-sm"
    >
      <BackIcon className="h-4 w-4" aria-hidden="true" />
      {t("leads.backToLeads")}
    </button>
  );

  if (notFound) {
    return (
      <AppShell title={t("leads.detailsTitle")} subtitle={t("leads.subtitle")}>
        <div className="space-y-4">
          {backButton}
          <section className="card">
            <EmptyState
              icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
              title={t("leads.notFound")}
              description={t("leads.notFoundHint")}
            />
          </section>
        </div>
      </AppShell>
    );
  }

  const displayName = lead?.customerName?.trim() || lead?.phone || "";

  const hasNote = Boolean(lead?.note && lead.note.trim().length > 0);

  const hasCloseNote = Boolean(
    lead?.closeNote && lead.closeNote.trim().length > 0,
  );

  const attributedTo = lead
    ? (lead.createdBy?.displayName ?? t("leads.sourceLabel.ai"))
    : "";

  return (
    <AppShell
      title={t("leads.detailsTitle")}
      subtitle={failure ? t(failure) : t("leads.subtitle")}
    >
      <div className="w-full space-y-4">
        {backButton}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : lead ? (
          <section className="card overflow-hidden">
            <header className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      avatarColorOf(displayName),
                    )}
                  >
                    {initialsOf(displayName)}
                  </div>
                  <div className="min-w-0">
                    <p
                      dir={textDirOf(displayName)}
                      className="break-words text-lg font-semibold leading-6 text-ink-900 [overflow-wrap:anywhere] dark:text-ink-50"
                    >
                      {displayName}
                    </p>
                    <p
                      dir="ltr"
                      className="mt-1 break-all text-xs text-ink-500 dark:text-ink-400"
                    >
                      {lead.phone}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SourceBadge source={lead.source} />
                      <StatusBadge status={lead.status} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary px-3 py-2 text-sm"
                    onClick={() =>
                      router.push(
                        withReturnTo(
                          `/conversations?id=${lead.conversationId}`,
                          detailUrl,
                        ),
                      )
                    }
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    {t("leads.viewChat")}
                  </button>
                  {lead.status === "open" ? (
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-sm"
                      disabled={busy}
                      onClick={() => setClosing(true)}
                    >
                      {busy ? <Spinner /> : null}
                      {t("leads.close")}
                    </button>
                  ) : null}
                  {lead.status === "closed" ? (
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-sm"
                      disabled={busy}
                      onClick={() => void reopenLead()}
                    >
                      {busy ? <Spinner /> : null}
                      {t("leads.reopen")}
                    </button>
                  ) : null}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 border-t border-ink-100 pt-3 dark:border-ink-800 sm:grid-cols-3">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 sm:block">
                  <dt className="text-xs text-ink-500 dark:text-ink-400">
                    {t("leads.service")}
                  </dt>
                  <dd className="text-sm sm:mt-1 font-medium text-ink-800 [overflow-wrap:anywhere] dark:text-ink-100">
                    <bdi>{lead.serviceName}</bdi>
                  </dd>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 sm:block">
                  <dt className="text-xs text-ink-500 dark:text-ink-400">
                    {t("leads.createdBy")}
                  </dt>
                  <dd className="text-sm sm:mt-1 text-ink-800 [overflow-wrap:anywhere] dark:text-ink-100">
                    <bdi>{attributedTo}</bdi>
                  </dd>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 sm:block">
                  <dt className="text-xs text-ink-500 dark:text-ink-400">
                    {t("leads.createdAt")}
                  </dt>
                  <dd className="text-sm sm:mt-1 text-ink-800 dark:text-ink-100">
                    {formatDateTime(lead.createdAt)}
                  </dd>
                </div>
                {lead.status === "closed" ? (
                  <>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 sm:block">
                      <dt className="text-xs text-ink-500 dark:text-ink-400">
                        {t("leads.closedBy")}
                      </dt>
                      <dd className="text-sm sm:mt-1 text-ink-800 [overflow-wrap:anywhere] dark:text-ink-100">
                        <bdi>
                          {lead.closedBy?.displayName ?? t("common.unknown")}
                        </bdi>
                      </dd>
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 sm:block">
                      <dt className="text-xs text-ink-500 dark:text-ink-400">
                        {t("leads.closedAt")}
                      </dt>
                      <dd className="text-sm sm:mt-1 text-ink-800 dark:text-ink-100">
                        {lead.closedAt ? formatDateTime(lead.closedAt) : "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </header>

            <LeadCollectedInformation
              fields={lead.collectedFields ?? {}}
              serviceName={lead.serviceName}
            />

            <section className="border-t border-ink-100 p-4 dark:border-ink-800 sm:p-5">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
                  {t("leads.note")}
                </h2>
                {!editingNote ? (
                  <button
                    type="button"
                    onClick={startEditNote}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    {t("leads.editNote")}
                  </button>
                ) : null}
              </div>

              {editingNote ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={focusAtEnd}
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    placeholder={t("leads.notePlaceholder")}
                    className="input w-full resize-none text-sm"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={cancelEditNote}
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={() => void saveNote()}
                      className="btn-primary px-2.5 py-1.5 text-xs"
                    >
                      {savingNote ? (
                        <Spinner />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t("leads.saveNote")}
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  dir={hasNote ? textDirOf(lead.note!) : undefined}
                  className="whitespace-pre-wrap text-sm leading-6 text-ink-700 [overflow-wrap:anywhere] dark:text-ink-200"
                >
                  {hasNote ? (
                    lead.note
                  ) : (
                    <span className="text-ink-400 dark:text-ink-500">
                      {t("leads.noNote")}
                    </span>
                  )}
                </p>
              )}
            </section>

            {lead.status === "closed" ? (
              <section className="border-t border-ink-100 p-4 dark:border-ink-800 sm:p-5">
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
                    {t("leads.closeNote")}
                  </h2>
                  {!editingCloseNote ? (
                    <button
                      type="button"
                      onClick={startEditCloseNote}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      {t("leads.editCloseNote")}
                    </button>
                  ) : null}
                </div>

                {editingCloseNote ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      ref={focusAtEnd}
                      value={closeNoteDraft}
                      onChange={(event) =>
                        setCloseNoteDraft(event.target.value)
                      }
                      rows={4}
                      placeholder={t("leads.notePlaceholder")}
                      className="input w-full resize-none text-sm"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={cancelEditCloseNote}
                        className="btn-ghost px-2.5 py-1.5 text-xs"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        disabled={savingCloseNote}
                        onClick={() => void saveCloseNote()}
                        className="btn-primary px-2.5 py-1.5 text-xs"
                      >
                        {savingCloseNote ? (
                          <Spinner />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {t("leads.saveNote")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    dir={hasCloseNote ? textDirOf(lead.closeNote!) : undefined}
                    className="whitespace-pre-wrap text-sm leading-6 text-ink-700 [overflow-wrap:anywhere] dark:text-ink-200"
                  >
                    {hasCloseNote ? (
                      lead.closeNote
                    ) : (
                      <span className="text-ink-400 dark:text-ink-500">
                        {t("leads.noNote")}
                      </span>
                    )}
                  </p>
                )}
              </section>
            ) : null}
          </section>
        ) : null}
      </div>

      <CloseLeadModal
        lead={closing ? lead : null}
        onClose={() => setClosing(false)}
        onSubmit={closeLead}
      />
    </AppShell>
  );
}
