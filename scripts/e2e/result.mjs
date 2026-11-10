// 11페이즈 결과 화면 E2E 판정·읽기 (11-05, 결정 D-1·D-11·D-25, UI-SPEC A-1·A-5).
// 흐름 본문(resultFlow)은 flows.mjs 에 있고, 이 파일은 순수 검사 함수와 페이지 읽기 도우미만 둔다(flows.mjs 가 이미 3천 줄이다).
// 18.1(P181-7): 결과 화면 탭은 그리지 않는다 — 탭 판정은 숨김 판정(resultHiddenChecks)으로 바뀌었다.
// 판정 문턱은 여기에만 있고 흐름은 낮추지 않는다. 직업 의상 대응표는 src/world/ghostOutfit.ts 의 JOB_OUTFIT 과 같아야 하고 test/unit/e2eContract.test.ts 가 대조한다.

/** 결과 화면이 더한 DOM 표식·훅 이름. test/unit/e2eContract.test.ts 가 각각이 git 추적 src/ 파일에 실제로 있는지 확인한다(이름 오타 방지). */
export const RESULT_MARKERS = Object.freeze([
  "data-result-stage", // 루트 data-result-stage="{gather|flip|light|announce|final}"
  "data-result-panel", // 아래 채팅 패널
  "data-result-announce", // 중앙 승리 알림(4600~5200)
  "__mfResult", // 테스트 훅 window.__mfResult = { stage, chips, dimmed, costumes, tab }
  "data-result-tab", // 탭 버튼 data-result-tab="{all|mafia|ghost|whisper|log}" (11-07)
  "data-result-dot", // 처음 나타난 마피아·유령·귓속말 탭의 점 표식 (11-07)
  "data-result-divider", // 탭 안 `{n}밤`·`{n}일차` 구분선 (11-07)
  "data-award-plate", // 시상식 칭호 패 (11-09)
  "data-award-id", // 패의 칭호 id (11-09)
  "data-float-count", // 떠 있는 [넘기기] 위의 진행 숫자 'k / n' (11-09, 버튼은 기존 data-float="skip")
  "data-day-card", // 기록 탭 일차 카드 data-day-card="{n}" (aria-pressed) (11-11)
  "data-day-detail", // 기록 탭 하루 상세 data-day-detail="{n}" (11-11)
  "data-whisper-pair", // 하루 상세의 귓속말 쌍 버튼 (11-11)
  "data-ready-pill", // 입력줄 오른쪽 끝 다시 하기 알약 (11-12)
  "data-ready", // 손님 알약 data-ready="true|false" (11-12)
  "data-ready-count", // 방장 알약 data-ready-count="n/m" (11-12)
  "data-bench-view", // 쉬는 사람 전용 화면 (11-12)
]);

/** 기록 탭 일차 카드 기하 (src/styles/v2.css .mf-tl__card, 간격은 --space-sm). test/unit/e2eContract.test.ts 가 앱 CSS 와 대조한다 */
export const TIMELINE_CARD = Object.freeze({ w: 72, h: 112, gap: 8 });

/** 결과 탭 id, 표시 순서 (src/game/resultText.ts RESULT_TABS 의 사본) */
export const RESULT_TAB_IDS = Object.freeze(["all", "mafia", "ghost", "whisper", "log"]);

/** 직업 → 3D 의상 id (src/world/ghostOutfit.ts JOB_OUTFIT 의 사본) */
export const RESULT_JOB_OUTFIT = Object.freeze({ mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });

/** 헤더 승리 한 줄 (src/game/verdict.ts RESULT_TEXT.title 의 사본) */
export const RESULT_WIN_TITLE = Object.freeze({ citizenWin: "시민 승리", mafiaWin: "마피아 승리" });

/** 결과 화면 아래 패널 = 기록 칸 LOG_H 68 + 92 (18.1, 게임 채팅 패널과 같음, 방 높이와 무관) */
export const RESULT_PANEL_H = 160;
/** 이 높이(px) 미만의 폰은 방 틀 높이 575 미만의 짧은 폰(360×560 probe) — 14-08 UI#14 알려진 한계 적용 대상 */
export const SHORT_PHONE_H = 575;

/** 시상식(11-09, UI-SPEC B-3·G): 패 기하와 떠 있는 [넘기기] 기하. test/unit/e2eContract.test.ts 가 앱 CSS 와 대조한다 */
/** floatH: 16-04 가 이름표를 없애고 16-06 이 상자를 곧 면으로 합쳐 [넘기기] 단추 상자는 48×48 원이다(시상식 [넘기기]는 열 밖 제자리, 지름 52 가 아니다) */
export const AWARD_PLATE = Object.freeze({ maxW: 328, sideMargin: 32, h: 96, topGap: 8, belowMin: 150, float: 48, floatH: 48, floatRight: 16, floatGap: 8 });

/** 시상식 헤더 제목 (src/game/awardText.ts CEREMONY_TITLE 의 사본) */
export const AWARD_CEREMONY_TITLE = "시상식";

