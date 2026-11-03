import { describe, expect, it, vi } from "vitest";
import type { Moment } from "../src/local/types";
import { formatPlayback, notesStorageKey, readMoments, validateLoop, writeMoments } from "../src/local/moments";

const moment = (id = "note-1", time_seconds = 2, note = "Minha observação"): Moment => ({ id, time_seconds, note });
const source = (value: unknown) => ({ getItem: () => JSON.stringify(value) });

describe("playback time labels", () => {
  it("uses minutes, seconds and a decimal without claiming frame precision", () => {
    expect(formatPlayback(0)).toBe("00:00,0");
    expect(formatPlayback(62.98)).toBe("01:02,9");
    expect(formatPlayback(3661.2)).toBe("61:01,2");
  });
  it.each([NaN, Infinity, -Infinity, -0.1, Number.MAX_VALUE])("does not turn unavailable time %s into zero", (time) => {
    expect(formatPlayback(time)).toBe("--:--");
  });
});

describe("recovering manual observations", () => {
  it("keeps valid ordered text, including literal markup, without interpreting HTML", () => {
    const notes = [moment("b", 4, "<img src=x onerror=alert(1)>\nJoelho < quadril"), moment("a", 0, "")];
    expect(readMoments(source(notes), "content-id", 4)).toEqual(notes);
  });
  it("skips malformed records, coerced times, extra fields and out-of-range times", () => {
    const records = [
      null, [], "note", {}, { ...moment(), time_seconds: "2" },
      { ...moment(), time_seconds: null }, moment("negative", -1), moment("later", 10.1),
      { ...moment(), note: false }, { ...moment(), html: "<b>unsafe field</b>" },
      moment("", 1), moment(" ", 1), moment("x".repeat(257), 1),
      moment("too-long", 1, "x".repeat(1001)), moment("at-end", 10, "x".repeat(1000)),
    ];
    expect(readMoments(source(records), "content-id", 10)).toEqual([records.at(-1)]);
  });
  it("deduplicates by the first valid ID and caps the recovered inventory at 200", () => {
    const records = [moment("recovered", -1), moment("recovered", 1), moment("recovered", 2),
      ...Array.from({ length: 205 }, (_, i) => moment(`id-${i}`, i))];
    const restored = readMoments(source(records), "content-id", 300);
    expect(restored).toHaveLength(200);
    expect(restored[0]).toEqual(moment("recovered", 1));
    expect(restored.at(-1)?.id).toBe("id-198");
    expect(new Set(restored.map((m) => m.id)).size).toBe(200);
  });
  it.each(["", "{", "null", "{}", '"value"', '[{"time_seconds":NaN}]', " ".repeat(2_000_001)])("fails closed on missing, corrupt or oversized storage", (raw) => {
    expect(readMoments({ getItem: () => raw }, "content-id", 10)).toEqual([]);
  });
  it("survives denied storage and missing keys", () => {
    expect(readMoments({ getItem: () => { throw new Error("storage denied"); } }, "content-id", 10)).toEqual([]);
    expect(readMoments({ getItem: () => null }, "content-id", 10)).toEqual([]);
  });
  it.each([NaN, Infinity, -1])("does not restore observations without a valid duration %s", (duration) => {
    const getItem = vi.fn(() => JSON.stringify([moment()]));
    expect(readMoments({ getItem }, "content-id", duration)).toEqual([]);
    expect(getItem).not.toHaveBeenCalled();
  });
  it("namespaces content IDs without key collisions", () => {
    expect(notesStorageKey("a/b")).not.toBe(notesStorageKey("a%2Fb"));
    const getItem = vi.fn(() => JSON.stringify([moment()]));
    readMoments({ getItem }, "hash-a", 10);
    expect(getItem).toHaveBeenCalledExactlyOnceWith(notesStorageKey("hash-a"));
    expect(notesStorageKey("hash-a")).not.toBe(notesStorageKey("hash-b"));
  });
});

describe("saving manual observations", () => {
  it("round-trips valid notes and explicitly persists an empty inventory", () => {
    const data = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => { data.set(key, value); }, getItem: (key: string) => data.get(key) ?? null };
    const notes = [moment("at-zero", 0), moment("near-end", 9.9, "x".repeat(1000))];
    expect(writeMoments(storage, "content-id", notes)).toBe(true);
    expect(readMoments(storage, "content-id", 10)).toEqual(notes);
    expect(writeMoments(storage, "content-id", [])).toBe(true);
    expect(readMoments(storage, "content-id", 10)).toEqual([]);
  });
  it("reports quota and permission errors", () => {
    expect(writeMoments({ setItem: () => { throw new DOMException("Quota", "QuotaExceededError"); } }, "content-id", [moment()])).toBe(false);
  });
  it("rejects invalid writes without overwriting existing data", () => {
    const setItem = vi.fn();
    const invalid = [
      [moment("same"), moment("same", 3)],
      [moment("negative", -0.1)], [moment("not-finite", NaN)], [moment("infinite", Infinity)],
      [moment("long", 1, "x".repeat(1001))],
      Array.from({ length: 201 }, (_, i) => moment(`id-${i}`)),
      [{ ...moment(), extra: "discarding this would hide invalid data" }],
    ];
    for (const notes of invalid) expect(writeMoments({ setItem }, "content-id", notes)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("repeat interval", () => {
  it("accepts a quarter second and a loop ending exactly at duration", () => {
    expect(validateLoop(0, 0.25, 0.25)).toBe(true);
    expect(validateLoop(0.1, 0.35, 1)).toBe(true);
    expect(validateLoop(3.5, 5, 5)).toBe(true);
  });
  it.each([
    [0, 0.249, 10], [1, 1, 10], [2, 1, 10], [-1, 1, 10], [0, 11, 10],
    [NaN, 1, 10], [0, Infinity, 10], [0, 1, Infinity], [0, 1, NaN], [0, 1, -1],
  ])("rejects invalid or unsupported interval %s–%s / %s", (start, end, duration) => {
    expect(validateLoop(start, end, duration)).toBe(false);
  });
});
