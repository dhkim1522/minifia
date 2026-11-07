// 11페이즈 결과 화면 E2E 판정·읽기 (11-05, 결정 D-1·D-11·D-25, UI-SPEC A-1·A-5).
// 흐름 본문(resultFlow)은 flows.mjs 에 있고, 이 파일은 순수 검사 함수와 페이지 읽기 도우미만 둔다(flows.mjs 가 이미 3천 줄이다).
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

/** 기본판(결정 0072)에서 보이는 결과 탭 — 귓속말 탭은 RULESET.whisper 일 때만 있다(src/game/resultText.ts RESULT_TABS_SHOWN 의 사본) */
export const RESULT_TAB_IDS_BASIC = Object.freeze(RESULT_TAB_IDS.filter((id) => id !== "whisper"));

/** 직업 → 3D 의상 id (src/world/ghostOutfit.ts JOB_OUTFIT 의 사본) */
export const RESULT_JOB_OUTFIT = Object.freeze({ mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });

/** 헤더 승리 한 줄 (src/game/verdict.ts RESULT_TEXT.title 의 사본) */
export const RESULT_WIN_TITLE = Object.freeze({ citizenWin: "시민 승리", mafiaWin: "마피아 승리" });

/** 아래 패널 높이: 기록 칸 LOG_H(96 · 방 높이 780 이상 152) + 92 = 188 · 244 */
export const RESULT_PANEL_H = Object.freeze({ short: 188, tall: 244, tallRoomMinH: 780 });
/**
 * 14-06(TOOL-01): 입력줄의 [동작]·[보내기]·[유언]이 면 36 + 4 + 라벨 한 줄(14px × 1.4 = 19.6) 이름표 단추(높이 59.6)가 되어, 입력칸 48 이 아래 정렬이라 패널이 그만큼(11.6) 는다.
 * 위 188 · 244 는 앱 상수(chatUi.ts)의 값 그대로이고, 방 높이로 기대를 계산하는 판정(RS5·RT3)이 이 값을 더한다.
 */
export const TOOL_ROW_EXTRA = 36 + 4 + 19.6 - 48;
/** 이 높이(px) 미만의 폰은 방 틀 높이 575 미만의 짧은 폰(360×560 probe) — 14-08 UI#14 알려진 한계 적용 대상 */
export const SHORT_PHONE_H = 575;

/** 시상식(11-09, UI-SPEC B-3·G): 패 기하와 떠 있는 [넘기기] 기하. test/unit/e2eContract.test.ts 가 앱 CSS 와 대조한다 */
/** floatH: 14-07 이름표로 [넘기기] 단추 상자가 면 48 + 4 + 라벨 19.6 = 71.6 이 되었다(폭 48 그대로) */
export const AWARD_PLATE = Object.freeze({ maxW: 328, sideMargin: 32, h: 96, topGap: 8, belowMin: 150, float: 48, floatH: 48 + 4 + 19.6, floatRight: 16, floatGap: 8 });

/** 시상식 헤더 제목 (src/game/awardText.ts CEREMONY_TITLE 의 사본) */
export const AWARD_CEREMONY_TITLE = "시상식";

/** 다시 하기 알약(11-12, UI-SPEC D-1·G): 96×48, 입력줄 = [입력 flex][보내기 이름표 단추 44(14-06, 옛 48)][알약 96], 요소 사이 8, 좌우 16 → 입력칸 폭 = 폭 − 188. test/unit/e2eContract.test.ts 가 앱 CSS 와 대조한다 */
export const READY_PILL = Object.freeze({ w: 96, h: 48, inputExtra: 188 });

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
    RS5: "결과 화면: 아래 패널 높이 188 · 244 (+ 이름표 줄 11.6)",
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
  const want = isNum(m?.panelWant) ? m.panelWant : isNum(m?.roomH) ? (m.roomH >= RESULT_PANEL_H.tallRoomMinH ? RESULT_PANEL_H.tall : RESULT_PANEL_H.short) + TOOL_ROW_EXTRA : null;
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

// ---------- 11-07 탭 패널 ----------

const TAB_MIN = 44;
/** 새 탭 점이 붙는 탭(기록 탭·전체 탭은 없다) */
const DOT_TAB_IDS = ["ghost", "mafia", "whisper"];

