// 11페이즈 결과 화면 E2E 판정·읽기 (11-05, 결정 D-1·D-11·D-25, UI-SPEC A-1·A-5).
// 흐름 본문(resultFlow)은 flows.mjs 에 있고, 이 파일은 순수 검사 함수와 페이지 읽기 도우미만 둔다(flows.mjs 가 이미 3천 줄이다).
// 판정 문턱은 여기에만 있고 흐름은 낮추지 않는다. 직업 의상 대응표는 src/world/ghostOutfit.ts 의 JOB_OUTFIT 과 같아야 하고 test/unit/e2eContract.test.ts 가 대조한다.

/** 결과 화면이 더한 DOM 표식·훅 이름. test/unit/e2eContract.test.ts 가 각각이 git 추적 src/ 파일에 실제로 있는지 확인한다(이름 오타 방지). */
export const RESULT_MARKERS = Object.freeze([
  "data-result-stage", // 루트 data-result-stage="{gather|flip|light|announce|final}"
  "data-result-panel", // 아래 채팅 패널
  "data-result-announce", // 중앙 승리 알림(4600~5200)
  "__mfResult", // 테스트 훅 window.__mfResult = { stage, chips, dimmed, costumes }
]);

/** 직업 → 3D 의상 id (src/world/ghostOutfit.ts JOB_OUTFIT 의 사본) */
export const RESULT_JOB_OUTFIT = Object.freeze({ mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });

/** 헤더 승리 한 줄 (src/game/verdict.ts RESULT_TEXT.title 의 사본) */
export const RESULT_WIN_TITLE = Object.freeze({ citizenWin: "시민 승리", mafiaWin: "마피아 승리" });

/** 아래 패널 높이: 기록 칸 LOG_H(96 · 방 높이 780 이상 152) + 92 = 188 · 244 */
export const RESULT_PANEL_H = Object.freeze({ short: 188, tall: 244, tallRoomMinH: 780 });

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * RS1~RS8 결과 화면 최종 상태 판정. 입력 { winner, header, chips, seats, dimmed, loserSeats, costumes, jobBySeat, panel, panelWant, stageBottom, roomH, hasLegacy, chatEcho }:
 *  winner 기대 승자 · header 헤더 글자 · chips [data-role-chip] 개수 · seats 참가자 수 · dimmed 런타임이 어둡게 한 좌석(window.__mfResult.dimmed) · loserSeats 진 팀 좌석(서버 view 기준)
 *  costumes 런타임이 입힌 의상 표(좌석 → 의상) · jobBySeat 서버 view.result.seats 의 직업 표(좌석 → 직업) · panel 아래 패널 높이 · panelWant 기대 높이(없으면 방 높이로 계산)
 *  stageBottom 스테이지 아래 끝(= 패널 위 끝, 방 위 끝 기준) · roomH 방 높이 · hasLegacy 옛 요소 이름 배열(없으면 빈 배열) · chatEcho 내가 보낸 한 줄이 기록 칸에 보였나
 * RS1 헤더 승리 한 줄 · RS2 칩 수 == 참가자 수 · RS3 어두운 좌석 == 진 팀 · RS4 의상 == 직업 의상 표 · RS5 패널 188/244 ±1 · RS6 스테이지 아래 끝 = 방 − 패널 ±1 · RS7 옛 요소 없음 · RS8 채팅 한 줄 전달.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 반환: 항목별 { id, label, ok, detail } 배열.
 */
