import { navItems } from "@/components/layout/nav-items";
import type { Role } from "@/lib/types";

const MAX_LENGTH = 2000;

const BASE = "http://internal.invalid";

const STORAGE_KEY = "ema:return-to";

export function saveReturnTo(value: string | null): void {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function readSavedReturnTo(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_LENGTH) return null;

  if (!value.startsWith("/") || value.startsWith("//")) return null;

  if (value.includes("\\")) return null;

  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const url = new URL(value, BASE);

    if (url.origin !== BASE) return null;

    if (url.pathname === "/login") return null;

    if (!findNavItem(url.pathname)) return null;

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function findNavItem(pathname: string) {
  return navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function canAccessPath(pathname: string, role: Role): boolean {
  const item = findNavItem(pathname);

  if (!item) return false;

  return !item.roles || item.roles.includes(role);
}

export function resolveReturnTo(
  value: string | null | undefined,
  role: Role,
): string | null {
  const safe = safeReturnTo(value);

  if (!safe) return null;

  const pathname = new URL(safe, BASE).pathname;

  return canAccessPath(pathname, role) ? safe : null;
}

export function withReturnTo(path: string, returnTo: string | null): string {
  if (!returnTo) return path;

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