/**
 * 탭 패널 판정(11-07, UI-SPEC A-3·G). 입력은 두 묶음 중 있는 것만 판정한다: { layout?, reveal? }. 묶음이 있는데 값이 비면 `측정값 없음` 으로 실패한다.
 * layout(최종 상태 한 페이지): roomH · tabBoxes [{id,w,h}] · panelCollapsedH · panelExpandedH(마피아 탭을 연 높이) · inputPresent(확장에서 [data-chat-input]) ·
 *   iconColors { 탭id: 아이콘 계산 색 } · crimson(진홍 토큰의 계산 색) · separators(마피아 탭 구분선 글자들) · dots { before, after }(점이 붙은 탭 id, 열기 전/마피아를 연 뒤) · headerBottom · panelTop(방 위 끝 기준)
 *   RT1 탭 44×44 이상 다섯 · RT3 접힌 188/244 ±1 · RT4 확장 min(round(0.7×방 높이),520) ±2 · RT5 확장에서 입력칸 없음 · RT6 마피아 탭만 진홍 · RT7 구분선은 없거나 모두 `{n}밤` ·
 *   RT8 점: 열기 전 마피아·유령·귓속말, 마피아를 연 뒤 유령·귓속말 · RT9 헤더 아래 62 이상이고 확장 패널이 헤더를 가리지 않음
 * reveal(연출 구간을 지나는 방장 페이지): tabsBefore {stage,count} · tabsAfter {stage,count} · live [{phase,count}] · paused {stageAtOpen,chipsAtOpen,stageLater,chipsLater,waitedMs} ·
 *   tapExpanded {expandedBefore,expandedAfter,stageBefore,stageAfter} · tapCollapsed {stageBefore,stageAfter}
 *   RT2 첫 뒤집기 전 탭 1개·뒤집기 시작 뒤 5개 · RT10 판 중 탭 0건 · RT11 확장 중 시계 정지 · RT12 확장 중 무대 탭은 접기만 · RT13 접힌 무대 탭은 4600 이후로 건너뜀
 * 반환: 항목별 { id, label, ok, detail }.
 */
export function resultTabChecks(m = {}, { whisper = false } = {}) {
  const out = [];
  const tabIds = whisper ? RESULT_TAB_IDS : RESULT_TAB_IDS_BASIC;
  if (m.layout !== undefined) out.push(...layoutTabChecks(m.layout, tabIds));
  if (m.reveal !== undefined) out.push(...revealTabChecks(m.reveal, tabIds));
  return out;
}

