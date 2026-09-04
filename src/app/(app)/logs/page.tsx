'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Copy, Download, Pause, Play, Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useToast } from '@/providers/toast-provider';
import { useRealtime, type EventMeta } from '@/hooks/use-realtime';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, uuid } from '@/lib/utils';

const MAX_ENTRIES = 500;

interface LogEntry {
  id: string;
  topic: string;
  event: string | null;
  receivedAt: string;
  body: string;
}

/** Pretty-print the frame when it is JSON, otherwise keep the raw text. */
function formatBody(body: string, payload: unknown): string {
  if (payload === null || typeof payload !== 'object') return body;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return body;
  }
}

export default function LogsPage() {
  const { t, formatTime } = useI18n();
  const { agent } = useAuth();
  const { push } = useToast();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const streamRef = useRef<HTMLDivElement | null>(null);

  const topics = useMemo(
    () => (agent ? ['/topic/inbox', `/topic/agent/${agent.id}`] : []),
    [agent],
  );

  const append = useCallback((payload: unknown, meta: EventMeta) => {
    if (pausedRef.current) return;
    const event =
      payload && typeof payload === 'object' && typeof (payload as any).event === 'string'
        ? ((payload as any).event as string)
        : null;
    setEntries((current) =>
      [
        ...current,
        {
          id: uuid(),
          topic: meta.topic,
          event,
          receivedAt: meta.receivedAt,
          body: formatBody(meta.body, payload),
        },
      ].slice(-MAX_ENTRIES),
    );
  }, []);

  const connection = useRealtime({ topics, enabled: Boolean(agent), onEvent: append });

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      `${entry.topic} ${entry.event ?? ''} ${entry.body}`.toLowerCase().includes(needle),
    );
  }, [entries, filter]);

  useEffect(() => {
    if (!autoScroll || paused) return;
    const node = streamRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [visible, autoScroll, paused]);

  const asText = useCallback(
    () =>
      visible.map((entry) => `[${entry.receivedAt}] ${entry.topic}\n${entry.body}`).join('\n\n'),
    [visible],
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      push(t('common.copied'), 'success');
    } catch {
      push(t('errors.generic'), 'error');
    }
  };

  const download = () => {
    const blob = new Blob([asText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ema-ws-log-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusTone =
    connection === 'connected'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
      : connection === 'connecting'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
        : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200';

  return (
    <AppShell
      title={t('logs.title')}
      subtitle={t('logs.subtitle')}
      actions={
        <div className='flex items-center gap-2'>
          <span className={cn('badge', statusTone)}>{t(`logs.${connection}`)}</span>
          <button
            type='button'
            className='btn-secondary px-3 py-2'
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? (
              <Play className='h-4 w-4' aria-hidden='true' />
            ) : (
              <Pause className='h-4 w-4' aria-hidden='true' />
            )}
            <span className='hidden sm:inline'>{paused ? t('logs.resume') : t('logs.pause')}</span>
          </button>
          <button
            type='button'
            className='btn-secondary px-3 py-2'
            onClick={() => void copyAll()}
            disabled={visible.length === 0}
            aria-label={t('logs.copyAll')}
            title={t('logs.copyAll')}
          >
            <Copy className='h-4 w-4' aria-hidden='true' />
          </button>
          <button
            type='button'
            className='btn-secondary px-3 py-2'
            onClick={download}
            disabled={visible.length === 0}
            aria-label={t('logs.download')}
            title={t('logs.download')}
          >
            <Download className='h-4 w-4' aria-hidden='true' />
          </button>
          <button
            type='button'
            className='btn-secondary px-3 py-2 text-rose-600 dark:text-rose-300'
            onClick={() => setEntries([])}
            disabled={entries.length === 0}
            aria-label={t('logs.clear')}
            title={t('logs.clear')}
          >
            <Trash2 className='h-4 w-4' aria-hidden='true' />
          </button>
        </div>
      }
    >
      <section className='card overflow-hidden'>
        <header className='flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700'>
          <Activity className='h-4 w-4 text-brand-600' aria-hidden='true' />
          <input
            className='input h-9 max-w-xs flex-1'
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('logs.filterPlaceholder')}
            aria-label={t('logs.filterPlaceholder')}
          />
          <span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
            {t('logs.count', { n: visible.length })}
          </span>
          {paused ? (
            <span className='badge bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'>
              {t('logs.paused')}
            </span>
          ) : null}
          <label className='ms-auto flex cursor-pointer items-center gap-2 text-sm text-ink-600 dark:text-ink-300'>
            <input
              type='checkbox'
              className='h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900'
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            {t('logs.autoScroll')}
          </label>
        </header>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Activity className='h-5 w-5' aria-hidden='true' />}
            title={t('logs.empty')}
            description={t('logs.emptyHint')}
          />
        ) : (
          <div
            ref={streamRef}
            dir='ltr'
            className='max-h-[calc(100vh-19rem)] divide-y divide-ink-100 overflow-y-auto bg-ink-50/60 font-mono text-xs dark:divide-ink-700/70 dark:bg-ink-900/40'
          >
            {visible.map((entry) => (
              <article key={entry.id} className='animate-fade-in px-5 py-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-ink-400 dark:text-ink-500'>
                    {formatTime(entry.receivedAt)}
                  </span>
                  <span className='badge bg-brand-50 text-brand-700 dark:bg-brand-900/60 dark:text-brand-100'>
                    {entry.topic}
                  </span>
                  {entry.event ? (
                    <span className='badge bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-100'>
                      {entry.event}
                    </span>
                  ) : null}
                </div>
                <pre className='mt-2 whitespace-pre-wrap break-words text-ink-700 dark:text-ink-200'>
                  {entry.body}
                </pre>
              </article>
            ))}
          </div>
        )}

        <footer className='border-t border-ink-200 px-5 py-3 text-xs text-ink-500 dark:border-ink-700 dark:text-ink-400'>
          {t('logs.topics')}:{' '}
          <span dir='ltr'>{topics.length > 0 ? topics.join(', ') : t('common.none')}</span>
        </footer>
      </section>
    </AppShell>
  );
}
