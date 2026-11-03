import { describe, expect, it } from "vitest";
import { mergeSelections, type SelectionFrame } from "../src/mocks/selection";

const row = (frame_index: number, status: SelectionFrame["status"], detection_id: string | null = null): SelectionFrame => ({
  frame_index, pts: 1001 + frame_index * 3000, status, detection_id,
  reason: status === "selected" ? null : status === "not_started" ? "before_seed" : status === "ambiguous" ? "ambiguous_iou" : "reseed_required",
});

describe("composição de seleções explícitas", () => {
  it("não recupera A quando a nova seleção B se perde", () => {
    const old = [row(0, "selected", "A"), row(1, "selected", "A"), row(2, "selected", "A")];
    const newer = [row(0, "not_started"), row(1, "selected", "B"), row(2, "lost")];
    const merged = mergeSelections([old, newer]);
    expect(merged.map((f) => f.detection_id)).toEqual(["A", "B", null]);
    expect(merged[2]).toEqual(newer[2]);
  });

  it("preserva ambiguidade da seleção nova em vez de retomar a antiga", () => {
    const old = [row(0, "selected", "A"), row(1, "selected", "A"), row(2, "selected", "A"), row(3, "selected", "A")];
    const newer = [row(0, "not_started"), row(1, "selected", "B"), row(2, "ambiguous"), row(3, "lost")];
    const merged = mergeSelections([old, newer]);
    expect(merged.map((f) => f.status)).toEqual(["selected", "selected", "ambiguous", "lost"]);
    expect(merged.slice(2).every((f) => f.detection_id === null)).toBe(true);
  });

  it("mantém a lacuna e só retoma com a terceira semente", () => {
    const first = [row(0, "selected", "A"), row(1, "lost"), row(2, "lost"), row(3, "lost")];
    const second = [row(0, "not_started"), row(1, "selected", "B"), row(2, "lost"), row(3, "lost")];
    const third = [row(0, "not_started"), row(1, "not_started"), row(2, "not_started"), row(3, "selected", "C")];
    const inputs = [first, second, third];
    const before = structuredClone(inputs);
    expect(mergeSelections(inputs).map((f) => f.detection_id)).toEqual(["A", "B", null, "C"]);
    expect(inputs).toEqual(before);
  });

  it("preserva quadros anteriores à primeira semente e índices esparsos", () => {
    const call = [row(2, "not_started"), row(5, "selected", "A"), row(8, "lost")];
    expect(mergeSelections([call])).toEqual(call);
  });

  it("a solicitação mais recente no mesmo quadro substitui a anterior", () => {
    const old = [row(0, "selected", "A"), row(1, "selected", "A")];
    const newer = [row(0, "selected", "B"), row(1, "lost")];
    expect(mergeSelections([old, newer])).toEqual(newer);
  });

  it("sem chamadas não inventa uma seleção", () => { expect(mergeSelections([])).toEqual([]); });

  it.each([
    [row(0, "selected", "B")],
    [row(0, "selected", "B"), row(2, "selected", "B")],
    [row(0, "selected", "B"), { ...row(1, "selected", "B"), pts: 9999 }],
    [row(1, "selected", "B"), row(0, "selected", "B")],
    [row(0, "selected", "B"), row(0, "selected", "B")],
  ])("recusa timelines desalinhadas antes de unir por posição", (...newer) => {
    const old = [row(0, "selected", "A"), row(1, "selected", "A")];
    expect(() => mergeSelections([old, newer])).toThrow();
  });

  it.each([
    [],
    [row(0, "not_started")],
    [row(0, "lost")],
    [row(0, "selected", "A"), row(1, "lost"), row(2, "selected", "A")],
    [row(0, "selected", "A"), row(1, "not_started")],
    [row(0, "selected", null)],
    [{ ...row(0, "selected", "A"), pts: Number.NaN }],
    [{ ...row(0, "selected", "A"), frame_index: Number.MAX_SAFE_INTEGER + 1 }],
    [row(0, "selected", "A"), { ...row(1, "lost"), pts: 1001 }],
  ])("recusa chamadas inválidas ou que recuperam sem nova semente", (...call) => {
    expect(() => mergeSelections([call])).toThrow();
  });

  it("aceita PTS ausente apenas quando a mesma ausência está alinhada", () => {
    const one = [{ ...row(0, "selected", "A"), pts: null }];
    const two = [{ ...row(0, "selected", "B"), pts: null }];
    expect(mergeSelections([one, two])).toEqual(two);
    expect(() => mergeSelections([[row(0, "selected", "A")], two])).toThrow();
  });
});
