"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Pencil,
  Users as UsersIcon,
} from "lucide-react";
import { adminApi, type UserPayload } from "@/lib/api";
import { errorDetail, errorKey } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge, StatusDot } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserFormModal } from "@/components/users/user-form-modal";
import { SortControl, SortableTh } from "@/components/ui/sortable-header";
import { cn, textDirOf } from "@/lib/utils";
import { sameSort, toggleSort, type SortState } from "@/lib/sorting";
import type { PortalUser, Role, UserSortField } from "@/lib/types";

type RoleFilter = Role | "all";

const ROLE_FILTERS: RoleFilter[] = ["all", "superadmin", "admin", "agent"];

type UserSort = SortState<UserSortField>;

// Matches the API default order.
const DEFAULT_SORT: UserSort = { field: "id", direction: "asc" };

const SORT_MENU_FIELDS: UserSortField[] = [
  "displayName",
  "username",
  "role",
  "isActive",
  "createdAt",
  "id",
];

export default function UsersPage() {
  const { t, formatDateTime } = useI18n();

  const { agent, role, canManageUsers } = useAuth();

  const { push } = useToast();

  const [users, setUsers] = useState<PortalUser[]>([]);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [formOpen, setFormOpen] = useState(false);

  const [editing, setEditing] = useState<PortalUser | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PortalUser | null>(null);

  const [sort, setSort] = useState<UserSort>(DEFAULT_SORT);

  const lastGoodSort = useRef<UserSort>(DEFAULT_SORT);

  const loadSeq = useRef(0);

  const loadAbort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Only the newest request may update the screen.
    const seq = ++loadSeq.current;

    loadAbort.current?.abort();

    const controller = new AbortController();

    loadAbort.current = controller;

    setLoading(true);

    try {
      const list = await adminApi.listUsers(
        { sort: sort.field, direction: sort.direction },
        controller.signal,
      );

      if (seq !== loadSeq.current) return;

      setUsers(list);
      setFailure(null);
      lastGoodSort.current = sort;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;

      if (seq !== loadSeq.current) return;

      if (!sameSort(sort, lastGoodSort.current)) {
        // Don't leave an indicator for an order that never loaded.
        setSort(lastGoodSort.current);
        push(errorDetail(error) ?? t("sorting.failed"), "error");

        return;
      }

      setFailure(errorKey(error));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [sort, push, t]);

  const onHeaderSort = (field: UserSortField) =>
    setSort((current) => toggleSort(current, field));

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);

      return;
    }

    void load();
  }, [canManageUsers, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const byRole =
      roleFilter === "all"
        ? users
        : users.filter((user) => user.role === roleFilter);

    if (!needle) return byRole;

    return byRole.filter((user) =>
      [user.displayName, user.username, t(`users.roles.${user.role}`)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [users, query, roleFilter, t]);

  const submit = async (payload: UserPayload) => {
    try {
      if (editing) {
        await adminApi.updateUser(editing.id, payload);
      } else {
        await adminApi.createUser(payload);
      }

      // Refetch so the row lands where the active sort puts it.
      void load();
      push(t("users.saved"), "success");
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    }
  };

  const remove = async (user: PortalUser) => {
    if (user.id === agent?.id) {
      push(t("users.cannotDeleteSelf"), "error");

      return;
    }

    try {
      await adminApi.deleteUser(user.id);
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      push(t("users.deleted"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    }
  };

  if (!canManageUsers) {
    return (
      <AppShell title={t("users.title")}>
        <section className="card">
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title={t("users.forbidden")}
            description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("users.title")}
      subtitle={failure ? t(failure) : t("users.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary px-3 py-2"
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("users.addUser")}
          </button>
        </div>
      }
    >
      <section className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-ink-200 p-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm sm:flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              className="input ps-9"
              placeholder={t("common.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("common.search")}
            />
          </div>

          <SortControl
            sort={sort}
            onChange={setSort}
            options={SORT_MENU_FIELDS.map((field) => ({
              field,
              label: t(`sorting.userFields.${field}`),
            }))}
            className="lg:hidden"
            selectClassName="h-10"
          />

          <div
            role="tablist"
            className="flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900"
          >
            {ROLE_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={roleFilter === value}
                onClick={() => setRoleFilter(value)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  roleFilter === value
                    ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
                    : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
                )}
              >
                {t(`users.filters.${value}`)}
              </button>
            ))}
          </div>
        </header>

        {loading && users.length === 0 ? (
          <ul className="space-y-3 p-5">
            {[0, 1, 2, 3].map((index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="skeleton h-10 w-10 rounded-full" />
                <span className="flex-1 space-y-2">
                  <span className="skeleton block h-3 w-1/4" />
                  <span className="skeleton block h-3 w-1/2" />
                </span>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />}
            title={t("users.empty")}
          />
        ) : (
          <>
            {/* Table on wide screens */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900/60 dark:text-ink-400">
                  <tr>
                    <SortableTh
                      field="displayName"
                      label={t("users.name")}
                      sort={sort}
                      onSort={onHeaderSort}
                      className="px-5 py-3 text-center font-medium"
                    />
                    <SortableTh
                      field="role"
                      label={t("users.role")}
                      sort={sort}
                      onSort={onHeaderSort}
                      className="px-5 py-3 text-center font-medium"
                    />
                    <SortableTh
                      field="isActive"
                      label={t("users.status")}
                      sort={sort}
                      onSort={onHeaderSort}
                      className="px-5 py-3 text-center font-medium"
                    />
                    <SortableTh
                      field="createdAt"
                      label={t("users.created")}
                      sort={sort}
                      onSort={onHeaderSort}
                      className="px-5 py-3 text-center font-medium"
                    />
                    <th className="px-5 py-3 text-end font-medium">
                      {t("users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-700/70">
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-ink-50 dark:hover:bg-ink-700/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={user.displayName}
                            seed={user.username}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p
                              dir={textDirOf(user.displayName)}
                              className="truncate font-medium text-ink-900 dark:text-ink-50"
                            >
                              {user.displayName}
                            </p>
                            <p
                              dir="ltr"
                              className="truncate text-xs text-ink-500 dark:text-ink-400"
                            >
                              {user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusDot active={user.isActive} />
                      </td>
                      <td className="px-5 py-3 text-ink-500 dark:text-ink-400">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1.5"
                            aria-label={t("common.edit")}
                            title={t("common.edit")}
                            onClick={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                            aria-label={t("common.delete")}
                            title={t("common.delete")}
                            disabled={user.id === agent?.id}
                            onClick={() => setPendingDelete(user)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on small screens */}
            <ul className="divide-y divide-ink-100 dark:divide-ink-700/70 lg:hidden">
              {filtered.map((user) => (
                <li key={user.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={user.displayName}
                      seed={user.username}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        dir={textDirOf(user.displayName)}
                        className="truncate text-sm font-medium text-ink-900 dark:text-ink-50"
                      >
                        {user.displayName}
                      </p>
                      <p
                        dir="ltr"
                        className="truncate text-xs text-ink-500 dark:text-ink-400"
                      >
                        {user.username}
                      </p>
                    </div>
                    <RoleBadge role={user.role} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500 dark:text-ink-400">
                    <StatusDot active={user.isActive} />
                    <span>{formatDateTime(user.createdAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => {
                        setEditing(user);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn-danger flex-1"
                      disabled={user.id === agent?.id}
                      onClick={() => setPendingDelete(user)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {t("common.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <UserFormModal
        open={formOpen}
        user={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("users.deleteTitle")}
        body={t("users.deleteBody", { name: pendingDelete?.displayName ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
