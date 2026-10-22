import { describe, expect, it, vi } from "vitest";
import { buildRoomLink, buildShareText, shareRoom, type ShareNavigator } from "../../src/net/share";

const data = { title: "마피아", text: "민수님의 마피아 방에 들어오세요 (코드 0123)", url: "https://minifia.x.workers.dev/r/0123" };

function rejection(name: string): Error {
  return Object.assign(new Error(name), { name });
}

describe("shareRoom", () => {
  it("share 가 되면 shared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share, canShare: () => true, clipboard: { writeText } };
    await expect(shareRoom({ nav, ...data })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("공유 데이터에는 title·text·url 만 넣는다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await shareRoom({ nav: { share }, ...data });
    expect(share).toHaveBeenCalledWith({ title: data.title, text: data.text, url: data.url });
  });

  it("canShare 가 없어도 share 가 있으면 share 를 쓴다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(shareRoom({ nav: { share }, ...data })).resolves.toBe("shared");
  });

  it("사용자가 취소(AbortError)하면 cancelled 이고 클립보드를 건드리지 않는다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share: vi.fn().mockRejectedValue(rejection("AbortError")), clipboard: { writeText } };
    await expect(shareRoom({ nav, ...data })).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("NotAllowedError 면 클립보드에 url 을 복사해 copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share: vi.fn().mockRejectedValue(rejection("NotAllowedError")), clipboard: { writeText } };
    await expect(shareRoom({ nav, ...data })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("share 없이 clipboard 만 있으면 copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(shareRoom({ nav: { clipboard: { writeText } }, ...data })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("canShare 가 거짓이면 share 를 부르지 않고 클립보드로 간다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share, canShare: () => false, clipboard: { writeText } };
    await expect(shareRoom({ nav, ...data })).resolves.toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("둘 다 없으면 manual", async () => {
    await expect(shareRoom({ nav: {}, ...data })).resolves.toBe("manual");
  });

  it("클립보드도 거부하면 manual", async () => {
    const nav: ShareNavigator = { clipboard: { writeText: vi.fn().mockRejectedValue(rejection("NotAllowedError")) } };
    await expect(shareRoom({ nav, ...data })).resolves.toBe("manual");
  });
});

describe("buildRoomLink", () => {
  it("{origin}/r/{코드} 형식이다", () => {
    expect(buildRoomLink("https://minifia.x.workers.dev", "0123")).toBe("https://minifia.x.workers.dev/r/0123");
  });

  it("토큰이나 쿼리 문자열이 붙지 않는다", () => {
    expect(buildRoomLink("https://a.b", "9999")).not.toMatch(/[?#]/);
  });
});

describe("buildShareText", () => {
  it("방장 닉네임과 코드만 들어간다", () => {
    expect(buildShareText("민수", "0123")).toBe("민수님의 마피아 방에 들어오세요 (코드 0123)");
  });
});