function layoutTabChecks(l, tabIds) {
  const L = {
    RT1: `탭 패널: 탭 버튼 ${tabIds.length}개, 모두 44×44 이상`,
    RT3: "탭 패널: 접힌 패널 높이 188 · 244 (+ 이름표 줄 11.6)",
    RT4: "탭 패널: 마피아 탭 확장 높이 min(round(0.7 × 방 높이), 520)",
    RT5: "탭 패널: 확장에서 입력칸 없음",
    RT6: "탭 패널: 마피아 탭 아이콘만 진홍",
    RT7: "탭 패널: 마피아 탭 구분선은 없거나 모두 `{n}밤`",
    RT8: tabIds.includes("whisper") ? "탭 패널: 새 탭 점 — 열기 전 마피아·유령·귓속말, 마피아를 연 뒤 유령·귓속말" : "탭 패널: 새 탭 점 — 열기 전 마피아·유령, 마피아를 연 뒤 유령(귓속말 탭 없음, 결정 0072)",
    RT9: "탭 패널: 헤더 아래 62 이상, 확장 패널이 헤더를 가리지 않음",
  };
  const out = [];

  // RT1
  if (!Array.isArray(l?.tabBoxes)) out.push(noMeasure("RT1", L.RT1, "tabBoxes"));
  else {
    const bad = [];
    if (l.tabBoxes.length !== tabIds.length) bad.push(`탭 ${l.tabBoxes.length}개 ≠ ${tabIds.length}개`);
    for (const b of l.tabBoxes) if (!isNum(b?.w) || !isNum(b?.h) || b.w < TAB_MIN - 0.5 || b.h < TAB_MIN - 0.5) bad.push(`${b?.id} ${b?.w}×${b?.h}`);
    out.push(result("RT1", L.RT1, bad));
  }

  // RT3
  const wantCollapsed = isNum(l?.roomH) ? (l.roomH >= RESULT_PANEL_H.tallRoomMinH ? RESULT_PANEL_H.tall : RESULT_PANEL_H.short) + TOOL_ROW_EXTRA : null;
  if (!isNum(l?.panelCollapsedH) || wantCollapsed === null) out.push(noMeasure("RT3", L.RT3, "panelCollapsedH·roomH"));
  else out.push(result("RT3", L.RT3, Math.abs(l.panelCollapsedH - wantCollapsed) <= 1 ? [] : [`접힌 높이 ${l.panelCollapsedH} ≠ ${wantCollapsed} (±1)`]));

  // RT4
  if (!isNum(l?.panelExpandedH) || !isNum(l?.roomH)) out.push(noMeasure("RT4", L.RT4, "panelExpandedH·roomH"));
  else {
    const want = Math.min(Math.round(0.7 * l.roomH), 520);
    out.push(result("RT4", L.RT4, Math.abs(l.panelExpandedH - want) <= 2 ? [] : [`확장 높이 ${l.panelExpandedH} ≠ ${want} (±2, 방 ${l.roomH})`]));
  }

  // RT5
  if (typeof l?.inputPresent !== "boolean") out.push(noMeasure("RT5", L.RT5, "inputPresent"));
  else out.push(result("RT5", L.RT5, l.inputPresent ? ["확장된 패널에 입력칸이 있음"] : []));

  // RT6
  if (!l?.iconColors || typeof l.crimson !== "string" || typeof l.iconColors.mafia !== "string") out.push(noMeasure("RT6", L.RT6, "iconColors·crimson"));
  else {
    const bad = [];
    if (l.iconColors.mafia !== l.crimson) bad.push(`마피아 탭 아이콘 ${l.iconColors.mafia} ≠ 진홍 ${l.crimson}`);
    for (const [id, c] of Object.entries(l.iconColors)) if (id !== "mafia" && c === l.crimson) bad.push(`${id} 탭 아이콘도 진홍`);
    out.push(result("RT6", L.RT6, bad));
  }

  // RT7
  // 15-10: 산 마피아의 밤 채팅 화면이 없어(15-08) 마피아 탭이 비어 있을 수 있다 — 구분선은 없어도 되고, 있으면 모두 `{n}밤` 꼴이다.
  if (!Array.isArray(l?.separators)) out.push(noMeasure("RT7", L.RT7, "separators"));
  else out.push(result("RT7", L.RT7, l.separators.every((t) => /^\d+밤$/.test(t)) ? [] : [`구분선 "${l.separators.join('", "')}"`]));

  // RT8
  if (!Array.isArray(l?.dots?.before) || !Array.isArray(l?.dots?.after)) out.push(noMeasure("RT8", L.RT8, "dots"));
  else {
    const bad = [];
    const dotsBefore = DOT_TAB_IDS.filter((id) => tabIds.includes(id));
    const dotsAfter = ["ghost", "whisper"].filter((id) => tabIds.includes(id));
    if (!sameSet(l.dots.before, dotsBefore)) bad.push(`열기 전 점 [${[...l.dots.before].sort()}] ≠ [${dotsBefore}]`);
    if (!sameSet(l.dots.after, dotsAfter)) bad.push(`마피아를 연 뒤 점 [${[...l.dots.after].sort()}] ≠ [${dotsAfter}]`);
    out.push(result("RT8", L.RT8, bad));
  }

  // RT9
  if (!isNum(l?.headerBottom) || !isNum(l?.panelTop)) out.push(noMeasure("RT9", L.RT9, "headerBottom·panelTop"));
  else {
    const bad = [];
    if (l.headerBottom < 62 - 1) bad.push(`헤더 아래 ${l.headerBottom} < 62`);
    if (l.panelTop < l.headerBottom - 1) bad.push(`패널 윗변 ${l.panelTop} 이 헤더 아래 ${l.headerBottom} 를 가림`);
    out.push(result("RT9", L.RT9, bad));
  }
  return out;
}