/** 다시 하기 알약(11-12, UI-SPEC D-1·G): 96×48, 입력줄 = [입력 flex][보내기 48 원][알약 96], 요소 사이 8, 좌우 16 → 입력칸 폭 = 폭 − 192. test/unit/e2eContract.test.ts 가 앱 CSS 와 대조한다 */
export const READY_PILL = Object.freeze({ w: 96, h: 48, inputExtra: 192 });

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * RS1~RS8 결과 화면 최종 상태 판정. 입력 { winner, header, chips, seats, dimmed, loserSeats, costumes, jobBySeat, panel, panelWant, stageBottom, roomH, hasLegacy, chatEcho }:
 *  winner 기대 승자 · header 헤더 글자 · chips [data-role-chip] 개수 · seats 참가자 수 · dimmed 런타임이 어둡게 한 좌석(window.__mfResult.dimmed) · loserSeats 진 팀 좌석(서버 view 기준)
 *  costumes 런타임이 입힌 의상 표(좌석 → 의상) · jobBySeat 서버 view.result.seats 의 직업 표(좌석 → 직업) · panel 아래 패널 높이 · panelWant 기대 높이(없으면 RESULT_PANEL_H 160)
 *  stageBottom 스테이지 아래 끝(= 패널 위 끝, 방 위 끝 기준) · roomH 방 높이 · hasLegacy 옛 요소 이름 배열(없으면 빈 배열) · chatEcho 내가 보낸 한 줄이 기록 칸에 보였나
 * RS1 헤더 승리 한 줄 · RS2 칩 수 == 참가자 수 · RS3 어두운 좌석 == 진 팀 · RS4 의상 == 직업 의상 표 · RS5 패널 188/244 ±1 · RS6 스테이지 아래 끝 = 방 − 패널 ±1 · RS7 옛 요소 없음 · RS8 채팅 한 줄 전달.
 * afterCeremony(11-09): true 면 시상식이 끝난 뒤 상태로 RS4 를 "의상이 모두 걷힘"으로 본다(기본은 재접속 같은 최종 상태 = 직업 의상).
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 반환: 항목별 { id, label, ok, detail } 배열.
 */
export function resultStageChecks(m) {
  const L = {
    RS1: "결과 화면: 헤더가 승리 한 줄",
    RS2: "결과 화면: 직업 칩 수 == 참가자 수",
    RS3: "결과 화면: 어두운 좌석 == 진 팀",
    RS4: "결과 화면: 모두 직업 의상(런타임이 입은 값)",
    RS4after: "결과 화면: 시상식 뒤 직업 의상이 걷힘(고른 look)",
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

  // RS4 — afterCeremony(11-09): 시상식이 끝나면 직업 의상이 걷히고 고른 look 으로 돌아온다(의상 유지가 눈에 보인다, D-1) — 런타임이 입은 직업 의상 표가 비어야 한다
  if (m?.afterCeremony === true) {
    if (!m?.costumes || typeof m.costumes !== "object") out.push(noMeasure("RS4", L.RS4after, "costumes"));
    else out.push(result("RS4", L.RS4after, Object.keys(m.costumes).length === 0 ? [] : [`직업 의상이 남음: ${JSON.stringify(m.costumes)}`]));
  } else if (!m?.costumes || typeof m.costumes !== "object" || !m?.jobBySeat || typeof m.jobBySeat !== "object") out.push(noMeasure("RS4", L.RS4, "costumes·jobBySeat"));
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
  const want = isNum(m?.panelWant) ? m.panelWant : RESULT_PANEL_H;
  if (!isNum(m?.panel)) out.push(noMeasure("RS5", L.RS5, "panel"));
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
 * { stage(루트 data-result-stage), header(h1 글자), chips([data-role-chip] 수), hook(window.__mfResult 사본 — awards 포함 — 또는 null), panel(패널 높이), panelTop(방 위 끝 기준 패널 위 끝), roomH, legacy(남은 옛 요소 이름 배열) }
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
      ? { stage: window.__mfResult.stage, chips: window.__mfResult.chips, dimmed: [...window.__mfResult.dimmed], costumes: { ...window.__mfResult.costumes }, awards: [...(window.__mfResult.awards ?? [])] }
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

// ---------- 18.1 결과 화면 기록 숨김 ----------

/**
 * 결과 화면 숨김 판정(18.1 P181-7, UI-SPEC E1·E2). 입력 m = { tabs, tabRows, bodies, chLines, domText, expanded, panelH }
 *  tabs `[data-result-tab]` 수 · tabRows `.mf-result__tabs` 수 · bodies `[data-result-body]` 수 · chLines `[data-ch="mafia"]`·`[data-ch="ghost"]` 줄 수 ·
 *  domText 결과 화면 글자 전체 · expanded 아래 패널의 data-expanded 값(문자열) · panelH 아래 패널 높이.
 * ctx = { sent }: 판 중에 보낸 마피아·유령 채팅 문장들 — 결과 화면 글자에 없어야 한다(결과 줄에는 포함 여부만 남기고 문장은 싣지 않는다).
 * RH1 탭 행·탭 단추 0 · RH2 기록 본문 0 · RH3 마피아·유령 줄 0 이고 보낸 문장이 DOM 에 없음 · RH4 확장 없음(data-expanded "false")이고 패널 높이 = RESULT_PANEL_H ±1.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 반환: 항목별 { id, label, ok, detail }.
 */
export function resultHiddenChecks(m, { sent = [] } = {}) {
  const L = {
    RH1: "결과 화면에 탭 행·탭 단추가 없다",
    RH2: "결과 화면에 기록 본문이 없다",
    RH3: "결과 화면에 마피아·유령 대화 줄이 없고 보낸 문장도 없다",
    RH4: `결과 화면 아래 패널이 확장 없이 ${RESULT_PANEL_H} 이다`,
  };
  const ids = ["RH1", "RH2", "RH3", "RH4"];
  if (m === null || typeof m !== "object") return ids.map((id) => noMeasure(id, L[id], "결과 화면 읽기 값"));
  const out = [];
  out.push(isNum(m.tabs) && isNum(m.tabRows) ? result("RH1", L.RH1, [...(m.tabs !== 0 ? [`탭 단추 ${m.tabs}개`] : []), ...(m.tabRows !== 0 ? [`탭 행 ${m.tabRows}개`] : [])]) : noMeasure("RH1", L.RH1, "탭 수"));
  out.push(isNum(m.bodies) ? result("RH2", L.RH2, m.bodies === 0 ? [] : [`기록 본문 ${m.bodies}개`]) : noMeasure("RH2", L.RH2, "본문 수"));
  if (!isNum(m.chLines) || typeof m.domText !== "string") out.push(noMeasure("RH3", L.RH3, "대화 줄 수·화면 글자"));
  else {
    const bad = [];
    if (m.chLines !== 0) bad.push(`마피아·유령 줄 ${m.chLines}개`);
    const leaked = sent.filter((x) => typeof x === "string" && x !== "" && m.domText.includes(x)).length;
    if (leaked > 0) bad.push(`보낸 문장 ${leaked}개가 화면 글자에 있음`);
    out.push(result("RH3", L.RH3, bad));
  }
  if (typeof m.expanded !== "string" || !isNum(m.panelH)) out.push(noMeasure("RH4", L.RH4, "확장 상태·패널 높이"));
  else {
    const bad = [];
    if (m.expanded !== "false") bad.push(`data-expanded ${m.expanded} (기대 false)`);
    if (Math.abs(m.panelH - RESULT_PANEL_H) > 1) bad.push(`패널 높이 ${Math.round(m.panelH * 10) / 10} (기대 ${RESULT_PANEL_H} ±1)`);
    out.push(result("RH4", L.RH4, bad));
  }
  return out;
}

/** 결과 화면 숨김 읽기(한 번의 evaluate). `.mf-result` 가 없으면 null. resultHiddenChecks 입력 모양 */
export function readResultHidden(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    if (!root) return null;
    const panel = root.querySelector("[data-result-panel]");
    return {
      tabs: root.querySelectorAll("[data-result-tab]").length,
      tabRows: root.querySelectorAll(".mf-result__tabs").length,
      bodies: root.querySelectorAll("[data-result-body]").length,
      chLines: root.querySelectorAll('[data-ch="mafia"], [data-ch="ghost"]').length,
      domText: root.textContent ?? "",
      expanded: panel ? panel.getAttribute("data-expanded") : null,
      panelH: panel ? panel.getBoundingClientRect().height : Number.NaN,
    };
  });
}