export function resultStageChecks(m) {
  const L = {
    RS1: "결과 화면: 헤더가 승리 한 줄",
    RS2: "결과 화면: 직업 칩 수 == 참가자 수",
    RS3: "결과 화면: 어두운 좌석 == 진 팀",
    RS4: "결과 화면: 모두 직업 의상(런타임이 입은 값)",
    RS5: "결과 화면: 아래 패널 높이 188 · 244",
    RS6: "결과 화면: 스테이지 아래 끝 == 방 높이 − 패널",
    RS7: "결과 화면: 옛 카드·배너·[처음으로]·방 닫힘 안내 없음",
    RS8: "결과 화면: 채팅 한 줄이 기록 칸에 보임",
  };
  const out = [];

  // RS1
  if (!Object.hasOwn(RESULT_WIN_TITLE, m?.winner)) out.push(noMeasure("RS1", L.RS1, "winner"));
  else if (typeof m.header !== "string") out.push(noMeasure("RS1", L.RS1, "header"));
  else out.push(result("RS1", L.RS1, m.header === RESULT_WIN_TITLE[m.winner] ? [] : [`헤더 "${m.header}" ≠ "${RESULT_WIN_TITLE[m.winner]}"`]));

  // RS2
  if (!isNum(m?.chips) || !isNum(m?.seats)) out.push(noMeasure("RS2", L.RS2, "chips·seats"));
  else out.push(result("RS2", L.RS2, m.chips === m.seats ? [] : [`칩 ${m.chips}개 ≠ 참가자 ${m.seats}명`]));

  // RS3
  if (!Array.isArray(m?.dimmed) || !Array.isArray(m?.loserSeats)) out.push(noMeasure("RS3", L.RS3, "dimmed·loserSeats"));
  else out.push(result("RS3", L.RS3, sameSet(m.dimmed, m.loserSeats) ? [] : [`어두운 좌석 [${[...m.dimmed].sort()}] ≠ 진 팀 [${[...m.loserSeats].sort()}]`]));

  // RS4
  if (!m?.costumes || typeof m.costumes !== "object" || !m?.jobBySeat || typeof m.jobBySeat !== "object") out.push(noMeasure("RS4", L.RS4, "costumes·jobBySeat"));
  else {
    const bad = [];
    for (const [seat, job] of Object.entries(m.jobBySeat)) {
      const want = Object.hasOwn(RESULT_JOB_OUTFIT, job) ? RESULT_JOB_OUTFIT[job] : undefined;
      if (want === undefined) bad.push(`자리 ${seat} 직업 "${job}" 를 모름`);
      else if (m.costumes[seat] !== want) bad.push(`자리 ${seat}(${job}) 의상 ${m.costumes[seat] ?? "없음"} ≠ ${want}`);
    }
    for (const seat of Object.keys(m.costumes)) if (!Object.hasOwn(m.jobBySeat, seat)) bad.push(`자리 ${seat} 는 참가자가 아닌데 의상이 있음`);
    out.push(result("RS4", L.RS4, bad));
  }

  // RS5
  const want = isNum(m?.panelWant) ? m.panelWant : isNum(m?.roomH) ? (m.roomH >= RESULT_PANEL_H.tallRoomMinH ? RESULT_PANEL_H.tall : RESULT_PANEL_H.short) : null;
  if (!isNum(m?.panel) || want === null) out.push(noMeasure("RS5", L.RS5, "panel·roomH"));
  else out.push(result("RS5", L.RS5, Math.abs(m.panel - want) <= 1 ? [] : [`패널 높이 ${m.panel} ≠ ${want} (±1)`]));

  // RS6
  if (!isNum(m?.stageBottom) || !isNum(m?.roomH) || !isNum(m?.panel)) out.push(noMeasure("RS6", L.RS6, "stageBottom·roomH·panel"));
  else {
    const expect = m.roomH - m.panel;
    out.push(result("RS6", L.RS6, Math.abs(m.stageBottom - expect) <= 1 ? [] : [`스테이지 아래 끝 ${m.stageBottom} ≠ 방 ${m.roomH} − 패널 ${m.panel} = ${expect} (±1)`]));
  }

  // RS7
  if (!Array.isArray(m?.hasLegacy)) out.push(noMeasure("RS7", L.RS7, "hasLegacy"));
  else out.push(result("RS7", L.RS7, m.hasLegacy.length === 0 ? [] : [`옛 요소가 남음: ${m.hasLegacy.join(", ")}`]));

  // RS8
  if (typeof m?.chatEcho !== "boolean") out.push(noMeasure("RS8", L.RS8, "chatEcho"));
  else out.push(result("RS8", L.RS8, m.chatEcho ? [] : ["내가 보낸 한 줄이 기록 칸에 나타나지 않음"]));

  return out;
}

/**
 * RS9 건너뛰기(D-25): 4600 전에 무대를 한 번 탭하면 연출 단계가 light 로 점프하고 전원 칩이 뒤집힌다.
 * 입력 { before: { stage, chips }, after: { stage, chips }, seats }. before.stage 가 gather·flip 이어야 탭이 의미가 있다(아니면 측정값 없음 — 구간을 놓친 것).
 */
export function resultSkipChecks({ before, after, seats } = {}) {
  const label = "결과 화면: 무대 탭 한 번으로 4600 상태(light)로 건너뜀";
  if (typeof before?.stage !== "string" || typeof after?.stage !== "string" || !isNum(after?.chips) || !isNum(seats)) return result("RS9", label, ["측정값 없음(before·after·seats)"]);
  if (before.stage !== "gather" && before.stage !== "flip") return result("RS9", label, [`측정값 없음(탭 전 단계 ${before.stage} — 연출 구간을 놓침)`]);
  const bad = [];
  if (after.stage !== "light" && after.stage !== "announce" && after.stage !== "final") bad.push(`탭 뒤 단계 ${after.stage} (light 이후여야 함)`);
  if (after.chips !== seats) bad.push(`탭 뒤 칩 ${after.chips}개 ≠ 참가자 ${seats}명`);
  return result("RS9", label, bad);
}

/**
 * 결과 화면 한 번의 읽기(한 번의 evaluate). `.mf-result` 가 없으면 null.
 * { stage(루트 data-result-stage), header(h1 글자), chips([data-role-chip] 수), hook(window.__mfResult 사본 또는 null), panel(패널 높이), panelTop(방 위 끝 기준 패널 위 끝), roomH, legacy(남은 옛 요소 이름 배열) }
 */
export function readResultStage(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    if (!root) return null;
    const rr = root.getBoundingClientRect();
    const panel = root.querySelector("[data-result-panel]");
    const pr = panel ? panel.getBoundingClientRect() : null;
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const legacy = [];
    for (const sel of [".mf-result__grid", ".mf-result__banner", ".mf-result__card", ".mf-result__foot", ".mf-result__sm"]) if (root.querySelector(sel)) legacy.push(sel);
    if ([...root.querySelectorAll("button")].some((b) => text(b) === "처음으로")) legacy.push("[처음으로]");
    if (text(root).includes("30분")) legacy.push("방 닫힘 안내");
    const hook = window.__mfResult
      ? { stage: window.__mfResult.stage, chips: window.__mfResult.chips, dimmed: [...window.__mfResult.dimmed], costumes: { ...window.__mfResult.costumes } }
      : null;
    return {
      stage: root.getAttribute("data-result-stage") ?? "",
      header: text(root.querySelector("h1")),
      chips: root.querySelectorAll("[data-role-chip]").length,
      hook,
      panel: pr ? pr.height : Number.NaN,
      panelTop: pr ? pr.top - rr.top : Number.NaN,
      roomH: rr.height,
      legacy,
    };
  });
}
