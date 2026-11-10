import { request, unwrapItem, unwrapList } from "@/lib/http";
import { fromWireRole, toWireRole } from "@/lib/config";
import { appendSort } from "@/lib/sorting";
import type { PortalUser, UserPayload, UsersListParams } from "./types";

function toWirePayload(payload: Partial<UserPayload>): Record<string, unknown> {
  const { role, ...rest } = payload;

  return role ? { ...rest, role: toWireRole(role) } : rest;
}

function normalizeUser(user: PortalUser): PortalUser {
  return { ...user, role: fromWireRole(user.role) };
}

export const usersApi = {
  async list(
    params: UsersListParams = {},
    signal?: AbortSignal,
  ): Promise<PortalUser[]> {
    const search = new URLSearchParams();

    appendSort(search, params);

    const query = search.toString();

    const payload = await request<unknown>(
      `/api/admin/users${query ? `?${query}` : ""}`,
      { signal },
    );

    return unwrapList<PortalUser>(payload, "users").map(normalizeUser);
  },

  async create(payload: UserPayload): Promise<PortalUser> {
    const result = await request<unknown>("/api/admin/users", {
      method: "POST",
      body: toWirePayload(payload),
    });

    return normalizeUser(unwrapItem<PortalUser>(result, "user"));
  },

  async update(id: string, payload: Partial<UserPayload>): Promise<PortalUser> {
    const result = await request<unknown>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: toWirePayload(payload),
    });

    return normalizeUser(unwrapItem<PortalUser>(result, "user"));
  },

  remove(id: string): Promise<void> {
    return request<void>(`/api/admin/users/${id}`, { method: "DELETE" });
  },
};