function revealTabChecks(r, tabIds) {
  const L = {
    RT2: `탭 패널: 첫 뒤집기 전 탭 1개, 뒤집기 시작 뒤 ${tabIds.length}개`,
    RT10: "탭 패널: 판이 도는 동안 시민 화면에 탭 0건",
    RT11: "탭 패널: 확장 중 연출 시계가 멈춤",
    RT12: "탭 패널: 확장 중 무대 탭은 접기만 함(건너뛰기 아님)",
    RT13: "탭 패널: 접힌 무대 탭은 4600 이후로 건너뜀",
  };
  const out = [];

  // RT2
  if (!isNum(r?.tabsBefore?.count) || !isNum(r?.tabsAfter?.count)) out.push(noMeasure("RT2", L.RT2, "tabsBefore·tabsAfter"));
  else if (r.tabsBefore.stage !== "gather") out.push(noMeasure("RT2", L.RT2, `뒤집기 전 구간을 놓침(단계 ${r.tabsBefore.stage})`));
  else if (r.tabsAfter.stage === "gather") out.push(noMeasure("RT2", L.RT2, "뒤집기 시작 뒤 표본이 아직 모임 구간"));
  else {
    const bad = [];
    if (r.tabsBefore.count !== 1) bad.push(`뒤집기 전 탭 ${r.tabsBefore.count}개 ≠ 1`);
    if (r.tabsAfter.count !== tabIds.length) bad.push(`뒤집기 시작 뒤 탭 ${r.tabsAfter.count}개 ≠ ${tabIds.length}`);
    out.push(result("RT2", L.RT2, bad));
  }

  // RT10
  if (!Array.isArray(r?.live) || r.live.length === 0) out.push(noMeasure("RT10", L.RT10, "live"));
  else {
    const bad = r.live.filter((x) => x.count !== 0).map((x) => `${x.phase} 에 탭 ${x.count}개`);
    out.push(result("RT10", L.RT10, bad));
  }

  // RT11
  const p = r?.paused;
  if (!p || !isNum(p.chipsAtOpen) || !isNum(p.chipsLater) || typeof p.stageAtOpen !== "string" || typeof p.stageLater !== "string" || !isNum(p.waitedMs)) out.push(noMeasure("RT11", L.RT11, "paused"));
  else if (p.waitedMs < 1000) out.push(noMeasure("RT11", L.RT11, `기다린 시간 ${p.waitedMs}ms < 1000`));
  else {
    const bad = [];
    if (p.stageLater !== p.stageAtOpen) bad.push(`단계 ${p.stageAtOpen} → ${p.stageLater}`);
    if (p.chipsLater !== p.chipsAtOpen) bad.push(`칩 ${p.chipsAtOpen} → ${p.chipsLater}`);
    out.push(result("RT11", L.RT11, bad));
  }

  // RT12
  const t = r?.tapExpanded;
  if (!t || typeof t.expandedBefore !== "boolean" || typeof t.expandedAfter !== "boolean" || typeof t.stageBefore !== "string" || typeof t.stageAfter !== "string") out.push(noMeasure("RT12", L.RT12, "tapExpanded"));
  else {
    const bad = [];
    if (!t.expandedBefore) bad.push("탭 전에 확장되어 있지 않았음");
    if (t.expandedAfter) bad.push("무대를 탭해도 접히지 않음");
    if (t.stageAfter !== t.stageBefore) bad.push(`확장 중 탭이 건너뜀(${t.stageBefore} → ${t.stageAfter})`);
    out.push(result("RT12", L.RT12, bad));
  }

  // RT13
  const c = r?.tapCollapsed;
  if (typeof c?.stageBefore !== "string" || typeof c?.stageAfter !== "string") out.push(noMeasure("RT13", L.RT13, "tapCollapsed"));
  else if (c.stageBefore !== "gather" && c.stageBefore !== "flip") out.push(noMeasure("RT13", L.RT13, `탭 전 단계 ${c.stageBefore} — 연출 구간을 놓침`));
  else out.push(result("RT13", L.RT13, ["light", "announce", "final"].includes(c.stageAfter) ? [] : [`탭 뒤 단계 ${c.stageAfter} (light 이후여야 함)`]));
  return out;
}