// ---------- 11-09 시상식 ----------

/**
 * AW1~AW8·AW10 시상식 판정(11-09, 결정 D-7·D-24·D-25, UI-SPEC B-3·G). 입력:
 *  viewport {w,h} · stageTop 스테이지 윗변(헤더 아래, 방 위 끝 기준) · panelTop 패널 윗변(= 스테이지 아래 끝, 같은 기준)
 *  plateBox {top,left,width,height} 첫 패의 사각형 · floatBox {left,top,width,height,bottom} 첫 패가 뜬 때의 [넘기기]
 *  progress 패마다 읽은 진행 숫자 문자열 · awards 훅 window.__mfResult.awards ([좌석, 칭호 id][]) · observed 패마다 읽은 data-award-id 열
 *  participants 참가자 수 · winnerTeamSeats 이긴 팀 좌석(서버 view 기준) · winner 승자 · titleDuring 시상 중 헤더 · titleAfter 끝난 뒤 헤더 · floatAfter 끝난 뒤 [data-float="skip"] 수
 *  costumesDuring 첫 패가 뜬 때 런타임이 입은 의상 표 · costumesAfter 시상식 뒤 표 · jobBySeat 서버 view 의 직업 표
 * AW1 패 수 == 참가자 수 == 훅 목록 길이 · AW2 관찰한 칭호 순서 == 훅(서버) 순서 · AW3 마지막 패가 이긴 팀 · AW4 패 기하(AW-PLATE) · AW5 [넘기기] 기하 · AW6 진행 'k / n' ·
 * AW7 헤더 '시상식' → 승리 한 줄 · AW8 끝난 뒤 [넘기기] 없음 · AW10 시상 중 직업 의상 → 끝난 뒤 걷힘.
 * 18.1: 확장 탭이 없어져(결과 화면은 전체 대화 하나, P181-7) 옛 AW9(확장 탭을 열면 시상식 일시정지)는 잴 길이 없어 지웠다. id 는 비워 두고 다시 쓰지 않는다.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
 */
