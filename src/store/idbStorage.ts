import { del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/** IndexedDB storage for zustand/persist. Falls back to memory if IndexedDB is unavailable (e.g. private windows). */
const memory = new Map<string, string>();

export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      return (await get<string>(name)) ?? null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  async setItem(name, value) {
    try {
      await set(name, value);
    } catch {
      memory.set(name, value);
    }
  },
  async removeItem(name) {
    try {
      await del(name);
    } catch {
      memory.delete(name);
    }
  },
};