/**
 * 결과 탭 패널 한 번의 읽기(한 번의 evaluate). `.mf-result` 가 없으면 null.
 * { stage, chips(훅), tab(훅), tabs: [id…], tabBoxes: [{id,w,h}], expanded(data-expanded), panelH, panelTop, headerBottom, roomH, inputPresent, separators: [글자…],
 *   dots: [점 붙은 탭 id…], iconColors: {탭id: 색}, crimson(--crimson-300 계산 색), bodyText(탭 몸통 글자) }
 */
export function readResultTabs(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    if (!root) return null;
    const rr = root.getBoundingClientRect();
    const panel = root.querySelector("[data-result-panel]");
    const pr = panel ? panel.getBoundingClientRect() : null;
    const header = root.querySelector("header")?.getBoundingClientRect() ?? null;
    const tabEls = [...root.querySelectorAll("[data-result-tab]")];
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const probe = document.createElement("i");
    probe.style.color = "var(--crimson-300)";
    root.appendChild(probe);
    const crimson = getComputedStyle(probe).color;
    probe.remove();
    return {
      stage: window.__mfResult?.stage ?? root.getAttribute("data-result-stage") ?? "",
      chips: window.__mfResult?.chips ?? -1,
      tab: window.__mfResult?.tab ?? "",
      tabs: tabEls.map((e) => e.getAttribute("data-result-tab")),
      tabBoxes: tabEls.map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.getAttribute("data-result-tab"), w: r.width, h: r.height };
      }),
      expanded: panel?.getAttribute("data-expanded") === "true",
      panelH: pr ? pr.height : Number.NaN,
      panelTop: pr ? pr.top - rr.top : Number.NaN,
      headerBottom: header ? header.bottom - rr.top : Number.NaN,
      roomH: rr.height,
      inputPresent: panel ? panel.querySelector("[data-chat-input]") !== null : false,
      separators: [...root.querySelectorAll("[data-result-divider]")].map((e) => text(e)),
      dots: tabEls.filter((e) => e.querySelector("[data-result-dot]")).map((e) => e.getAttribute("data-result-tab")),
      iconColors: Object.fromEntries(tabEls.map((e) => [e.getAttribute("data-result-tab"), getComputedStyle(e.querySelector("svg")).color])),
      crimson,
      bodyText: text(root.querySelector("[data-result-body]")),
    };
  });
}

// ---------- 11-09 시상식 ----------

/**
 * AW1~AW10 시상식 판정(11-09, 결정 D-7·D-24·D-25, UI-SPEC B-3·G). 입력:
 *  viewport {w,h} · stageTop 스테이지 윗변(헤더 아래, 방 위 끝 기준) · panelTop 패널 윗변(= 스테이지 아래 끝, 같은 기준)
 *  plateBox {top,left,width,height} 첫 패의 사각형 · floatBox {left,top,width,height,bottom} 첫 패가 뜬 때의 [넘기기]
 *  progress 패마다 읽은 진행 숫자 문자열 · awards 훅 window.__mfResult.awards ([좌석, 칭호 id][]) · observed 패마다 읽은 data-award-id 열
 *  participants 참가자 수 · winnerTeamSeats 이긴 팀 좌석(서버 view 기준) · winner 승자 · titleDuring 시상 중 헤더 · titleAfter 끝난 뒤 헤더 · floatAfter 끝난 뒤 [data-float="skip"] 수
 *  pause { indexOpen, indexLater, waitedMs, floatHidden, plateKept, indexResumed } 확장 탭을 연 때 패 index · 기다린 뒤 index · 기다린 시간 · [넘기기] 숨김 · 패 유지 · 접은 뒤 index
 *  costumesDuring 첫 패가 뜬 때 런타임이 입은 의상 표 · costumesAfter 시상식 뒤 표 · jobBySeat 서버 view 의 직업 표
 * AW1 패 수 == 참가자 수 == 훅 목록 길이 · AW2 관찰한 칭호 순서 == 훅(서버) 순서 · AW3 마지막 패가 이긴 팀 · AW4 패 기하(AW-PLATE) · AW5 [넘기기] 기하 · AW6 진행 'k / n' ·
 * AW7 헤더 '시상식' → 승리 한 줄 · AW8 끝난 뒤 [넘기기] 없음 · AW9 확장 탭 동안 일시정지 · AW10 시상 중 직업 의상 → 끝난 뒤 걷힘.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
 */