export function awardChecks(m) {
  const L = {
    AW1: "시상식: 패 수 == 참가자 수(모두 하나 이상 받음)",
    AW2: "시상식: 패 순서 == 서버가 보낸 칭호 순서",
    AW3: "시상식: 마지막 패가 이긴 팀",
    AW4: "시상식: 패 기하 AW-PLATE (폭 min(328, 폭 − 32) · 높이 96 · 스테이지 윗변 + 8 · 아래 150 이상)",
    AW5: "시상식: [넘기기] 48×48 원(열 밖 제자리) · 오른쪽 16 · 위 칸",
    AW6: "시상식: 진행 숫자 'k / n' 이 패마다 1씩 오름",
    AW7: "시상식: 헤더 '시상식' → 끝난 뒤 승리 한 줄",
    AW8: "시상식: 끝난 뒤 [넘기기] 없음",
    AW10: "시상식: 시상 중 직업 의상, 끝난 뒤 걷힘",
  };
  const out = [];
  const awards = Array.isArray(m?.awards) ? m.awards : null;
  const obs = Array.isArray(m?.observed) ? m.observed : null;

  // AW1
  if (!isNum(m?.participants) || awards === null || obs === null) out.push(noMeasure("AW1", L.AW1, "participants·awards·observed"));
  else {
    const bad = [];
    if (awards.length !== m.participants) bad.push(`칭호 ${awards.length}개 ≠ 참가자 ${m.participants}명`);
    if (obs.length !== awards.length) bad.push(`관찰한 패 ${obs.length}장 ≠ 칭호 ${awards.length}개`);
    out.push(result("AW1", L.AW1, bad));
  }

  // AW2
  if (awards === null || obs === null) out.push(noMeasure("AW2", L.AW2, "awards·observed"));
  else {
    const want = awards.map((a) => a[1]);
    out.push(result("AW2", L.AW2, want.length === obs.length && want.every((id, i) => id === obs[i]) ? [] : [`관찰 [${obs}] ≠ 서버 [${want}]`]));
  }

  // AW3
  if (awards === null || awards.length === 0 || !Array.isArray(m?.winnerTeamSeats)) out.push(noMeasure("AW3", L.AW3, "awards·winnerTeamSeats"));
  else {
    const last = awards[awards.length - 1][0];
    out.push(result("AW3", L.AW3, m.winnerTeamSeats.includes(last) ? [] : [`마지막 패 좌석 ${last} 은 이긴 팀 [${m.winnerTeamSeats}] 이 아님`]));
  }

  // AW4
  let known = "";
  const pb = m?.plateBox;
  if (!isNum(pb?.top) || !isNum(pb?.left) || !isNum(pb?.width) || !isNum(pb?.height) || !isNum(m?.viewport?.w) || !isNum(m?.stageTop) || !isNum(m?.panelTop)) out.push(noMeasure("AW4", L.AW4, "plateBox·viewport·stageTop·panelTop"));
  else {
    const bad = [];
    const wantW = Math.min(AWARD_PLATE.maxW, m.viewport.w - AWARD_PLATE.sideMargin);
    if (Math.abs(pb.width - wantW) > 2) bad.push(`폭 ${pb.width} ≠ ${wantW} (±2)`);
    if (Math.abs(pb.height - AWARD_PLATE.h) > 2) bad.push(`높이 ${pb.height} ≠ ${AWARD_PLATE.h} (±2)`);
    // 스테이지 윗변 = 자막 띠가 있으면 띠 아랫변, 없으면 헤더 아랫변(14페이즈, readAwardState)
    const wantTop = m.stageTop + AWARD_PLATE.topGap;
    if (Math.abs(pb.top - wantTop) > 2) bad.push(`위 ${pb.top} ≠ 스테이지 윗변 ${m.stageTop} + ${AWARD_PLATE.topGap} (±2)`);
    const center = pb.left + pb.width / 2;
    if (Math.abs(center - m.viewport.w / 2) > 2) bad.push(`가로 가운데 ${center} ≠ ${m.viewport.w / 2} (±2)`);
    const below = m.panelTop - (pb.top + pb.height);
    // 14-08 UI#14 알려진 한계: 가장 낮은 폰(360×560)은 자막 띠가 스테이지 윗부분을 차지해 패 아래 스테이지가 150 에 못 미친다 — 이 한 항목만 판정에서 빼고 잰 값을 AW4k 로 남긴다(문턱은 그대로)
    if (below < AWARD_PLATE.belowMin) {
      if (m.knownShortLimit === true) known = `패 아래 스테이지 ${below} < ${AWARD_PLATE.belowMin}`;
      else bad.push(`패 아래 스테이지 ${below} < ${AWARD_PLATE.belowMin}`);
    }
    out.push(result("AW4", L.AW4, bad));
  }

  // AW5
  const fb = m?.floatBox;
  if (!isNum(fb?.left) || !isNum(fb?.width) || !isNum(fb?.height) || !isNum(fb?.bottom) || !isNum(m?.viewport?.w) || !isNum(m?.panelTop)) out.push(noMeasure("AW5", L.AW5, "floatBox·viewport·panelTop"));
  else {
    const bad = [];
    if (Math.abs(fb.width - AWARD_PLATE.float) > 1 || Math.abs(fb.height - AWARD_PLATE.floatH) > 1) bad.push(`상자 ${fb.width}×${fb.height} ≠ ${AWARD_PLATE.float}×${AWARD_PLATE.floatH} (±1, 상자가 곧 면 48)`);
    const right = m.viewport.w - (fb.left + fb.width);
    if (Math.abs(right - AWARD_PLATE.floatRight) > 1) bad.push(`오른쪽 여백 ${right} ≠ ${AWARD_PLATE.floatRight} (±1)`);
    // 위 칸: 윗변이 `패널 윗변 − 8 − (칸 둘 48×2 + 사이 8)` 이하 — 아래 칸(11-12 의 [옷장] 자리)을 비운 위 칸에 선다. 14-07 이름표로 단추 상자가 길어져도 줄 자리(.mf-float 의 예약 높이)는
    // 그대로라 윗변은 옛 자리이고 아랫변이 길어진 만큼 내려온다 — 시상 중에는 아래 칸 단추가 없어(옷장은 시상이 끝나야 나온다) 겹치지 않고, 아랫변은 패널 윗변 − 8 안에 있어야 한다
    const topLimit = m.panelTop - AWARD_PLATE.floatGap - (AWARD_PLATE.float * 2 + AWARD_PLATE.floatGap) + 1;
    if (fb.top > topLimit) bad.push(`윗변 ${fb.top} > ${topLimit} (아래 칸 자리를 비운 위 칸이어야 함)`);
    if (fb.bottom > m.panelTop - AWARD_PLATE.floatGap + 0.5) bad.push(`아랫변 ${fb.bottom} > 패널 윗변 − 8 (${m.panelTop - AWARD_PLATE.floatGap})`);
    out.push(result("AW5", L.AW5, bad));
  }

  // AW6
  if (!Array.isArray(m?.progress) || awards === null) out.push(noMeasure("AW6", L.AW6, "progress·awards"));
  else {
    const bad = [];
    m.progress.forEach((text, i) => {
      const hit = /^(\d+) \/ (\d+)$/.exec(typeof text === "string" ? text : "");
      if (!hit) bad.push(`#${i + 1} "${text}" 가 'k / n' 꼴이 아님`);
      else {
        if (Number(hit[1]) !== i + 1) bad.push(`#${i + 1} k ${hit[1]} ≠ ${i + 1}`);
        if (Number(hit[2]) !== awards.length) bad.push(`#${i + 1} n ${hit[2]} ≠ ${awards.length}`);
      }
    });
    if (m.progress.length === 0) bad.push("진행 숫자를 한 번도 못 읽음");
    out.push(result("AW6", L.AW6, bad));
  }

  // AW7
  if (typeof m?.titleDuring !== "string" || typeof m?.titleAfter !== "string" || !Object.hasOwn(RESULT_WIN_TITLE, m?.winner)) out.push(noMeasure("AW7", L.AW7, "titleDuring·titleAfter·winner"));
  else {
    const bad = [];
    if (m.titleDuring !== AWARD_CEREMONY_TITLE) bad.push(`시상 중 헤더 "${m.titleDuring}" ≠ "${AWARD_CEREMONY_TITLE}"`);
    if (m.titleAfter !== RESULT_WIN_TITLE[m.winner]) bad.push(`끝난 뒤 헤더 "${m.titleAfter}" ≠ "${RESULT_WIN_TITLE[m.winner]}"`);
    out.push(result("AW7", L.AW7, bad));
  }

  // AW8
  if (!isNum(m?.floatAfter)) out.push(noMeasure("AW8", L.AW8, "floatAfter"));
  else out.push(result("AW8", L.AW8, m.floatAfter === 0 ? [] : [`끝난 뒤 [넘기기] ${m.floatAfter}개가 남음`]));

  // AW10
  if (!m?.costumesDuring || typeof m.costumesDuring !== "object" || !m?.costumesAfter || typeof m.costumesAfter !== "object" || !m?.jobBySeat || typeof m.jobBySeat !== "object") out.push(noMeasure("AW10", L.AW10, "costumesDuring·costumesAfter·jobBySeat"));
  else {
    const bad = [];
    for (const [seat, job] of Object.entries(m.jobBySeat)) {
      const want = Object.hasOwn(RESULT_JOB_OUTFIT, job) ? RESULT_JOB_OUTFIT[job] : undefined;
      if (want === undefined) bad.push(`자리 ${seat} 직업 "${job}" 를 모름`);
      else if (m.costumesDuring[seat] !== want) bad.push(`시상 중 자리 ${seat}(${job}) 의상 ${m.costumesDuring[seat] ?? "없음"} ≠ ${want}`);
    }
    if (Object.keys(m.costumesAfter).length !== 0) bad.push(`끝난 뒤 직업 의상이 남음: ${JSON.stringify(m.costumesAfter)}`);
    out.push(result("AW10", L.AW10, bad));
  }
  if (known !== "") out.push({ id: "AW4k", label: "알려진 한계(UI#14): 낮은 폰의 패 아래 스테이지가 150 에 못 미침(판정 아님)", ok: true, detail: known, info: true });
  return out;
}

