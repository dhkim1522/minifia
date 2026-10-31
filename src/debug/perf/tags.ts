// ?perf=1·?chat-mock=1 이 함께 쓰는 이름표 마크업. 제품 이름표(HeadStack)와 같은 mv-head > mv-tag 클래스를 쓰고,
// 런타임(world/runtime.ts)이 [data-seat] 요소의 transform·opacity·z-index 를 매 프레임 쓴다. 닉네임은 textContent 로만 넣는다(innerHTML 없음).

/** 시험용 닉네임 — 전각 3~5자(실제 이름표 폭에 가깝게). 0번이 나 */
export const SPIKE_NAMES = ["별빛여우", "달토끼", "마피아왕", "조용한밤", "고양이탐정", "수상한손님", "반짝이", "시민일호"];

function seatColor(seat: number): string {
  return `var(--seat-${(seat % 8) + 1})`;
}

/** 이름표 하나: HeadStack 과 같은 마크업·클래스(mv-head > mv-tag), 런타임이 transform·opacity·z-index 를 쓴다 */
export function makeTag(seat: number, name: string, me: boolean): HTMLElement {
  const tag = document.createElement("div");
  tag.className = "mf-world__tag";
  tag.dataset.seat = String(seat);
  if (me) tag.dataset.me = "true";
  tag.setAttribute("aria-hidden", "true");
  tag.style.opacity = "0";
  const head = document.createElement("div");
  head.className = "mv-head";
  const box = document.createElement("span");
  box.className = me ? "mv-tag is-me" : "mv-tag";
  const dot = document.createElement("span");
  dot.className = "mv-tag__dot";
  dot.style.background = seatColor(seat);
  const label = document.createElement("span");
  label.className = "mv-tag__name";
  label.textContent = me ? `${name} (나)` : name;
  box.append(dot, label);
  head.append(box);
  tag.append(head);
  return tag;
}

