// 18.1 화면 E2E (18.1-08) — RED 단계 뼈대: 판정 함수는 늘 실패 줄을 돌려준다.
export const ROLE_CARD_MAX_LINES = 3;
export const ROLE_CARD_MAX_LINES_SHORT_DOCTOR = 4;
export const ROLE_SHEET_MAX_LINES = 4;
export const TUTORIAL_ROLE_MAX_LINES = 4;
export const ROLE_ART_MIN_H = 64;
export const CARD_INNER_INSET = 14;
export const TOD_BOX = 44;
export const TOD_HEADER_Y = Object.freeze([8, 52]);
export const REVEAL_DOCK_GAP = 8;
export const TOD_IDS = Object.freeze(["morning", "day", "dusk", "night"]);
export const TOD_BY_PHASE = Object.freeze({});
export const TOD_ABSENT_PHASES = Object.freeze([]);

const fail = (id) => ({ id, label: id, ok: false, detail: "미구현" });
export const revealCardChecks = () => ["A1a", "A1b", "A1c", "A1d", "A1e"].map(fail);
export const revealStageChecks = () => ["A2a", "A2b"].map(fail);
export const roleLineBoxChecks = (_b, { id }) => fail(id);
export const todChecks = () => ["D1", "D4", "D5"].map(fail);
export const todAbsentChecks = () => fail("D2");