/**
 * 시상식 한 번의 읽기(한 번의 evaluate). `.mf-result` 가 없으면 null.
 * { title(h1 글자), shown(훅 shown), awards(훅 awards 사본), costumes(훅), stageTop(헤더 아랫변, 방 위 끝 기준), panelTop, viewport,
 *   plate: { id, top, left, width, height, text } | null, float: { left, top, width, height, bottom, count(진행 숫자 글자) } | null, floatCount([data-float="skip"] 수), bodyOverflow }
 */
export function readAwardState(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    if (!root) return null;
    const rr = root.getBoundingClientRect();
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const header = root.querySelector("header")?.getBoundingClientRect() ?? null;
    const band = document.querySelector("[data-host-band] .mv-host__band")?.getBoundingClientRect() ?? null;
    const panel = root.querySelector("[data-result-panel]")?.getBoundingClientRect() ?? null;
    const plateEl = root.querySelector("[data-award-plate]");
    const pr = plateEl ? plateEl.getBoundingClientRect() : null;
    const floatEl = root.querySelector('[data-float="skip"]');
    const fr = floatEl ? floatEl.getBoundingClientRect() : null;
    const hook = window.__mfResult ?? null;
    return {
      title: text(root.querySelector("h1")),
      shown: hook ? hook.shown : -1,
      awards: hook ? hook.awards.map((a) => [a[0], a[1]]) : [],
      costumes: hook ? { ...hook.costumes } : {},
      // 14페이즈: 시상 패는 자막 띠 아래 8 에 선다 — 띠가 있으면 띠 면 아랫변, 없으면 헤더 아랫변이 스테이지 윗변이다
      stageTop: band ? band.bottom - rr.top : header ? header.bottom - rr.top : Number.NaN,
      panelTop: panel ? panel.top - rr.top : Number.NaN,
      viewport: { w: rr.width, h: rr.height },
      plate: pr ? { id: plateEl.getAttribute("data-award-id") ?? "", top: pr.top - rr.top, left: pr.left - rr.left, width: pr.width, height: pr.height, text: text(plateEl) } : null,
      float: fr ? { left: fr.left - rr.left, top: fr.top - rr.top, width: fr.width, height: fr.height, bottom: fr.bottom - rr.top, count: text(floatEl.querySelector("[data-float-count]")) } : null,
      floatCount: root.querySelectorAll('[data-float="skip"]').length,
    };
  });
}

