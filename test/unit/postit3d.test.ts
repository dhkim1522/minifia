import { Group, Mesh } from "three";
import { describe, expect, it, vi } from "vitest";
import { createNoteRig, HAT_HEIGHT, HAT_SETTLE_MS, HAT_STEP, paintHat } from "../../src/world/postit";

describe("의심 고깔 배치", () => {
  it("네 방향에 표시하고, 넘치는 경우 숫자를 각각 인쇄한다", () => {
    const ctx = { fillRect: vi.fn(), fillText: vi.fn(), strokeText: vi.fn() } as unknown as CanvasRenderingContext2D;
    paintHat(ctx, 3);
    expect(vi.mocked(ctx.fillText).mock.calls).toEqual([
      ["의심", 64, 79], ["의심", 192, 79], ["의심", 320, 79], ["의심", 448, 79],
    ]);
    vi.mocked(ctx.fillText).mockClear();
    paintHat(ctx, 7);
    expect(vi.mocked(ctx.fillText).mock.calls.filter(([text]) => text === "7")).toEqual([
      ["7", 64, 45], ["7", 192, 45], ["7", 320, 45], ["7", 448, 45],
    ]);
  });

  it("마지막 세 고깔을 같은 중심에 낮게 포개고 가장 위에만 개수를 매긴다", () => {
    const parent = new Group();
    const rig = createNoteRig(parent);
    rig.setBaseY(1);
    rig.set([1, 2, 3, 4, 5, 6, 7], { animate: false });
    expect(rig.counts()).toEqual({ total: 7, visible: 3 });
    expect(parent.children.map((mesh) => mesh.position.toArray())).toEqual([
      [0, 1, 0], [0, 1 + HAT_STEP, 0], [0, 1 + 2 * HAT_STEP, 0],
    ]);
    const [bottom, middle, top] = parent.children as Mesh[];
    expect(middle.geometry).toBe(bottom.geometry);
    expect(top.geometry).toBe(bottom.geometry);
    expect(middle.material).toBe(bottom.material);
    expect(top.material).not.toBe(bottom.material);
    expect(rig.top()).toBeCloseTo(1 + 2 * HAT_STEP + HAT_HEIGHT);

    rig.set([5, 6, 7], { animate: true });
    expect(parent.children).toEqual([bottom, middle, top]);
    expect(top.material).toBe(bottom.material);
    rig.detach();
  });

  it("새로 들어온 고깔만 내려앉고 빠르게 떼었다 붙여도 여분의 메시를 남기지 않는다", () => {
    const parent = new Group();
    const rig = createNoteRig(parent);
    rig.set([1], { animate: true });
    const original = parent.children[0];
    const startY = original.position.y;
    rig.update(HAT_SETTLE_MS / 2);
    expect(original.position.y).toBeGreaterThan(0);
    expect(original.position.y).toBeLessThan(startY);
    rig.set([1, 2], { animate: false });
    expect(original.position.y).toBe(0);
    expect(parent.children[1].position.y).toBe(HAT_STEP);
    rig.set([], { animate: true });
    expect(rig.top()).toBeUndefined();
    expect(parent.children).toHaveLength(0);
    rig.set([2], { animate: true });
    rig.update(HAT_SETTLE_MS);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].position.y).toBe(0);
    rig.detach();
    rig.set([2], { animate: true });
    expect(rig.counts()).toEqual({ total: 0, visible: 0 });
  });
});
