"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  LogOut,
  Monitor,
  Moon,
  Paintbrush,
  PlayCircle,
  Sun,
  User,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme, type ThemePreference } from "@/providers/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/badges";
import { PushSettingsRow } from "@/components/settings/push-settings-card";
import {
  SettingsSection,
  SettingsSegmented,
  SettingsTile,
} from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";
import { isSoundEnabled, playMessageSound, setSoundEnabled } from "@/lib/sound";
import type { Locale } from "@/lib/types";

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();

  const { agent, role, signOut } = useAuth();

  const { theme, setTheme } = useTheme();

  const [soundOn, setSoundOn] = useState(true);

  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const testSound = () => {
    playMessageSound();
    setPinging(true);
    window.setTimeout(() => setPinging(false), 700);
  };

  const toggleSound = () => {
    const next = !soundOn;

    setSoundOn(next);
    setSoundEnabled(next);

    if (next) testSound();
  };

  const iconClass = "h-4 w-4";

  return (
    <AppShell title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SettingsSection
            icon={<User className="h-5 w-5" aria-hidden="true" />}
            title={t("settings.account")}
            description={t("settings.accountHelp")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={agent?.name ?? "?"} seed={agent?.email ?? ""} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
                    <span className="truncate">
                      {agent?.name ?? t("common.unknown")}
                    </span>
                    <RoleBadge role={role} />
                  </p>
                  <p
                    dir="ltr"
                    className="truncate text-sm text-ink-500 dark:text-ink-400"
                  >
                    {agent?.email ?? ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="btn-secondary h-10 shrink-0 self-start px-4 py-0 text-sm sm:self-auto"
              >
                <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                {t("common.signOut")}
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Paintbrush className="h-5 w-5" aria-hidden="true" />}
            title={t("settings.appearance")}
            description={t("settings.appearanceHelp")}
          >
            <div className="grid gap-5 md:grid-cols-2 md:gap-0">
              <div className="md:pe-6">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                  {t("common.theme")}
                </p>
                <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                  {t("settings.themeHelp")}
                </p>
                <SettingsSegmented<ThemePreference>
                  label={t("common.theme")}
                  value={theme}
                  onChange={setTheme}
                  options={[
                    {
                      value: "light",
                      label: t("settings.light"),
                      icon: <Sun className={iconClass} aria-hidden="true" />,
                    },
                    {
                      value: "dark",
                      label: t("settings.dark"),
                      icon: <Moon className={iconClass} aria-hidden="true" />,
                    },
                    {
                      value: "system",
                      label: t("settings.system"),
                      icon: (
                        <Monitor className={iconClass} aria-hidden="true" />
                      ),
                    },
                  ]}
                />
              </div>

              <div className="md:border-s md:border-ink-200 md:ps-6 md:dark:border-ink-700">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                  {t("common.language")}
                </p>
                <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                  {t("settings.languageHelp")}
                </p>
                <SettingsSegmented<Locale>
                  label={t("common.language")}
                  value={locale}
                  onChange={setLocale}
                  options={[
                    { value: "en", label: "English" },
                    { value: "ar", label: "العربية" },
                  ]}
                />
              </div>
            </div>
          </SettingsSection>
        </div>

        <SettingsSection
          icon={<Bell className="h-5 w-5" aria-hidden="true" />}
          title={t("settings.notifications")}
          description={t("settings.notificationsHelp")}
        >
          <div className="flex flex-col gap-3">
            <SettingsTile
              icon={<Volume2 className="h-5 w-5" aria-hidden="true" />}
              label={t("settings.messageSound")}
              description={t("settings.messageSoundHelp")}
            >
              <button
                type="button"
                onClick={testSound}
                disabled={!soundOn}
                className={cn(
                  "btn-ghost h-9 px-2.5 py-0 text-sm disabled:cursor-not-allowed disabled:opacity-40",
                  pinging && "text-brand-600",
                )}
              >
                <PlayCircle
                  className={cn("h-4 w-4", pinging && "animate-ping-once")}
                  aria-hidden="true"
                />
                {t("settings.testSound")}
              </button>

              <button
                type="button"
                onClick={toggleSound}
                role="switch"
                aria-checked={soundOn}
                aria-label={t("settings.messageSound")}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-800",
                  soundOn ? "bg-brand-600" : "bg-ink-200 dark:bg-ink-600",
                )}
              >
                <span
                  className={cn(
                    "absolute start-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    soundOn
                      ? "translate-x-5 rtl:-translate-x-5"
                      : "translate-x-0",
                  )}
                />
              </button>
            </SettingsTile>

            <PushSettingsRow />
          </div>
        </SettingsSection>
      </div>
    </AppShell>
  );
}