// ---------- 11-12 다시 하기 ----------

const within = (a, b, tol) => isNum(a) && isNum(b) && Math.abs(a - b) <= tol;
const has = (x) => x !== undefined && x !== null;

/**
 * RM1~RM12 다시 하기(알약·확인 시트·쉬는 사람·의상·채팅·쉬었던 사람) 판정 (11-12, 결정 D-11~D-13·D-16·D-26, UI-SPEC D·G). 입력:
 *  viewport {w,h} 페이지 · pillBox {width,height} 알약 · inputWidth 입력칸 폭 · guestPill {before,after} 각 {ready,pressed} 손님이 한 번 누르기 전후
 *  count {text,dim,disabled}·countWant {n,m,minPlayers} 방장 알약(준비 전) · countFull·countFullWant 준비를 마친 뒤 · toast 인원 부족 토스트 · minPlayers · roundUnchanged 토스트 뒤 판이 그대로
 *  sheet {title,buttons,faces,extraText} 쉬게 될 사람 확인 시트 · restingWant 쉬게 될 사람 수 · round {before,after,phases} 시작 뒤 참가자 페이지 · benchView 쉬는 페이지에 BenchView
 *  bench {timers,chatInputs,floats,text,buttons} 쉬는 페이지 · looks·looksWant 새 판의 look · chat {before,old} 이전 판 채팅 · sat {seats,want,chipsOnSat,chips,participants} 다음 결과
 *  ceremony {pillActive,plateVsPill,skipVsPill} 시상 중 · early {disabled} 승리 조명 전.
 * RM1 알약 96×48 ±1 · 입력칸 폭 − 192 ±2 · RM2 손님 토글 전후 반대 · RM3 방장 n/m · RM4 4명 미만 토스트 · RM5 쉬는 사람 시트 · RM6 시작 후 round + 1·assigning·BenchView ·
 * RM7 쉬는 페이지에 타이머·채팅 입력·떠 있는 버튼 없음 · RM8 의상 유지 · RM9 이전 판 채팅 0줄 · RM10 쉬었던 사람 sat·칩 없음 · RM11 시상 중 알약 활성·겹침 없음 · RM12 조명 전 비활성.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
 */
