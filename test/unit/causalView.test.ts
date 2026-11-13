import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ClueLine, PublicPlayer, RecordLine, RoomView } from "../../shared/protocol";
import { KOREAN_COUNT, boardMarksOf, clueChipsOf, clueSpotStates, housePlatesOf, lampsOffOf, nearestPlate, windowsLitOf } from "../../src/game/causalView";

// 21-08(D-10·D-14·D-18·D-25·D-26): 화면 계산 모듈 — 받은 view 값만 읽는 순수 함수. 단언은 문자열 한 줄로 둔다(한 줄 보고서).

const chips = (clues: ClueLine[] | undefined, record: RecordLine[] | undefined): string =>
  clueChipsOf(clues, record)
    .map((c) => `${c.kind}:${c.text}`)
    .join("|");

describe("KOREAN_COUNT", () => {
  it("1~8 이 하나…여덟이고 0·9 는 없다", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => KOREAN_COUNT[n]).join(",")).toBe("하나,둘,셋,넷,다섯,여섯,일곱,여덟");
    expect(`${KOREAN_COUNT[0]}/${KOREAN_COUNT[9]}`).toBe("undefined/undefined");
  });
});

describe("clueChipsOf — 단서 칩 목록", () => {
  it("받은 순서대로 칩, 목격 기록이 있으면 끝에 '목격 n'", () => {
    const clues: ClueLine[] = [
      { spot: 1, kind: "footprint", n: 2 },
      { spot: 2, kind: "cloth", piece: "redCloth" },
      { spot: 3, kind: "touched" },
    ];
    const record: RecordLine[] = [{ seat: 1, place: "lamp0" }, { seat: 2, place: "lamp1" }];
    expect(chips(clues, record)).toBe("footprint:발자국 둘|cloth:붉은 천 조각|touched:먼저 손댄 흔적|witness:목격 2");
  });

  it("창문 칩은 TRACE_TEXT 그대로, 어두워서 못 본 이웃은 dark 칩", () => {
    expect(chips([{ spot: 3, kind: "window", piece: "pin" }], undefined)).toBe("window:은빛 핀");
    expect(chips([{ spot: 3, kind: "dark" }], undefined)).toBe("dark:어두워서 못 봤어요");
  });

  it("먼저 손댄 흔적 칩은 그 지점의 아이콘(발자국·옷 조각·창문)과 지점 번호를 단다", () => {
    const got = ([1, 2, 3] as const).map((spot) => {
      const [c] = clueChipsOf([{ spot, kind: "touched" }], undefined);
      return `${c?.kind}/${c?.spot}/${c?.icon}`;
    });
    expect(got.join(" ")).toBe("touched/1/footprint touched/2/cloth touched/3/window");
  });

  it("종류별 아이콘: 발자국 footprint · 옷 조각 cloth · 창문 window · 어두워 window · 목격 eye", () => {
    const list = clueChipsOf(
      [
        { spot: 1, kind: "footprint", n: 1 },
        { spot: 2, kind: "cloth", piece: "button" },
        { spot: 3, kind: "window", piece: "pin" },
      ],
      [{ seat: 1, place: "lamp0" }],
    );
    expect(list.map((c) => c.icon).join(",")).toBe("footprint,cloth,window,eye");
    expect(clueChipsOf([{ spot: 3, kind: "dark" }], undefined)[0]?.icon).toBe("window");
  });

  it("단서도 목격도 없으면 '단서 없음' 하나(점선 칩, 아이콘 없음)", () => {
    expect(chips(undefined, undefined)).toBe("none:단서 없음");
    expect(chips([], undefined)).toBe("none:단서 없음");
    expect(chips([], [])).toBe("none:단서 없음");
    expect(clueChipsOf([], undefined)[0]?.icon).toBe(null);
  });

  it("목격 기록만 있어도 '단서 없음' 은 없다", () => {
    expect(chips([], [{ seat: 1, place: "lamp0" }])).toBe("witness:목격 1");
  });

  it("발자국 수가 범위 밖이거나 없으면 수사 없이 '발자국' 만 쓴다(없는 값을 만들지 않는다)", () => {
    expect(chips([{ spot: 1, kind: "footprint" }], undefined)).toBe("footprint:발자국");
    expect(chips([{ spot: 1, kind: "footprint", n: 9 }], undefined)).toBe("footprint:발자국");
  });

  it("글에 역할 연상어·'범인'·'증거'·'확정' 이 없다", () => {
    const all = clueChipsOf(
      [
        { spot: 1, kind: "footprint", n: 8 },
        { spot: 2, kind: "cloth", piece: "navyThread" },
        { spot: 3, kind: "dark" },
      ],
      [{ seat: 1, place: "lamp0" }],
    ).map((c) => c.text);
    for (const text of [...all, "단서 없음", "먼저 손댄 흔적"]) for (const w of ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정", "손님"]) expect(text).not.toContain(w);
  });
});

describe("clueSpotStates — 단서 지점 상태", () => {
  it("살핀 ① done · touched 받은 ② blurred · 안 살핀 ③ fresh", () => {
    const s = clueSpotStates([
      { spot: 1, kind: "footprint", n: 3 },
      { spot: 2, kind: "touched" },
    ]);
    expect(`${s[1]}/${s[2]}/${s[3]}`).toBe("done/blurred/fresh");
  });

  it("단서가 없으면 셋 모두 fresh, 어두워서 못 본 창문도 살핀(done) 지점이다", () => {
    expect(Object.values(clueSpotStates(undefined)).join(",")).toBe("fresh,fresh,fresh");
    expect(clueSpotStates([{ spot: 3, kind: "dark" }])[3]).toBe("done");
  });
});

describe("lampsOffOf·windowsLitOf — 꺼진 등불과 켜진 창", () => {
  it("꺼진 등불: 주인 있는 집의 가로등 중 켜진 목록에 없는 번호", () => {
    expect(lampsOffOf([0, 2], [0, 1, 2, 3]).join(",")).toBe("1,3");
    expect(lampsOffOf([], [2, 0]).join(",")).toBe("0,2");
  });

  it("주인 없는 집(좌석에 사람이 없는 집)의 가로등은 꺼진 표식을 하지 않는다", () => {
    expect(lampsOffOf([0], [0, 1]).join(",")).toBe("1");
    expect(lampsOffOf([0, 1, 5], [0, 1]).join(",")).toBe("");
  });

  it("창 켜짐: 주인 좌석 ∩ 켜진 등불", () => {
    expect(windowsLitOf([0, 1, 2, 3], [0, 2, 5]).join(",")).toBe("0,2");
    expect(windowsLitOf([3, 1], []).join(",")).toBe("");
  });
});

const PLAYERS: PublicPlayer[] = [
  { seat: 0, nickname: "지우", connected: true, isHost: true },
  { seat: 1, nickname: "하윤", connected: true, isHost: false, alive: false },
  { seat: 2, nickname: "민지", connected: true, isHost: false },
  { seat: 3, nickname: "도현", connected: true, isHost: false },
];

describe("housePlatesOf — 밤 집 판 목록", () => {
  it("산 사람 좌석만, 내 좌석에 me 표시", () => {
    const view = { players: PLAYERS, me: { seat: 2, isHost: false } } as unknown as RoomView;
    expect(housePlatesOf(view).map((p) => `${p.seat}${p.me ? "*" : ""}`).join(",")).toBe("0,2*,3");
  });
});

describe("nearestPlate — 최근접 누르기", () => {
  const points = [
    { seat: 0, x: 100, y: 100 },
    { seat: 1, x: 100, y: 140 },
    { seat: 2, x: 300, y: 300 },
  ];
  it("중심 거리 28 안의 가장 가까운 판의 좌석", () => {
    expect(nearestPlate(points, 100, 120)).toBe(0); // 0 까지 20, 1 까지 20 → 같은 거리라 낮은 좌석
    expect(nearestPlate(points, 100, 125)).toBe(1); // 1 까지 15
    expect(nearestPlate(points, 110, 100)).toBe(0);
  });
  it("판 밖(거리 28 초과)이면 null, 정확히 28 은 안이다", () => {
    expect(nearestPlate(points, 200, 200)).toBe(null);
    expect(nearestPlate(points, 128, 100)).toBe(0);
    expect(nearestPlate(points, 128.5, 100)).toBe(null);
    expect(nearestPlate([], 0, 0)).toBe(null);
  });
  it("max 를 바꾸면 그 거리를 쓴다", () => {
    expect(nearestPlate(points, 100, 150, 5)).toBe(null);
    expect(nearestPlate(points, 100, 144, 5)).toBe(1);
  });
});

describe("boardMarksOf — 얼굴 줄의 같은 옷 배지", () => {
  // 의상 → 조각: coat=button · police=pin · doctor=whiteCloth (shared/game/trace.ts)
  const looks = (l: Array<"coat" | "police" | "doctor">): PublicPlayer[] => l.map((look, seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0, look }));
  const marks = (players: PublicPlayer[], clues: ClueLine[] | undefined): string =>
    JSON.stringify(boardMarksOf(players, clues));

  it("받은 옷 조각(cloth)·창문(window) 조각마다 같은 옷 좌석에 cloth·window 배지", () => {
    const players = looks(["coat", "police", "coat", "doctor"]);
    expect(marks(players, [{ spot: 2, kind: "cloth", piece: "button" }])).toBe('{"0":["cloth"],"2":["cloth"]}');
    expect(marks(players, [{ spot: 3, kind: "window", piece: "pin" }])).toBe('{"1":["window"]}');
  });

  it("두 조각이 같은 좌석을 가리키면 배지 둘(cloth, window 순)", () => {
    const players = looks(["coat", "police", "coat", "doctor"]);
    expect(marks(players, [{ spot: 3, kind: "window", piece: "button" }, { spot: 2, kind: "cloth", piece: "button" }])).toBe('{"0":["cloth","window"],"2":["cloth","window"]}');
  });

  it("발자국·touched·dark 는 배지를 만들지 않고, 죽은 사람은 뺀다", () => {
    const players = looks(["coat", "police", "coat", "doctor"]).map((p) => (p.seat === 2 ? { ...p, alive: false } : p));
    expect(marks(players, [{ spot: 1, kind: "footprint", n: 2 }, { spot: 2, kind: "touched" }, { spot: 3, kind: "dark" }])).toBe("{}");
    expect(marks(players, [{ spot: 2, kind: "cloth", piece: "button" }])).toBe('{"0":["cloth"]}');
    expect(marks(players, undefined)).toBe("{}");
  });
});

describe("소스 규약 — 시각·난수·DOM·역할을 읽지 않는다", () => {
  const src = readFileSync(fileURLToPath(new URL("../../src/game/causalView.ts", import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  it("Date·Math.random·document·window·역할을 읽지 않는다", () => {
    const hits = [/\bDate\b/, /Math\.random/, /\bdocument\b/, /\bwindow\./, /typeof window/, /globalThis/, /\brole\b/i, /\.job\b/].filter((re) => re.test(src)).map(String);
    expect(hits.join(" ") || "없음").toBe("없음");
  });
  it("같은 옷 좌석은 sameOutfitSeats 로 구한다", () => {
    expect(src.includes("sameOutfitSeats")).toBe(true);
  });
});
