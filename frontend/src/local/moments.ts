import type { Moment } from "./types";

const MAX_MOMENTS = 200;
const MAX_NOTE_LENGTH = 1000;
const MAX_ID_LENGTH = 256;
// Bounded parsing, including escaped JSON for the maximum valid note inventory.
const MAX_STORED_CHARACTERS = 2_000_000;

/** Playback time in the opened file, not an original PTS or an exact frame. */
export function formatPlayback(seconds: number): string {
  const tenths = Math.floor(seconds * 10);
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(tenths)) return "--:--";
  const minutes = Math.floor(tenths / 600);
  const wholeSeconds = Math.floor(tenths / 10) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${tenths % 10}`;
}

/** The caller persists only catalog content IDs; file-picker videos stay in memory. */
export function notesStorageKey(videoId: string): string {
  return `quadro.local.moments.v1:${encodeURIComponent(videoId)}`;
}

function validMoment(value: unknown, duration: number): value is Moment {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  return keys.length === 3 && keys.every((key) => key === "id" || key === "time_seconds" || key === "note")
    && typeof row.id === "string" && row.id.trim().length > 0 && row.id.length <= MAX_ID_LENGTH
    && typeof row.time_seconds === "number" && Number.isFinite(row.time_seconds)
    && row.time_seconds >= 0 && row.time_seconds <= duration
    && typeof row.note === "string" && row.note.length <= MAX_NOTE_LENGTH;
}

/** Recover valid plain-text observations in stored order, without coercion. */
export function readMoments(
  storage: Pick<Storage, "getItem">,
  videoId: string,
  duration: number,
): Moment[] {
  if (!Number.isFinite(duration) || duration < 0) return [];
  try {
    const raw = storage.getItem(notesStorageKey(videoId));
    if (!raw || raw.length > MAX_STORED_CHARACTERS) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const recovered: Moment[] = [];
    for (const value of parsed) {
      if (!validMoment(value, duration) || seen.has(value.id)) continue;
      seen.add(value.id);
      // Notes remain literal text. UI must render them as text, never innerHTML.
      recovered.push({ id: value.id, time_seconds: value.time_seconds, note: value.note });
      if (recovered.length === MAX_MOMENTS) break;
    }
    return recovered;
  } catch {
    return [];
  }
}

/** All-or-nothing write; quota/permission failures never become a false success. */
export function writeMoments(
  storage: Pick<Storage, "setItem">,
  videoId: string,
  moments: Moment[],
): boolean {
  try {
    if (!Array.isArray(moments) || moments.length > MAX_MOMENTS) return false;
    const seen = new Set<string>();
    for (const moment of moments) {
      // Duration is checked at read time; this API has no media duration parameter.
      if (!validMoment(moment, Number.MAX_VALUE) || seen.has(moment.id)) return false;
      seen.add(moment.id);
    }
    const serialized = JSON.stringify(moments.map(({ id, time_seconds, note }) => ({ id, time_seconds, note })));
    if (serialized.length > MAX_STORED_CHARACTERS) return false;
    storage.setItem(notesStorageKey(videoId), serialized);
    return true;
  } catch {
    return false;
  }
}

/** A loop needs a finite quarter-second interval within the opened video's duration. */
export function validateLoop(start: number, end: number, duration: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(duration)
    && start >= 0 && start < end && end <= duration && end >= start + 0.25;
}