export function rematchChecks(m) {
  const L = {
    RM1: "다시 하기: 알약 96×48, 입력칸 폭 = 폭 − 192",
    RM2: "다시 하기: 손님 알약 토글 전후로 data-ready·aria-pressed 가 반대",
    RM3: "다시 하기: 방장 알약 'n/m' 이 준비 상태와 같고 n < 최소면 흐림",
    RM4: "다시 하기: 인원 부족 탭 → 토스트 '{최소}명부터 시작해요' 뿐(판은 그대로)",
    RM5: "다시 하기: 쉬게 될 사람 시트(얼굴 수·'이번 판은 쉬어요'·[시작][취소])",
    RM6: "다시 하기: 시작 뒤 round + 1·assigning, 쉬는 사람은 BenchView",
    RM7: "다시 하기: 쉬는 사람 화면에 타이머·채팅 입력·떠 있는 버튼 없음",
    RM8: "다시 하기: 고른 의상이 새 판에도 유지",
    RM9: "다시 하기: 새 판 기록 칸에 이전 판 채팅 0줄",
    RM10: "다시 하기: 쉬었던 사람은 결과에 sat 이고 직업 칩이 없음",
    RM11: "다시 하기: 시상 중 알약 활성, 패·[넘기기]와 겹치지 않음",
    RM12: "다시 하기: 승리 조명 전 알약 비활성",
  };
  const out = [];
  const add = (id, bad) => out.push(result(id, L[id], bad));
  const miss = (id, what) => out.push(noMeasure(id, L[id], what));

  // RM1
  if (!isNum(m?.viewport?.w) || !isNum(m?.pillBox?.width) || !isNum(m?.pillBox?.height) || !isNum(m?.inputWidth)) miss("RM1", "viewport·pillBox·inputWidth");
  else {
    const bad = [];
    if (!within(m.pillBox.width, READY_PILL.w, 1) || !within(m.pillBox.height, READY_PILL.h, 1)) bad.push(`알약 ${m.pillBox.width}x${m.pillBox.height} ≠ ${READY_PILL.w}x${READY_PILL.h}`);
    const want = m.viewport.w - READY_PILL.inputExtra;
    if (!within(m.inputWidth, want, 2)) bad.push(`입력칸 폭 ${m.inputWidth} ≠ ${want}`);
    add("RM1", bad);
  }

  // RM2
  const gb = m?.guestPill?.before;
  const ga = m?.guestPill?.after;
  if (!has(gb?.ready) || !has(gb?.pressed) || !has(ga?.ready) || !has(ga?.pressed)) miss("RM2", "guestPill.before·after");
  else {
    const bad = [];
    if (gb.ready === ga.ready) bad.push(`data-ready 가 안 바뀜(${gb.ready})`);
    if (gb.pressed === ga.pressed) bad.push(`aria-pressed 가 안 바뀜(${gb.pressed})`);
    if (gb.ready !== gb.pressed || ga.ready !== ga.pressed) bad.push(`data-ready 와 aria-pressed 가 다름(전 ${gb.ready}/${gb.pressed} 후 ${ga.ready}/${ga.pressed})`);
    add("RM2", bad);
  }

  // RM3
  const countBad = (c, w, name) => {
    const bad = [];
    if (!/^\d+\/\d+$/.test(c.text ?? "")) bad.push(`${name} 꼴이 n/m 이 아님(${c.text})`);
    else if (c.text !== `${w.n}/${w.m}`) bad.push(`${name} ${c.text} ≠ ${w.n}/${w.m}`);
    const dim = w.n < w.minPlayers;
    if (c.dim !== dim) bad.push(`${name} 흐림 ${c.dim} ≠ ${dim}(n ${w.n} / 최소 ${w.minPlayers})`);
    if (c.disabled !== dim) bad.push(`${name} aria-disabled ${c.disabled} ≠ ${dim}`);
    return bad;
  };
  if (!has(m?.count?.text) || !has(m?.countWant?.n) || !has(m?.countFull?.text) || !has(m?.countFullWant?.n)) miss("RM3", "count·countWant·countFull·countFullWant");
  else add("RM3", [...countBad(m.count, m.countWant, "준비 전"), ...countBad(m.countFull, m.countFullWant, "준비 후")]);

  // RM4
  if (!has(m?.toast) || !isNum(m?.minPlayers) || !has(m?.roundUnchanged)) miss("RM4", "toast·minPlayers·roundUnchanged");
  else {
    const bad = [];
    if (m.toast !== `${m.minPlayers}명부터 시작해요`) bad.push(`토스트 '${m.toast}'`);
    if (m.roundUnchanged !== true) bad.push("토스트 뒤 판이 바뀜");
    add("RM4", bad);
  }

  // RM5
  if (!m?.sheet || !isNum(m?.restingWant)) miss("RM5", "sheet·restingWant");
  else {
    const bad = [];
    if (m.sheet.title !== "이번 판은 쉬어요") bad.push(`한 줄 '${m.sheet.title}'`);
    if (JSON.stringify(m.sheet.buttons) !== JSON.stringify(["시작", "취소"])) bad.push(`버튼 ${JSON.stringify(m.sheet.buttons)}`);
    if (m.sheet.faces !== m.restingWant) bad.push(`얼굴 ${m.sheet.faces}개 ≠ 쉬는 사람 ${m.restingWant}명`);
    if ((m.sheet.extraText ?? "x") !== "") bad.push(`그 밖의 보이는 글 '${m.sheet.extraText}'`);
    add("RM5", bad);
  }

  // RM6
  if (!isNum(m?.round?.before) || !isNum(m?.round?.after) || !Array.isArray(m?.round?.phases) || !has(m?.benchView)) miss("RM6", "round·benchView");
  else {
    const bad = [];
    if (m.round.after !== m.round.before + 1) bad.push(`round ${m.round.before} → ${m.round.after}`);
    if (m.round.phases.length === 0 || !m.round.phases.every((p) => p === "assigning" || p === "roleReveal")) bad.push(`참가자 단계 [${m.round.phases}]`);
    if (m.benchView !== true) bad.push("쉬는 페이지에 BenchView 없음");
    add("RM6", bad);
  }

  // RM7
  const b = m?.bench;
  if (!b || !isNum(b.timers) || !isNum(b.chatInputs) || !isNum(b.floats) || !Array.isArray(b.buttons)) miss("RM7", "bench");
  else {
    const bad = [];
    if (b.timers !== 0) bad.push(`타이머 ${b.timers}개`);
    if (b.chatInputs !== 0) bad.push(`채팅 입력 ${b.chatInputs}개`);
    if (b.floats !== 0) bad.push(`떠 있는 버튼 ${b.floats}개`);
    if (b.text !== "이번 판은 쉬어요") bad.push(`한 줄 '${b.text}'`);
    if (JSON.stringify(b.buttons) !== JSON.stringify(["나가기"])) bad.push(`버튼 ${JSON.stringify(b.buttons)}`);
    add("RM7", bad);
  }

  // RM8
  if (!m?.looks || !m?.looksWant) miss("RM8", "looks·looksWant");
  else {
    const seats = Object.keys(m.looksWant);
    const bad = [];
    if (seats.length === 0) bad.push("기대 look 이 비어 있음");
    for (const seat of seats) if (m.looks[seat] !== m.looksWant[seat]) bad.push(`좌석 ${seat}: ${m.looks[seat]} ≠ ${m.looksWant[seat]}`);
    add("RM8", bad);
  }

  // RM9
  if (!isNum(m?.chat?.before) || !isNum(m?.chat?.old)) miss("RM9", "chat");
  else {
    const bad = [];
    if (m.chat.before < 1) bad.push("이전 판에 보낸 줄이 없어 검사가 비어 있음");
    if (m.chat.old !== 0) bad.push(`이전 판 줄 ${m.chat.old}줄이 남음`);
    add("RM9", bad);
  }

  // RM10
  const sat = m?.sat;
  if (!sat || !Array.isArray(sat.seats) || !Array.isArray(sat.want) || !isNum(sat.chipsOnSat) || !isNum(sat.chips) || !isNum(sat.participants)) miss("RM10", "sat");
  else {
    const bad = [];
    if (sat.want.length === 0) bad.push("쉬었던 사람 기대가 비어 있음");
    if (!sameSet(sat.seats, sat.want)) bad.push(`sat [${sat.seats}] ≠ [${sat.want}]`);
    if (sat.chipsOnSat !== 0) bad.push(`sat 에 직업 칩 ${sat.chipsOnSat}개`);
    if (sat.chips !== sat.participants) bad.push(`칩 ${sat.chips}개 ≠ 참가자 ${sat.participants}명`);
    add("RM10", bad);
  }

  // RM11
  const c = m?.ceremony;
  if (!c || !has(c.pillActive) || !has(c.plateVsPill) || !has(c.skipVsPill)) miss("RM11", "ceremony");
  else {
    const bad = [];
    if (c.pillActive !== true) bad.push("시상 중 알약이 비활성");
    if (c.plateVsPill !== false) bad.push("패와 알약이 겹침");
    if (c.skipVsPill !== false) bad.push("[넘기기]와 알약이 겹침");
    add("RM11", bad);
  }

  // RM12
  if (!has(m?.early?.disabled)) miss("RM12", "early");
  else add("RM12", m.early.disabled === true ? [] : ["승리 조명 전인데 알약이 활성"]);

  return out;
}

