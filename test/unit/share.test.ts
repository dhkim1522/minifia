import { describe, expect, it, vi } from "vitest";
import { buildRoomLink, buildShareText, canWebShare, copyLink, shareOnly, shareRoom, type ShareNavigator } from "../../src/net/share";

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

describe("canWebShare", () => {
  it("share 함수가 없으면 거짓, 있으면 참", () => {
    expect(canWebShare({})).toBe(false);
    expect(canWebShare({ clipboard: { writeText: vi.fn() } })).toBe(false);
    expect(canWebShare({ share: vi.fn() })).toBe(true);
  });
});

describe("shareOnly — 공유만(클립보드로 넘어가지 않는다)", () => {
  it("성공하면 shared 이고 title·text·url 만 넘긴다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(shareOnly({ share }, data)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: data.title, text: data.text, url: data.url });
  });

  it("AbortError 면 cancelled 이고 클립보드를 건드리지 않는다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share: vi.fn().mockRejectedValue(rejection("AbortError")), clipboard: { writeText } };
    await expect(shareOnly(nav, data)).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("그 밖의 거부는 failed 이고 클립보드로 넘어가지 않는다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNavigator = { share: vi.fn().mockRejectedValue(rejection("NotAllowedError")), clipboard: { writeText } };
    await expect(shareOnly(nav, data)).resolves.toBe("failed");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("share 가 없으면 failed", async () => {
    await expect(shareOnly({}, data)).resolves.toBe("failed");
  });

  it("canShare 가 거짓이면 share 를 부르지 않고 failed", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(shareOnly({ share, canShare: () => false }, data)).resolves.toBe("failed");
    expect(share).not.toHaveBeenCalled();
  });
});

describe("copyLink — 복사만", () => {
  it("성공하면 copied 이고 writeText 에 url 을 넘긴다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLink({ clipboard: { writeText } }, data.url)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("거부되면 failed", async () => {
    const nav: ShareNavigator = { clipboard: { writeText: vi.fn().mockRejectedValue(rejection("NotAllowedError")) } };
    await expect(copyLink(nav, data.url)).resolves.toBe("failed");
  });

  it("clipboard 가 없으면 failed", async () => {
    await expect(copyLink({}, data.url)).resolves.toBe("failed");
  });
});
