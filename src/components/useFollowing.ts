"use client";

import { useSyncExternalStore } from "react";
import {
  FOLLOWING_KEY,
  parseFollowing,
  serialiseFollowing,
  toggleFollowing,
} from "@/lib/following";

/**
 * The followed clubs, read from this device.
 *
 * `useSyncExternalStore` rather than state in an effect: the list exists before
 * React does, and the server has no idea what it says, so the server snapshot
 * is empty and the first client render fills it in. Other tabs are kept in step
 * through the storage event.
 */
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: string[] } = { raw: null, value: [] };
const EMPTY: string[] = [];

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(FOLLOWING_KEY);
  } catch {
    return EMPTY;
  }
  // The snapshot has to be referentially stable or React re-renders forever.
  if (raw !== cache.raw) cache = { raw, value: parseFollowing(raw) };
  return cache.value;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFollowing(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFollow(teamId: string) {
  const next = toggleFollowing(read(), teamId);
  try {
    localStorage.setItem(FOLLOWING_KEY, serialiseFollowing(next));
  } catch {
    // A browser refusing storage is not a reason to break the page.
  }
  listeners.forEach((l) => l());
}