/**
 * 결과 화면 알약 한 장: 알약·입력칸·패·[넘기기] 사각형과 알약 상태. 알약이 없으면 pill 은 null. 결과 화면이 아니면 null.
 * (rect 는 뷰포트 좌표다 — 겹침 판정은 같은 좌표계끼리만 본다)
 */
export function readRematchState(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    if (!root) return null;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const pillEl = root.querySelector("[data-ready-pill]");
    const input = root.querySelector("[data-chat-input]");
    const toast = root.querySelector(".mv-toast.is-on");
    const hook = window.__mfResult ?? null;
    return {
      viewportW: window.innerWidth,
      pill: rect(pillEl),
      text: text(pillEl),
      ready: pillEl?.getAttribute("data-ready") ?? null,
      pressed: pillEl?.getAttribute("aria-pressed") ?? null,
      count: pillEl?.getAttribute("data-ready-count") ?? null,
      dim: pillEl?.getAttribute("data-dim") === "true",
      disabled: pillEl?.getAttribute("aria-disabled") === "true",
      inactive: pillEl?.getAttribute("data-inactive") === "true",
      label: pillEl?.getAttribute("aria-label") ?? null,
      inputWidth: input ? input.getBoundingClientRect().width : Number.NaN,
      plate: rect(root.querySelector("[data-award-plate]")),
      skip: rect(root.querySelector('[data-float="skip"]')),
      dress: rect(root.querySelector('[data-float="dress"]')),
      toast: toast ? text(toast) : "",
      chips: root.ownerDocument.querySelectorAll("[data-role-chip]").length,
      stage: hook ? hook.stage : null,
      sat: hook && Array.isArray(hook.sat) ? [...hook.sat] : [],
    };
  });
}

/** 확인 시트(쉬게 될 사람)의 보이는 모양: 열려 있는 dialog 의 얼굴 수·한 줄·버튼·그 밖의 글. 열려 있지 않으면 null */
export function readRestSheet(page) {
  return page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    if (!dlg || !dlg.querySelector("[data-rest-faces]")) return null;
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const title = text(dlg.querySelector("h2"));
    const buttons = [...dlg.querySelectorAll("button")].map((b) => text(b)).filter(Boolean);
    const rest = text(dlg).replace(title, "");
    const extraText = buttons.reduce((t, b) => t.replace(b, ""), rest).replace(/\s+/g, "");
    return { title, buttons, faces: dlg.querySelectorAll("[data-rest-face]").length, extraText };
  });
}

/** 쉬는 사람 화면: 타이머·채팅 입력·떠 있는 버튼 수, 보이는 글 한 줄, 버튼 이름들. BenchView 가 아니면 null */
export function readBenchView(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-bench-view]");
    if (!root) return null;
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      // 14페이즈: 남은 시간은 자막 띠([data-host-time])가 맡는다 — 쉬는 사람 화면에 시간 표시가 없어야 한다는 기대는 그대로다
      timers: document.querySelectorAll(".mf-timer, [data-timer], [data-host-time]").length,
      chatInputs: document.querySelectorAll("[data-chat-input]").length,
      floats: document.querySelectorAll("[data-float], [data-float-stack]").length,
      text: text(root.querySelector("p")),
      buttons: [...root.querySelectorAll("button")].map((b) => text(b)).filter(Boolean),
    };
  });
}
