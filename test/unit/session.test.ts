import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageLike } from "../../src/net/session";

const TOKEN = "t".repeat(43);

// 메모리 대체 저장소는 모듈 안 상태라, 테스트마다 모듈을 새로 불러 서로 섞이지 않게 한다.
async function fresh() {
  vi.resetModules();
  return import("../../src/net/session");
}

function mapStorage(): StorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => {
      raw.set(k, v);
    },
    removeItem: (k) => {
      raw.delete(k);
    },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
  removeItem: () => {
    throw new Error("denied");
  },
};

beforeEach(() => {
  vi.resetModules();
});

describe("session 입장 정보 한 칸", () => {
  it("키 이름은 minifia:session, minifia:lastNickname 이다", async () => {
    const { SESSION_KEY, NICKNAME_KEY } = await fresh();
    expect(SESSION_KEY).toBe("minifia:session");
    expect(NICKNAME_KEY).toBe("minifia:lastNickname");
  });

  it("save → load 왕복, clear 뒤에는 null", async () => {
    const { saveSession, loadSession, clearSession, SESSION_KEY } = await fresh();
    const storage = mapStorage();
    expect(loadSession(storage)).toBeNull();
    saveSession({ code: "0042", token: TOKEN }, storage);
    expect(JSON.parse(storage.raw.get(SESSION_KEY) ?? "null")).toEqual({ code: "0042", token: TOKEN });
    expect(loadSession(storage)).toEqual({ code: "0042", token: TOKEN });
    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  it("다른 방에 들어가면 같은 칸을 덮어쓴다", async () => {
    const { saveSession, loadSession } = await fresh();
    const storage = mapStorage();
    saveSession({ code: "0042", token: TOKEN }, storage);
    saveSession({ code: "1111", token: "u".repeat(43) }, storage);
    expect(loadSession(storage)).toEqual({ code: "1111", token: "u".repeat(43) });
    expect(storage.raw.size).toBe(1);
  });

  it.each([
    ["깨진 JSON", "{not json"],
    ["JSON 이 객체가 아님", '"text"'],
    ["null", "null"],
    ["코드가 숫자 4자리가 아님", JSON.stringify({ code: "12ab", token: TOKEN })],
    ["코드가 5자리", JSON.stringify({ code: "00421", token: TOKEN })],
    ["토큰이 너무 짧음", JSON.stringify({ code: "0042", token: "short" })],
    ["토큰이 너무 김", JSON.stringify({ code: "0042", token: "x".repeat(129) })],
    ["토큰이 문자열이 아님", JSON.stringify({ code: "0042", token: 12345678901234567 })],
    ["코드가 없음", JSON.stringify({ token: TOKEN })],
  ])("저장된 값이 이상하면(%s) 없는 것으로 본다", async (_name, raw) => {
    const { loadSession, SESSION_KEY } = await fresh();
    const storage = mapStorage();
    storage.raw.set(SESSION_KEY, raw);
    expect(loadSession(storage)).toBeNull();
  });

  it("저장소가 예외를 던져도 save → load 는 메모리로 동작하고 clear 로 지워진다", async () => {
    const { saveSession, loadSession, clearSession } = await fresh();
    saveSession({ code: "0042", token: TOKEN }, throwingStorage);
    expect(loadSession(throwingStorage)).toEqual({ code: "0042", token: TOKEN });
    clearSession(throwingStorage);
    expect(loadSession(throwingStorage)).toBeNull();
  });

  it("전역 localStorage 가 없는 환경에서도 메모리로 동작한다", async () => {
    vi.stubGlobal("localStorage", undefined);
    try {
      const { saveSession, loadSession } = await fresh();
      saveSession({ code: "0042", token: TOKEN });
      // 실패 보고서가 한 줄이 되도록 문자열로 견준다.
      expect(JSON.stringify(loadSession())).toBe(JSON.stringify({ code: "0042", token: TOKEN }));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("session 마지막 닉네임", () => {
  it("왕복하고, 저장한 적이 없으면 빈 문자열", async () => {
    const { loadLastNickname, saveLastNickname, NICKNAME_KEY } = await fresh();
    const storage = mapStorage();
    expect(loadLastNickname(storage)).toBe("");
    saveLastNickname("민수", storage);
    expect(storage.raw.get(NICKNAME_KEY)).toBe("민수");
    expect(loadLastNickname(storage)).toBe("민수");
  });

  it("저장소가 예외를 던져도 메모리로 동작한다", async () => {
    const { loadLastNickname, saveLastNickname } = await fresh();
    saveLastNickname("민수", throwingStorage);
    expect(loadLastNickname(throwingStorage)).toBe("민수");
  });
});
