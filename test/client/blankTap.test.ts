import { afterEach, describe, expect, it } from "vitest";
import { BLANK_TAP_EXCLUDE, BLANK_TAP_SLOP_PX, isBlankSceneTap } from "../../src/game/blankTap";

// 후보 선택의 빈 곳 탭 판정(결정 0040). 손으로 만든 DOM — happy-dom 은 상자 크기를 0 으로 돌려주므로 필요한 상자만 흉내 낸다.

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxAt(el: Element, box: Box): void {
  el.getBoundingClientRect = () =>
    ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }) as DOMRect;
}

function sceneWith(html: string): HTMLElement {
  const scene = document.createElement("div");
  scene.innerHTML = html;
  document.body.appendChild(scene);
  return scene;
}

afterEach(() => {
  document.body.innerHTML = "";
});

const FAR = { x: 500, y: 500 };

describe("isBlankSceneTap — 대상 요소 판정 (결정 0040)", () => {
  it("BLANK_TAP_SLOP_PX 는 8 이다", () => {
    expect(BLANK_TAP_SLOP_PX).toBe(8);
    expect(BLANK_TAP_EXCLUDE).toContain("[data-seat]");
  });

  it("빈 요소(테이블 면)를 탭하면 true 다", () => {
    const scene = sceneWith('<div class="felt"></div>');
    expect(isBlankSceneTap(scene.querySelector(".felt"), FAR, scene)).toBe(true);
    expect(isBlankSceneTap(scene, FAR, scene)).toBe(true);
  });

  it("Element 가 아닌 대상(null·window)과 장면 밖 요소는 false 다", () => {
    const scene = sceneWith('<div class="felt"></div>');
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    expect(isBlankSceneTap(null, FAR, scene)).toBe(false);
    expect(isBlankSceneTap(window, FAR, scene)).toBe(false);
    expect(isBlankSceneTap(outside, FAR, scene)).toBe(false);
  });

  it("button·[data-seat]·.mf-tt-anchor 안·a·input 대상은 false 다", () => {
    const scene = sceneWith(
      '<button class="b"><span class="in">x</span></button><div data-seat="1"><img class="fig"></div>' +
        '<div class="mf-tt-anchor"><span class="deep">t</span></div><a class="a">l</a><input class="i"><div role="button" class="rb"></div>',
    );
    for (const sel of [".b", ".in", "[data-seat]", ".fig", ".mf-tt-anchor", ".deep", ".a", ".i", ".rb"]) {
      expect(isBlankSceneTap(scene.querySelector(sel), FAR, scene), sel).toBe(false);
    }
  });
});

describe("isBlankSceneTap — 사람 상자 여유 8px 좌표 판정 (이름표는 pointer-events none)", () => {
  const BOX: Box = { left: 100, top: 200, width: 60, height: 20 };

  function setup(): { scene: HTMLElement; felt: Element } {
    const scene = sceneWith('<div class="felt"></div><div class="tag" data-seat="1"></div>');
    boxAt(scene.querySelector(".tag")!, BOX);
    return { scene, felt: scene.querySelector(".felt")! };
  }

  it("대상이 빈 요소여도 사람 상자 안 점은 false 다", () => {
    const { scene, felt } = setup();
    expect(isBlankSceneTap(felt, { x: 110, y: 205 }, scene)).toBe(false);
  });

  it("상자를 8px 넓힌 경계(포함)까지 false, 그 밖 1px 부터 true 다 — 네 방향", () => {
    const { scene, felt } = setup();
    const right = BOX.left + BOX.width;
    const bottom = BOX.top + BOX.height;
    expect(isBlankSceneTap(felt, { x: right + 8, y: 205 }, scene)).toBe(false);
    expect(isBlankSceneTap(felt, { x: right + 9, y: 205 }, scene)).toBe(true);
    expect(isBlankSceneTap(felt, { x: BOX.left - 8, y: 205 }, scene)).toBe(false);
    expect(isBlankSceneTap(felt, { x: BOX.left - 9, y: 205 }, scene)).toBe(true);
    expect(isBlankSceneTap(felt, { x: 110, y: BOX.top - 8 }, scene)).toBe(false);
    expect(isBlankSceneTap(felt, { x: 110, y: BOX.top - 9 }, scene)).toBe(true);
    expect(isBlankSceneTap(felt, { x: 110, y: bottom + 8 }, scene)).toBe(false);
    expect(isBlankSceneTap(felt, { x: 110, y: bottom + 9 }, scene)).toBe(true);
  });

  it("너비나 높이가 0 인 [data-seat] 상자는 건너뛴다", () => {
    const scene = sceneWith('<div class="felt"></div><div data-seat="2" class="zw"></div><div data-seat="3" class="zh"></div>');
    boxAt(scene.querySelector(".zw")!, { left: 0, top: 0, width: 0, height: 50 });
    boxAt(scene.querySelector(".zh")!, { left: 0, top: 0, width: 50, height: 0 });
    expect(isBlankSceneTap(scene.querySelector(".felt"), { x: 1, y: 1 }, scene)).toBe(true);
  });

  it("장면 밖에 있는 [data-seat] 상자는 보지 않는다", () => {
    const scene = sceneWith('<div class="felt"></div>');
    const outside = document.createElement("div");
    outside.setAttribute("data-seat", "9");
    document.body.appendChild(outside);
    boxAt(outside, { left: 0, top: 0, width: 400, height: 400 });
    expect(isBlankSceneTap(scene.querySelector(".felt"), { x: 10, y: 10 }, scene)).toBe(true);
  });
});
