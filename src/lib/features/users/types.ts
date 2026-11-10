import type { Role } from "@/lib/features/auth/types";
import type { SortDirection } from "@/lib/sorting";

export interface PortalUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPayload {
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  password?: string;
}

export type UserSortField =
  | "id"
  | "username"
  | "displayName"
  | "role"
  | "isActive"
  | "createdAt";

export interface UsersListParams {
  sort?: UserSortField;
  direction?: SortDirection;
}
