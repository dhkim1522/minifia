/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { EmojiTraySheet } from "../../src/components/EmojiTraySheet";
import sourceText from "../../src/components/EmojiTraySheet.tsx?raw";
import { EMOJI_IDS } from "../../shared/protocol";
import type { EmojiId } from "../../shared/protocol";

// vitest 는 CSS 를 처리하지 않아 css?raw 가 빈 문자열이 된다 — 파일을 직접 읽는다.
const talkCss = readFileSync("src/styles/talk.css", "utf8");

afterEach(cleanup);

const setup = (o: { canSend?: boolean; coolingDown?: boolean } = {}) => {
  const onSend = vi.fn<(icon: EmojiId) => void>();
  const onClose = vi.fn();
  const utils = render(<EmojiTraySheet canSend={o.canSend ?? true} coolingDown={o.coolingDown ?? false} onSend={onSend} onClose={onClose} />);
  return { onSend, onClose, ...utils };
};
const cells = () => within(screen.getByRole("group", { name: "이모티콘" })).getAllByRole("button") as HTMLButtonElement[];

describe("EmojiTraySheet — 이모티콘 4×2 트레이 (S-08b, COMM-02)", () => {
  it("제목 '이모티콘', 칸 8개가 EMOJI_IDS 순서이고 칸 글자·읽기 이름·svg 가 있다", () => {
    const { container } = setup();
    expect(container.querySelector("dialog")?.getAttribute("aria-label")).toBe("이모티콘");
    expect(screen.getByRole("heading", { name: "이모티콘" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
    const list = cells();
    expect(list).toHaveLength(EMOJI_IDS.length);
    expect(list.map((b) => b.textContent)).toEqual(["웃음", "크게", "놀람", "의심", "화남", "슬픔", "좋아요", "느낌표"]);
    expect(list.map((b) => b.getAttribute("aria-label"))).toEqual(["웃음", "크게 웃음", "놀람", "의심", "화남", "슬픔", "좋아요", "느낌표"]);
    for (const b of list) expect(b.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "크게 웃음" })).toBeTruthy();
  });

  it("'2초에 한 번 보낼 수 있어요' 안내가 보인다", () => {
    setup();
    expect(screen.getByText("2초에 한 번 보낼 수 있어요")).toBeTruthy();
  });

  it("놀람 칸을 누르면 onSend('surprised') 가 한 번 불리고 트레이는 닫히지 않는다", () => {
    const { onSend, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "놀람" }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("surprised");
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector(".mf-sheet--closing")).toBeNull();
  });

  it("칸마다 자기 아이콘 ID 를 보낸다", () => {
    const { onSend } = setup();
    for (const b of cells()) fireEvent.click(b);
    expect(onSend.mock.calls.map((c) => c[0])).toEqual([...EMOJI_IDS]);
  });

  it("coolingDown 이면 여덟 칸이 모두 꺼지고 눌러도 보내지 않는다", () => {
    const { onSend } = setup({ coolingDown: true });
    expect(cells().every((b) => b.disabled)).toBe(true);
    for (const b of cells()) fireEvent.click(b);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("canSend false(끊김) 이면 여덟 칸이 모두 꺼진다", () => {
    const { onSend } = setup({ canSend: false });
    expect(cells().every((b) => b.disabled)).toBe(true);
    for (const b of cells()) fireEvent.click(b);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("평소에는 여덟 칸이 모두 켜져 있다", () => {
    setup();
    expect(cells().every((b) => !b.disabled)).toBe(true);
  });

  it("talk.css 격자는 4열이고 이 부품에는 타이머가 없다", () => {
    expect(talkCss).toMatch(/grid-template-columns:\s*repeat\(4/);
    expect(sourceText).not.toMatch(/setTimeout|setInterval/);
    expect(sourceText).toContain("EMOJI_IDS");
    expect(sourceText).toContain("2초에 한 번 보낼 수 있어요");
  });
});
