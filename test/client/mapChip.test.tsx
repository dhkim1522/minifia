import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { MapChip } from "../../src/components/v2/MapChip";
import { MAP_CHIP_NAME } from "../../src/game/dressText";

afterEach(cleanup);

// 11-13: 로비·결과 왼쪽 위 지도 칩 — 현재 선택(재즈 바·광장·랜덤)을 모두에게 보이고, 방장만 눌러 맵 탭을 연다 (D-20, O-11)
describe("MapChip — 부품", () => {
  it("접근성 이름은 '맵 {재즈 바|광장|랜덤}' 이고 선택에 따라 아이콘이 mapBar·mapPlaza·shuffle 로 바뀐다", () => {
    expect(MAP_CHIP_NAME).toEqual({ bar: "맵 재즈 바", plaza: "맵 광장", random: "맵 랜덤" });
    const seen: string[] = [];
    for (const choice of ["bar", "plaza", "random"] as const) {
      const { container, unmount } = render(<MapChip choice={choice} host onPress={() => {}} />);
      const chip = container.querySelector("[data-map-chip]")!;
      expect(chip.getAttribute("aria-label")).toBe(MAP_CHIP_NAME[choice]);
      expect(chip.getAttribute("data-map-chip")).toBe(choice);
      seen.push([...container.querySelectorAll("svg path,svg circle")].map((e) => e.outerHTML).join(""));
      unmount();
    }
    expect(new Set(seen).size).toBe(3);
  });

  it("방장이 누르면 onPress 가 한 번 불린다", () => {
    const onPress = vi.fn();
    render(<MapChip choice="random" host onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "맵 랜덤" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("손님은 aria-disabled 이고 눌러도 onPress 가 불리지 않는다", () => {
    const onPress = vi.fn();
    const { container } = render(<MapChip choice="plaza" host={false} onPress={onPress} />);
    const chip = container.querySelector("[data-map-chip]")!;
    expect(chip.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(chip);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("시각 원(disc)과 누르는 영역이 따로 있고 글자는 이름표 '맵' 하나뿐이며 hex 색이 없다 (14-07 TOOL-01)", () => {
    const { container } = render(<MapChip choice="bar" host onPress={() => {}} />);
    expect(container.querySelector("[data-map-chip] .mf-mapchip__disc")).not.toBeNull();
    expect((container.textContent ?? "").trim()).toBe("맵");
    expect(container.querySelector("[data-map-chip]")?.getAttribute("data-tool-label")).toBe("맵");
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});
