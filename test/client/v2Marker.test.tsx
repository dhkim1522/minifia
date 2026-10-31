import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryStorage } from "../helpers/memoryStorage";

// 빌드 상수 WORKER_NAME 은 vite define 이 채운다. vitest 는 그 define 을 쓰지 않으므로 모듈을 모킹해 바꾼다.
async function renderHomeWith(workerName: string) {
  vi.resetModules();
  vi.doMock("../../shared/version", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../shared/version")>()),
    WORKER_NAME: workerName,
  }));
  const { Home } = await import("../../src/screens/Home");
  return render(<Home onEnterRoom={vi.fn()} />);
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.doUnmock("../../shared/version");
  vi.resetModules();
});

describe("v2.0 시험판 표식 (DEPLOY-02)", () => {
  it("WORKER_NAME 이 minifia-v2 이면 첫 화면에 'v2.0 시험판' 이 정확히 하나 보인다", async () => {
    const { container } = await renderHomeWith("minifia-v2");
    expect(screen.getAllByText("v2.0 시험판")).toHaveLength(1);
    expect(container.querySelector(".mf-entry__build")?.textContent).toBe("v2.0 시험판");
  });

  it("WORKER_NAME 이 minifia(v1.0) 이면 표식이 없다", async () => {
    await renderHomeWith("minifia");
    expect(screen.queryByText("v2.0 시험판")).toBeNull();
  });

  it("WORKER_NAME 이 dev(정의 없는 환경) 이면 표식이 없다", async () => {
    await renderHomeWith("dev");
    expect(screen.queryByText("v2.0 시험판")).toBeNull();
  });
});

describe("index.html 탭 제목 (DEPLOY-02)", () => {
  const html = readFileSync("index.html", "utf8");

  it("title 은 'Minifia v2' 다", () => {
    expect(html).toContain("<title>Minifia v2</title>");
  });

  it("og:title 은 'Minifia' 그대로다", () => {
    expect(html).toContain('<meta property="og:title" content="Minifia" />');
  });
});
