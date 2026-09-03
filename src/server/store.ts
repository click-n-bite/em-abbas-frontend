import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BlockedCountry, NotifyPhone, PortalUser, Role } from '@/lib/types';

/**
 * Tiny JSON-file store backing the portal-managed resources (users, blocked
 * countries and notification phone numbers). The deployed EMA API does not expose these yet; when it does,
 * point `adminApi` in src/lib/api.ts at the real endpoints and this file plus
 * the /api routes can be deleted.
 *
 * Writes fall back to memory when the filesystem is read-only (serverless).
 */

interface StoreShape {
  users: PortalUser[];
  blockedCountries: BlockedCountry[];
  notifyPhones: NotifyPhone[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'portal-store.json');

function now(): string {
  return new Date().toISOString();
}

function seed(): StoreShape {
  const timestamp = now();
  return {
    users: [
      {
        id: randomUUID(),
        name: 'Agent One',
        email: 'agent@ema.local',
        role: 'superadmin',
        phone: '+966501234567',
        phoneCountry: 'SA',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: randomUUID(),
        name: 'Agent Two',
        email: 'agent2@ema.local',
        role: 'admin',
        phone: '+971501234567',
        phoneCountry: 'AE',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: randomUUID(),
        name: 'Support Agent',
        email: 'support@ema.local',
        role: 'agent',
        phone: '+20 100 123 4567',
        phoneCountry: 'EG',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    blockedCountries: [],
    notifyPhones: [],
  };
}

let memory: StoreShape | null = null;
let writable = true;

async function load(): Promise<StoreShape> {
  if (memory) return memory;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    memory = {
      users: parsed.users ?? [],
      blockedCountries: parsed.blockedCountries ?? [],
      notifyPhones: parsed.notifyPhones ?? [],
    };
  } catch {
    memory = seed();
    await persist(memory);
  }
  return memory;
}

async function persist(state: StoreShape): Promise<void> {
  memory = state;
  if (!writable) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Read-only filesystem: keep serving from memory for the process lifetime.
    writable = false;
  }
}

export class StoreError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  phoneCountry?: string | null;
  active?: boolean;
}

export interface NotifyPhoneInput {
  phone: string;
  country?: string | null;
  label?: string | null;
  createdBy?: string | null;
}

export const store = {
  async listUsers(): Promise<PortalUser[]> {
    const state = await load();
    return [...state.users].sort((a, b) => a.name.localeCompare(b.name));
  },

  async createUser(input: UserInput): Promise<PortalUser> {
    const state = await load();
    const email = input.email.trim().toLowerCase();
    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      throw new StoreError(409, 'DUPLICATE_EMAIL', 'users.duplicateEmail');
    }
    const timestamp = now();
    const user: PortalUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      role: input.role,
      phone: input.phone?.trim() || null,
      phoneCountry: input.phoneCountry?.toUpperCase() || null,
      active: input.active ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await persist({ ...state, users: [...state.users, user] });
    return user;
  },

  async updateUser(id: string, input: Partial<UserInput>): Promise<PortalUser> {
    const state = await load();
    const index = state.users.findIndex((user) => user.id === id);
    if (index === -1) throw new StoreError(404, 'NOT_FOUND', 'User not found');

    if (input.email) {
      const email = input.email.trim().toLowerCase();
      const clash = state.users.some(
        (user) => user.id !== id && user.email.toLowerCase() === email,
      );
      if (clash) throw new StoreError(409, 'DUPLICATE_EMAIL', 'users.duplicateEmail');
    }

    const current = state.users[index];
    const updated: PortalUser = {
      ...current,
      name: input.name?.trim() ?? current.name,
      email: input.email?.trim().toLowerCase() ?? current.email,
      role: input.role ?? current.role,
      phone: input.phone === undefined ? current.phone : input.phone?.trim() || null,
      phoneCountry:
        input.phoneCountry === undefined
          ? current.phoneCountry
          : input.phoneCountry?.toUpperCase() || null,
      active: input.active ?? current.active,
      updatedAt: now(),
    };

    const users = [...state.users];
    users[index] = updated;
    await persist({ ...state, users });
    return updated;
  },

  async deleteUser(id: string): Promise<void> {
    const state = await load();
    if (!state.users.some((user) => user.id === id)) {
      throw new StoreError(404, 'NOT_FOUND', 'User not found');
    }
    await persist({ ...state, users: state.users.filter((user) => user.id !== id) });
  },

  async listBlockedCountries(): Promise<BlockedCountry[]> {
    const state = await load();
    return [...state.blockedCountries].sort((a, b) => a.code.localeCompare(b.code));
  },

  async blockCountry(input: {
    code: string;
    callingCode: string;
    reason?: string | null;
    createdBy?: string | null;
  }): Promise<BlockedCountry> {
    const state = await load();
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new StoreError(400, 'INVALID_COUNTRY', 'Invalid country code');
    }
    if (state.blockedCountries.some((entry) => entry.code === code)) {
      throw new StoreError(409, 'ALREADY_BLOCKED', 'blacklist.already');
    }
    const entry: BlockedCountry = {
      code,
      callingCode: String(input.callingCode ?? '').replace(/[^\d]/g, ''),
      reason: input.reason?.trim() || null,
      createdAt: now(),
      createdBy: input.createdBy ?? null,
    };
    await persist({ ...state, blockedCountries: [...state.blockedCountries, entry] });
    return entry;
  },

  async unblockCountry(code: string): Promise<void> {
    const state = await load();
    const upper = code.trim().toUpperCase();
    if (!state.blockedCountries.some((entry) => entry.code === upper)) {
      throw new StoreError(404, 'NOT_FOUND', 'Country not blocked');
    }
    await persist({
      ...state,
      blockedCountries: state.blockedCountries.filter((entry) => entry.code !== upper),
    });
  },

  async listNotifyPhones(): Promise<NotifyPhone[]> {
    const state = await load();
    return [...state.notifyPhones].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addNotifyPhone(input: NotifyPhoneInput): Promise<NotifyPhone> {
    const state = await load();
    const phone = input.phone.replace(/[^\d+]/g, '');
    if (!/^\+\d{6,15}$/.test(phone)) {
      throw new StoreError(400, 'INVALID_PHONE', 'notifyPhones.invalid');
    }
    if (state.notifyPhones.some((entry) => entry.phone === phone)) {
      throw new StoreError(409, 'DUPLICATE_PHONE', 'notifyPhones.duplicate');
    }
    const entry: NotifyPhone = {
      id: randomUUID(),
      phone,
      country: input.country?.toUpperCase() || null,
      label: input.label?.trim() || null,
      createdAt: now(),
      createdBy: input.createdBy ?? null,
    };
    await persist({ ...state, notifyPhones: [...state.notifyPhones, entry] });
    return entry;
  },

  async deleteNotifyPhone(id: string): Promise<void> {
    const state = await load();
    if (!state.notifyPhones.some((entry) => entry.id === id)) {
      throw new StoreError(404, 'NOT_FOUND', 'Number not found');
    }
    await persist({
      ...state,
      notifyPhones: state.notifyPhones.filter((entry) => entry.id !== id),
    });
  },
};