export function awardChecks(m) {
  const L = {
    AW1: "시상식: 패 수 == 참가자 수(모두 하나 이상 받음)",
    AW2: "시상식: 패 순서 == 서버가 보낸 칭호 순서",
    AW3: "시상식: 마지막 패가 이긴 팀",
    AW4: "시상식: 패 기하 AW-PLATE (폭 min(328, 폭 − 32) · 높이 96 · 스테이지 윗변 + 8 · 아래 150 이상)",
    AW5: "시상식: [넘기기] 폭 48(상자 높이 71.6) · 오른쪽 16 · 위 칸",
    AW6: "시상식: 진행 숫자 'k / n' 이 패마다 1씩 오름",
    AW7: "시상식: 헤더 '시상식' → 끝난 뒤 승리 한 줄",
    AW8: "시상식: 끝난 뒤 [넘기기] 없음",
    AW9: "시상식: 확장 탭이 열린 동안 일시정지(패 유지, [넘기기] 숨김), 접으면 이어짐",
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
    if (Math.abs(fb.width - AWARD_PLATE.float) > 1 || Math.abs(fb.height - AWARD_PLATE.floatH) > 1) bad.push(`상자 ${fb.width}×${fb.height} ≠ ${AWARD_PLATE.float}×${AWARD_PLATE.floatH} (±1, 면 48 + 라벨)`);
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

  // AW9
  const p = m?.pause;
  if (!isNum(p?.indexOpen) || !isNum(p?.indexLater) || !isNum(p?.waitedMs) || typeof p?.floatHidden !== "boolean" || typeof p?.plateKept !== "boolean" || !isNum(p?.indexResumed)) out.push(noMeasure("AW9", L.AW9, "pause"));
  else {
    const bad = [];
    if (p.waitedMs < 2600) bad.push(`기다린 시간 ${p.waitedMs}ms < 2600 (한 창 2500ms 보다 길어야 일시정지가 증명됨)`);
    if (p.indexLater !== p.indexOpen) bad.push(`확장 중 패 index ${p.indexOpen} → ${p.indexLater} (멈춰야 함)`);
    if (!p.floatHidden) bad.push("확장 중 [넘기기]가 보임");
    if (!p.plateKept) bad.push("확장 중 패가 사라짐");
    if (!(p.indexResumed > p.indexOpen)) bad.push(`접은 뒤 패 index ${p.indexResumed} (> ${p.indexOpen} 이어야 이어짐)`);
    out.push(result("AW9", L.AW9, bad));
  }

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

// ---------- 11-11 기록 탭 ----------

/**
 * TL1~TL7 기록 탭(일차 카드 띠·하루 상세) 판정 (11-11, 결정 D-8, UI-SPEC C). 입력:
 *  roomH 방 높이 · dayCount 서버 view 의 일차 수(result.summary 길이) · panel {top,bottom,height} 확장 패널 사각형
 *  cards [{n,left,top,width,height,pressed}] DOM 순서의 카드 사각형·aria-pressed · scrollLeft 띠의 가로 스크롤
 *  detailText 하루 상세의 보이는 글자 · detailBox {top,bottom,overflowY} 하루 상세 사각형·세로 overflow
 *  chips [{n,role}] 카드 낮 칸의 직업 칩 · executed [{n,seat}] 서버 view 의 처형된 날 · jobBySeat 서버 view 의 직업 표
 *  switched {cards,target,before,after} 다른 카드를 누르기 전후의 data-day-detail (카드가 한 장이면 그 카드를 눌러도 그대로)
 * TL1 카드 수 == 일차 수 · TL2 카드 72×112 ±2, 간격 8 ±2 · TL3 첫 카드만 눌림·scrollLeft 0 · TL4 문장 없음(숫자·공백 외 글자 0) · TL5 처형된 날 칩 직업 == 진짜 직업 ·
 * TL6 확장 높이 min(round(0.7×방),520) ±2, 상세가 패널 안에서 스크롤 · TL7 카드 전환. 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
 */
export function timelineChecks(m) {
  const L = {
    TL1: "기록 탭: 일차 카드 수 == 일차 수",
    TL2: "기록 탭: 카드 72×112 (±2), 사이 간격 8 (±2)",
    TL3: "기록 탭: 첫 일차만 선택돼 있고 띠는 처음 위치(scrollLeft 0)",
    TL4: "기록 탭: 하루 상세에 문장이 없다 (숫자·공백 외 보이는 글자 0)",
    TL5: "기록 탭: 처형된 날 카드의 직업 칩 == 결과의 진짜 직업",
    TL6: "기록 탭: 확장 패널 min(round(0.7 × 방 높이), 520) ±2, 상세가 패널 안에서 스크롤",
    TL7: "기록 탭: 다른 카드를 누르면 하루 상세의 일차가 바뀜",
  };
  const out = [];
  const cards = Array.isArray(m?.cards) ? m.cards : null;

  // TL1
  if (cards === null || !isNum(m?.dayCount)) out.push(noMeasure("TL1", L.TL1, "cards·dayCount"));
  else out.push(result("TL1", L.TL1, cards.length === m.dayCount && cards.length > 0 ? [] : [`카드 ${cards.length}장 ≠ 일차 ${m.dayCount}`]));

  // TL2
  if (cards === null || cards.some((c) => !isNum(c?.left) || !isNum(c?.width) || !isNum(c?.height))) out.push(noMeasure("TL2", L.TL2, "cards 사각형"));
  else {
    const bad = [];
    for (const c of cards) {
      if (Math.abs(c.width - TIMELINE_CARD.w) > 2) bad.push(`${c.n}일차 폭 ${c.width} ≠ ${TIMELINE_CARD.w} (±2)`);
      if (Math.abs(c.height - TIMELINE_CARD.h) > 2) bad.push(`${c.n}일차 높이 ${c.height} ≠ ${TIMELINE_CARD.h} (±2)`);
    }
    for (let i = 1; i < cards.length; i++) {
      const gap = cards[i].left - (cards[i - 1].left + cards[i - 1].width);
      if (Math.abs(gap - TIMELINE_CARD.gap) > 2) bad.push(`${cards[i - 1].n}~${cards[i].n}일차 간격 ${gap} ≠ ${TIMELINE_CARD.gap} (±2)`);
    }
    out.push(result("TL2", L.TL2, bad));
  }

  // TL3
  if (cards === null || cards.length === 0 || !isNum(m?.scrollLeft)) out.push(noMeasure("TL3", L.TL3, "cards·scrollLeft"));
  else {
    const bad = [];
    if (cards[0].pressed !== true) bad.push("첫 일차가 선택되지 않음");
    if (cards.slice(1).some((c) => c.pressed === true)) bad.push("첫 일차 외에도 선택된 카드가 있음");
    if (Math.abs(m.scrollLeft) > 1) bad.push(`scrollLeft ${m.scrollLeft} ≠ 0`);
    out.push(result("TL3", L.TL3, bad));
  }

  // TL4
  if (typeof m?.detailText !== "string") out.push(noMeasure("TL4", L.TL4, "detailText"));
  else {
    const words = m.detailText.replace(/[\d\s]/g, "");
    out.push(result("TL4", L.TL4, words === "" ? [] : [`숫자 외 글자 "${words.slice(0, 20)}"`]));
  }

  // TL5
  if (!Array.isArray(m?.chips) || !Array.isArray(m?.executed) || m?.jobBySeat == null) out.push(noMeasure("TL5", L.TL5, "chips·executed·jobBySeat"));
  else {
    const bad = [];
    for (const e of m.executed) {
      const chip = m.chips.find((c) => c.n === e.n);
      const want = m.jobBySeat[e.seat];
      if (!chip) bad.push(`${e.n}일차 처형 카드에 직업 칩 없음`);
      else if (chip.role !== want) bad.push(`${e.n}일차 칩 ${chip.role} ≠ 진짜 직업 ${want}`);
    }
    for (const c of m.chips) if (!m.executed.some((e) => e.n === c.n)) bad.push(`${c.n}일차는 처형이 없는데 직업 칩이 있음`);
    out.push(result("TL5", L.TL5, bad));
  }

  // TL6
  const pn = m?.panel;
  const db = m?.detailBox;
  if (!isNum(m?.roomH) || !isNum(pn?.height) || !isNum(pn?.top) || !isNum(pn?.bottom) || !isNum(db?.top) || !isNum(db?.bottom) || typeof db?.overflowY !== "string") out.push(noMeasure("TL6", L.TL6, "roomH·panel·detailBox"));
  else {
    const bad = [];
    const want = Math.min(Math.round(0.7 * m.roomH), 520);
    if (Math.abs(pn.height - want) > 2) bad.push(`확장 높이 ${pn.height} ≠ ${want} (±2, 방 ${m.roomH})`);
    if (db.top < pn.top - 1 || db.bottom > pn.bottom + 1) bad.push(`상세 [${db.top}, ${db.bottom}] 가 패널 [${pn.top}, ${pn.bottom}] 밖`);
    if (!["auto", "scroll"].includes(db.overflowY)) bad.push(`상세 overflow-y ${db.overflowY} (스크롤 불가)`);
    out.push(result("TL6", L.TL6, bad));
  }

  // TL7
  const sw = m?.switched;
  if (!isNum(sw?.cards) || sw?.before == null || sw?.after == null || sw?.target == null) out.push(noMeasure("TL7", L.TL7, "switched"));
  else if (sw.cards < 2) out.push(result("TL7", L.TL7, String(sw.after) === String(sw.before) ? [] : [`카드 한 장인데 상세가 ${sw.before} → ${sw.after} 로 바뀜`]));
  else out.push(result("TL7", L.TL7, String(sw.after) === String(sw.target) && String(sw.after) !== String(sw.before) ? [] : [`${sw.target}일차 카드를 눌렀는데 상세 ${sw.before} → ${sw.after}`]));
  return out;
}

/**
 * 기록 탭 한 번의 읽기(한 번의 evaluate). 기록 탭이 열려 있어야 한다. `.mf-result` 나 카드가 없으면 null.
 * { roomH, panel {top,bottom,height}, cards [{n,left,top,width,height,pressed}], scrollLeft, detail(현재 data-day-detail 값),
 *   detailText, detailBox {top,bottom,overflowY}, chips [{n,role}] }
 */
export function readTimeline(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mf-result");
    const panelEl = root?.querySelector("[data-result-panel]");
    const strip = root?.querySelector("[data-timeline-strip]");
    if (!root || !panelEl || !strip) return null;
    const rr = root.getBoundingClientRect();
    const pr = panelEl.getBoundingClientRect();
    const detailEl = root.querySelector("[data-day-detail]");
    const dr = detailEl ? detailEl.getBoundingClientRect() : null;
    const cardEls = [...root.querySelectorAll("[data-day-card]")];
    return {
      roomH: rr.height,
      panel: { top: pr.top - rr.top, bottom: pr.bottom - rr.top, height: pr.height },
      cards: cardEls.map((e) => {
        const r = e.getBoundingClientRect();
        return { n: Number(e.getAttribute("data-day-card")), left: r.left, top: r.top - rr.top, width: r.width, height: r.height, pressed: e.getAttribute("aria-pressed") === "true" };
      }),
      scrollLeft: strip.scrollLeft,
      detail: detailEl ? detailEl.getAttribute("data-day-detail") : null,
      detailText: detailEl ? (detailEl.textContent ?? "") : undefined,
      detailBox: dr ? { top: dr.top - rr.top, bottom: dr.bottom - rr.top, overflowY: getComputedStyle(detailEl).overflowY } : null,
      chips: cardEls
        .map((e) => ({ n: Number(e.getAttribute("data-day-card")), role: e.querySelector("[data-half=day] [data-role-chip]")?.getAttribute("data-role-chip") ?? null }))
        .filter((c) => c.role !== null),
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
 * RM1 알약 96×48 ±1 · 입력칸 폭 − 188 ±2 · RM2 손님 토글 전후 반대 · RM3 방장 n/m · RM4 4명 미만 토스트 · RM5 쉬는 사람 시트 · RM6 시작 후 round + 1·assigning·BenchView ·
 * RM7 쉬는 페이지에 타이머·채팅 입력·떠 있는 버튼 없음 · RM8 의상 유지 · RM9 이전 판 채팅 0줄 · RM10 쉬었던 사람 sat·칩 없음 · RM11 시상 중 알약 활성·겹침 없음 · RM12 조명 전 비활성.
 * 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
 */
export function rematchChecks(m) {
  const L = {
    RM1: "다시 하기: 알약 96×48, 입력칸 폭 = 폭 − 188",
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
