import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { channelOf } from "../../shared/game/audience";
import { pickTarget } from "../../shared/game/night";
import { DISCUSSION_MS, MORNING_MS, NIGHT_MS, NOMINATION_MS, PHASE_DEFS } from "../../shared/game/phases";
import { ROOM_TTL_MS, attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { rolesInPlay } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { buildPreview, buildView } from "../../shared/game/view";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, castVerdicts, startedAt, stateWithVerdict } from "../helpers/voteState";

const PLAYER_COUNTS = [4, 5, 6, 7, 8] as const;
const SEEDS = [1, 42, 20260101] as const;
/**
 * 옛 처형 여부·후보 선택·후보 공개 세 단계를 뺀 열두 단계(게임 진행 순서). 옛 흐름 전용 단계의 view 시험은 08-28 이 지웠고(DAY-07),
 * 새 흐름의 지목·찬반 단계는 흐름 전환(08-11)이 이 목록에 더했다.
 */
const PHASES: readonly PhaseId[] = [
  "lobby",
  "assigning",
  "roleReveal",
  "dayAnnounce",
  "discussion",
  "nomination",
  "defense",
  "verdict",
  "execution",
  "night",
  "morning",
  "ended",
];
/** 역할 확인 이후 단계들(본인 역할이 실리는 단계). */
const REVEALING_PHASES = [
  "roleReveal",
  "dayAnnounce",
  "discussion",
  "nomination",
  "defense",
  "verdict",
  "execution",
  "night",
  "morning",
  "ended",
] as const;
const START_AT = 10_000;

/** n 명이 모두 연결된 대기실. id·token 은 서로 부분 문자열이 아니도록 길고 고유하게 만든다. */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/**
 * 단계별 상태를 실제 전이(startGame, tick)로 만든다. 그 단계에 처음 들어간 순간이다. 밤 판정에는 시드 난수를 넘긴다.
 * 표 없이 마감만 따라가면 변론·처형과 ended 에 닿지 못한다(Pitfall 12) — 그 단계들은 실제 투표를 넣는 도우미로 만든다.
 * 닿지 못하는 단계를 마감만으로 기다리면 끝없이 도는 루프가 되므로 횟수 상한을 둔다.
 */
function stateAt(phase: PhaseId, n: number, seed: number): RoomState {
  if (phase === "defense" || phase === "verdict" || phase === "execution") {
    return stateWithVerdict(n, seed, phase);
  }
  if (phase === "ended") return endedState(n, seed, "citizen");
  const lobby = lobbyOf(n);
  if (phase === "lobby") return lobby;
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  for (let guard = 0; state.phase !== phase; guard += 1) {
    if (state.phaseEndsAt === null || guard > 60) throw new Error(`stateAt ${phase} failed at ${state.phase}`);
    state = tick(state, state.phaseEndsAt, seededRandInt(seed));
  }
  return state;
}

const aliveSeats = (state: RoomState): number[] => state.players.filter(isAlive).map((p) => p.seat).sort((a, b) => a - b);

/**
 * 실제 지목·찬반·마감 전이로 종료(ended)까지 끌고 간 상태. 매일 team 이 citizen 이면 살아 있는 마피아 한 명을,
 * mafia 이면 살아 있는 비마피아 한 명을 지목으로 몰고 변론자를 뺀 생존자 전원이 찬성해 처형한다. 밤에는 아무도 행동하지 않아 아무도 죽지 않는다.
 * 승패가 나는 날까지 반복하고(마피아 수 또는 시민 쪽 수만큼) 상한을 넘으면 던진다 — 승패가 안 나는 판에서 끝없이 돌지 않는다.
 */
function endedState(n: number, seed: number, team: "citizen" | "mafia"): RoomState {
  let s = startedAt(n, seed, "nomination");
  for (let day = 1; day <= 10; day += 1) {
    if (s.phase !== "nomination") throw new Error(`endedState: expected nomination, got ${s.phase}`);
    const living = s.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
    const candidate = living.find((p) => (p.role === "mafia") === (team === "citizen"))!.seat;
    const other = living.find((p) => p.seat !== candidate)!.seat;
    s = castPoints(s, Object.fromEntries(living.map((p) => [p.seat, p.seat === candidate ? other : candidate])));
    for (const step of ["defense", "verdict"] as const) {
      s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 3));
      if (s.phase !== step) throw new Error(`endedState: expected ${step}, got ${s.phase}`);
    }
    s = castVerdicts(s, Object.fromEntries(living.filter((p) => p.seat !== candidate).map((p) => [p.seat, true])));
    s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 3));
    if (s.phase !== "execution") throw new Error(`endedState: expected execution, got ${s.phase}`);
    s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 4)); // ended 또는 night
    if (s.phase === "ended") return s;
    s = advanceTo(s, "nomination", seed); // 밤 → 아침 → 다음 날 낮 두 단계 → 지목(밤에 행동이 없으니 승패는 이 사이에 나지 않는다)
  }
  throw new Error(`endedState: no winner for ${n}/${seed}/${team}`);
}

/** 한 명을 탈락시킨 상태(관전자 viewer 를 만들 때). 표를 던지기 전/후 어느 쪽에서 불러도 된다. */
const withDead = (state: RoomState, seat: number): RoomState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p)),
});

/** 뷰를 깊이 훑어 모든 키 경로를 모은다. 배열 원소는 `[]` 로 접는다. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${prefix}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => {
      const path = prefix === "" ? k : `${prefix}.${k}`;
      return [path, ...keyPaths(v, path)];
    });
  }
  return [];
}

const lastKey = (path: string): string => path.slice(path.lastIndexOf(".") + 1).replace(/\[\]$/, "");

/** 뷰의 모든 문자열 잎을 `경로 → 값` 으로 모은다. 배열 원소는 `[]` 로 접는다. */
function stringLeaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v) => stringLeaves(v, `${prefix}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => stringLeaves(v, prefix === "" ? k : `${prefix}.${k}`));
  }
  return [];
}

/** 역할 값으로 쓰이는 문자열. 이 값은 허용 경로에만 나올 수 있다(RESEARCH Pitfall 2). */
const ROLE_LIKE_VALUES: ReadonlySet<string> = new Set(["mafia", "police", "doctor", "citizen", "none"]);
/** 허용 경로: 본인 역할·이번 판 구성. 그 밖의 경로에 이 값이 있으면 누출이다(채팅은 뷰에 없다, 결정 0017-7). */
const ALLOWED_ROLE_VALUE_PATHS: ReadonlySet<string> = new Set([
  "me.role",
  "day.roles[]",
]);

/** 탈락한 viewer 에게만 더해지는 허용 경로(결정 0021): 모든 사람의 실제 직업. */
const SPECTATE_ROLE_VALUE_PATH = "spectate.seats[].job";
/** ended 단계 view 에서만 더해지는 허용 경로(D-17, Pitfall 10): 결과 화면의 모든 직업. 이 경로는 ended 전에는 누출이다. */
const RESULT_ROLE_VALUE_PATH = "result.seats[].job";

function roleValueLeaks(view: RoomView, spectator = false): string[] {
  return stringLeaves(view)
    .filter(
      ([path, value]) =>
        ROLE_LIKE_VALUES.has(value) &&
        !ALLOWED_ROLE_VALUE_PATHS.has(path) &&
        !(spectator && path === SPECTATE_ROLE_VALUE_PATH) &&
        !(view.phase === "ended" && path === RESULT_ROLE_VALUE_PATH) &&
        // 07-10: me.chat 의 값 mafia 는 그 밤의 산 마피아 본인 view 에서만 나온다(받을 권리가 있는 조건으로만 허용, 탈락한 마피아는 ghost).
        !(path === "me.chat" && value === "mafia" && view.phase === "night" && view.me.role === "mafia" && !spectator),
    )
    .map(([path, value]) => `${path}=${value}`);
}

/** view 최상위에 올 수 있는 키(허용 목록). */
const TOP_KEYS: ReadonlySet<string> = new Set([
  "code", "phase", "phaseEndsAt", "phaseDurationMs", "serverNow", "minPlayers", "maxPlayers", "players", "me", "day", "spectate", "result",
]);

/** 그 밤에 살아 있는 각 역할이 지금 고른 대상 seat(중복 없음·오름차순). */
function livePicksOf(s: RoomState, role: "mafia" | "police" | "doctor"): number[] {
  return [
    ...new Set(
      s.players.filter((q) => q.role === role && isAlive(q) && q.nightPick !== undefined).map((q) => q.nightPick as number),
    ),
  ].sort((a, b) => a - b);
}

/** 역할별 일지 줄의 키 모양(결정 0027-11). 시민·역할 없음은 일지가 없다. */
const JOURNAL_KEYS: Readonly<Record<string, string>> = { police: "isMafia,n,target", mafia: "died,n,target", doctor: "n,target" };

/** 상태에 쌓인 그 사람의 일지를 와이어 모양으로 복사한다(기대값). */
function journalOf(p: Player): unknown[] | undefined {
  if (p.role === "police") return (p.investigations ?? []).map((r) => ({ n: r.n, target: r.target, isMafia: r.isMafia }));
  if (p.role === "mafia") return (p.assassinations ?? []).map((r) => ({ n: r.n, target: r.target, died: r.died }));
  if (p.role === "doctor") return (p.treatments ?? []).map((r) => ({ n: r.n, target: r.target }));
  return undefined;
}

/**
 * 일지 한 곳 규칙(D-10, 결정 0026-7): me.records 는 경찰·마피아·의사 본인에게만, 역할을 싣는 모든 단계에서(탈락한 뒤에도),
 * 본인 역할의 일지 하나만, 줄은 그 역할의 키뿐이고 값은 숫자·불리언뿐이다. 다른 역할의 줄 키는 view 어디에도 없다.
 */
function journalViolations(s: RoomState, viewer: Player, view: RoomView, phase: PhaseId, tag: string): string[] {
  const out: string[] = [];
  const revealing = PHASE_DEFS[phase].revealsOwnRole;
  const want = revealing && viewer.role !== undefined && viewer.role in JOURNAL_KEYS;
  if (("records" in view.me) !== want) return [`${tag}: me.records presence ${"records" in view.me} want ${want}`];
  if (want) {
    if (flat(view.me.records) !== flat(journalOf(viewer))) out.push(`${tag}: me.records ${flat(view.me.records)}`);
    for (const r of view.me.records ?? []) {
      if (Object.keys(r).sort().join(",") !== JOURNAL_KEYS[viewer.role!]) out.push(`${tag}: records keys ${Object.keys(r).join(",")}`);
      for (const v of Object.values(r)) if (typeof v === "string") out.push(`${tag}: string in records`);
    }
  }
  // 다른 역할의 줄 키는 view 어디에도 없다(마피아 암살일지의 died 는 마피아 view 밖에 없다)
  // 결과(result.summary)의 밤 줄에는 died 가 있다 — ended 에서 모두에게 같은 공개 정보라 일지 키 검사에서 뺀다(D-17).
  const keys = new Set(keyPaths(view).filter((path) => !path.startsWith("result")).map(lastKey));
  if (keys.has("died") && viewer.role !== "mafia") out.push(`${tag}: died key outside mafia view`);
  if (keys.has("isMafia") && viewer.role !== "police") out.push(`${tag}: isMafia key outside police view`);
  // 남의 일지와 같은 줄이 다른 역할 viewer 의 view 에 나타나지 않는다
  for (const q of s.players) {
    if (q.role === viewer.role || q.role === undefined || !(q.role in JOURNAL_KEYS)) continue;
    for (const line of journalOf(q) ?? []) {
      if (JSON.stringify(view).includes(JSON.stringify(line))) out.push(`${tag}: line of ${q.role} in view`);
    }
  }
  return out;
}

/**
 * 관전(결정 0021) 규칙 한 곳: 탈락한 본인이고 역할을 싣는 단계에서만 spectate 가 있다.
 * seats 는 모든 사람의 실제 직업({seat, job}, seat 오름차순), picks 는 밤에만 {mafia, police, doctor}.
 * 같은 규칙으로 역할 값 누출도 검사해, 살아 있는 viewer 에게는 spectate 경로 허용이 없다.
 */
function spectateViolations(s: RoomState, viewer: Player, view: RoomView, phase: PhaseId, tag: string): string[] {
  const out: string[] = [];
  const want = !isAlive(viewer) && PHASE_DEFS[phase].revealsOwnRole;
  if (("spectate" in view) !== want) return [`${tag}: spectate presence ${"spectate" in view} want ${want}`];
  if (want && view.spectate) {
    const seats = [...s.players].sort((a, b) => a.seat - b.seat).map((q) => ({ seat: q.seat, job: q.role }));
    if (flat(view.spectate.seats) !== flat(seats)) out.push(`${tag}: spectate.seats ${flat(view.spectate.seats)}`);
    for (const e of view.spectate.seats) if (Object.keys(e).sort().join(",") !== "job,seat") out.push(`${tag}: spectate seat keys`);
    const wantKeys = phase === "night" ? "picks,seats" : "seats";
    if (Object.keys(view.spectate).sort().join(",") !== wantKeys) out.push(`${tag}: spectate keys ${Object.keys(view.spectate).join(",")}`);
    if (phase === "night") {
      const picks = { mafia: livePicksOf(s, "mafia"), police: livePicksOf(s, "police"), doctor: livePicksOf(s, "doctor") };
      if (flat(view.spectate.picks) !== flat(picks)) out.push(`${tag}: spectate.picks ${flat(view.spectate.picks)}`);
    }
  }
  for (const leak of roleValueLeaks(view, want)) out.push(`${tag}: role-like value outside allowed paths: ${leak}`);
  return out;
}

/** 서버 전용 키(결정 0036-12): 어떤 단계의 어떤 view 경로에도 없다. winner·execution 은 같은 이름의 view 키(result.winner·day.execution)가 있어 넣지 않고 경로로 검사한다. */
const SERVER_ONLY_KEYS: readonly string[] = [
  "claimLast", "claimChoice", "claimShown", "claimChanged", "claimPick", "claimOrder", "claimIdx",
  "claimStart", "claimDone", "claims", "nightPick", "investigations", "lastPhrase",
  "execVote", "candidateVote", "verdict", "nightLog", "lastExecPhrase", "nightNote",
];
/** view.day 가 있는 열 단계. 이 밖의 단계 뷰에는 day 키 자체가 없다(D-07). */
const DAY_VIEW_PHASES: ReadonlySet<PhaseId> = new Set([
  "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning", "ended",
]);
const ME_KEYS: ReadonlySet<string> = new Set([
  "seat", "isHost", "role", "allies", "testMode", "testRole", "testBots", "testBotVote", "pick", "allyPicks", "records", "chat", "endDiscussion", "verdictVote",
  "nightTally", "nightSure", // 밤 산 마피아 본인에게만(결정 0061-7) — 아래 "마피아 집계" describe 가 조건을 단언한다
]);
const DAY_KEYS: ReadonlySet<string> = new Set([
  "n", "roles", "voteLog", "morning", "candidate", "execution", "noExecution", "points", "endCount", "voted", "verdict",
]);
const keysOf = (value: unknown): string => Object.keys((value ?? {}) as object).sort().join(",");

/**
 * 열네 단계 허용 키와 받는 사람 규칙 한 곳(결정 0036-12, D-17, D-34). richStateAt 이 만드는 상태에 맞춘 기대값이다:
 * 후보가 있는 공개 구간 이후, 표 없이 지나온 밤(처형 무효 noVotes), 일부만 던진 투표 단계.
 *  - candidate 는 공개·변론·처형에만, execution 은 처형에만(seat 한 키), noExecution 은 처형 무효로 온 밤에만(reason 한 키)
 *  - result 는 ended 에만, voteLog 줄은 키가 정해져 있고 그날 cand 는 공개 구간 전에 없다(D-19)
 */
function phaseKeyViolations(s: RoomState, viewer: Player, view: RoomView, phase: PhaseId, tag: string): string[] {
  const out: string[] = [];
  for (const key of Object.keys(view)) if (!TOP_KEYS.has(key)) out.push(`${tag}: top-level key ${key}`);
  if (("result" in view) !== (phase === "ended")) out.push(`${tag}: result presence ${"result" in view}`);
  for (const key of Object.keys(view.me)) if (!ME_KEYS.has(key)) out.push(`${tag}: me key ${key}`);
  // 8페이즈: day.verdict({yes,no,passed}, execution 단계)는 서버 전용 RoomState.verdict 와 이름만 같은 공개 와이어 필드다 — 그 한 경로만 허용한다.
  for (const path of keyPaths(view)) if (SERVER_ONLY_KEYS.includes(lastKey(path)) && path !== "day.verdict") out.push(`${tag}: server-only key at ${path}`);

  // 내 채널(07-10): 서버 상태로 정한 channelOf 와 같고, 말할 수 없으면 키가 없다. 본인 view 의 me 밖에는 chat 키가 없다.
  const wantChat = channelOf(s, viewer.id);
  if (("chat" in view.me) !== (wantChat !== null)) out.push(`${tag}: me.chat presence ${"chat" in view.me}`);
  else if (wantChat !== null && view.me.chat !== wantChat) out.push(`${tag}: me.chat value ${String(view.me.chat)}`);
  for (const path of keyPaths(view)) if (lastKey(path) === "chat" && path !== "me.chat") out.push(`${tag}: chat key outside me at ${path}`);

  // day: 열한 단계에만, 키는 허용 목록 안
  if (("day" in view) !== DAY_VIEW_PHASES.has(phase)) return [...out, `${tag}: day presence ${"day" in view}`];
  const day = view.day;
  if (day === undefined) {
    if ("result" in view) out.push(`${tag}: result without day`);
    return out;
  }
  if (!Array.isArray(day.voteLog)) out.push(`${tag}: day.voteLog is not an array`);
  for (const key of Object.keys(day)) if (!DAY_KEYS.has(key)) out.push(`${tag}: day key ${key}`);
  const wantCandidate = phase === "defense" || phase === "verdict" || phase === "execution";
  if (("candidate" in day) !== wantCandidate) out.push(`${tag}: day.candidate presence ${"candidate" in day}`);
  else if (wantCandidate && day.candidate !== s.verdict?.candidate) out.push(`${tag}: day.candidate value`);
  const wantExecution = phase === "execution";
  if (("execution" in day) !== wantExecution) out.push(`${tag}: day.execution presence ${"execution" in day}`);
  else if (wantExecution) {
    if (keysOf(day.execution) !== "seat") out.push(`${tag}: day.execution keys ${keysOf(day.execution)}`);
    if (day.execution?.seat !== s.verdict?.candidate) out.push(`${tag}: day.execution.seat`);
  }
  // 표 없이 지나온 밤(richStateAt 의 night)에만, 이유 코드 하나
  const wantNoExecution = phase === "night";
  if (("noExecution" in day) !== wantNoExecution) out.push(`${tag}: day.noExecution presence ${"noExecution" in day}`);
  else if (wantNoExecution && flat(day.noExecution) !== flat({ reason: "noVotes" })) out.push(`${tag}: day.noExecution ${flat(day.noExecution)}`);

  // voteLog: 줄마다 키가 정해져 있다. 여부 줄은 yes·no·passed 세 키뿐(개인 줄 없음), cand 는 votes(+candidate), 그날 cand 는 공개 구간 전에 없다.
  for (const line of day.voteLog ?? []) {
    if (!["exec,n", "cand,exec,n"].includes(keysOf(line))) out.push(`${tag}: voteLog line keys ${keysOf(line)}`);
    if (keysOf(line.exec) !== "no,passed,yes") out.push(`${tag}: voteLog exec keys ${keysOf(line.exec)}`);
    if (line.cand !== undefined) {
      if (!["votes", "candidate,votes"].includes(keysOf(line.cand))) out.push(`${tag}: voteLog cand keys ${keysOf(line.cand)}`);
      for (const v of line.cand.votes) if (keysOf(v) !== "seat,target") out.push(`${tag}: voteLog vote keys ${keysOf(v)}`);
    }
  }

  // 결과: ended 에서만, 모든 직업(seat 오름차순)과 승리 팀과 판 요약. 요약 줄 키는 정해져 있다.
  if (phase === "ended" && view.result !== undefined) {
    const { result } = view;
    if (keysOf(result) !== "seats,summary,winner") out.push(`${tag}: result keys ${keysOf(result)}`);
    if (result.winner !== s.winner) out.push(`${tag}: result.winner ${result.winner} want ${String(s.winner)}`);
    const seats = [...s.players].sort((a, b) => a.seat - b.seat).map((q) => ({ seat: q.seat, job: q.role }));
    if (flat(result.seats) !== flat(seats)) out.push(`${tag}: result.seats ${flat(result.seats)}`);
    for (const e of result.seats) if (keysOf(e) !== "job,seat") out.push(`${tag}: result seat keys ${keysOf(e)}`);
    for (const row of result.summary) {
      if (!["n", "exec,n", "n,night", "exec,n,night"].includes(keysOf(row))) out.push(`${tag}: summary row keys ${keysOf(row)}`);
      if (row.exec !== undefined && !["no,passed,yes", "candidate,no,passed,yes"].includes(keysOf(row.exec))) out.push(`${tag}: summary exec keys`);
      if (row.night !== undefined && !["died", "died,target"].includes(keysOf(row.night))) out.push(`${tag}: summary night keys`);
    }
  }
  return out;
}

/** 따옴표 없는 한 줄 JSON — 실패 보고(TAP)에 이스케이프된 따옴표가 끼지 않게 한다. */
const flat = (value: unknown): string => (JSON.stringify(value) ?? "undefined").replaceAll('"', "");

const seatId = (state: RoomState, seat: number): string => {
  const p = state.players.find((q) => q.seat === seat);
  if (!p) throw new Error(`no player at seat ${seat}`);
  return p.id;
};

/** 실제 전이(pickTarget)로 밤 행동 한 번을 더한다. */
function actAt(state: RoomState, seat: number, target: number): RoomState {
  const r = pickTarget(state, seatId(state, seat), target);
  if (!r.ok) throw new Error(`pickTarget failed: ${r.error}`);
  return r.state;
}

const seatOfRole = (state: RoomState, role: string, nth = 0): number => {
  const p = state.players.filter((q) => q.role === role).sort((a, b) => a.seat - b.seat)[nth];
  if (!p) throw new Error(`no ${role} #${nth}`);
  return p.seat;
};

/** 마감을 연쇄로 넘겨 목표 단계까지 간다(밤 판정에는 시드 난수를 넘긴다). */
function advanceTo(state: RoomState, phase: PhaseId, seed: number): RoomState {
  let s = state;
  for (let guard = 0; s.phase !== phase; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`advanceTo ${phase} failed at ${s.phase}`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed));
  }
  return s;
}

/** 마피아가 아닌 seat 들(오름차순). */
const nonMafiaSeats = (state: RoomState): number[] =>
  state.players.filter((q) => q.role !== "mafia").map((q) => q.seat).sort((a, b) => a - b);

/** 밤 상태에서 살아 있는 마피아·경찰·의사가 각자 행동한다(실제 pickTarget). 지목 대상은 살아 있는 첫 비마피아다. */
function nightActions(state: RoomState): RoomState {
  const living = state.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  const target = living.find((p) => p.role !== "mafia")!.seat;
  const mafiaSeat = living.find((p) => p.role === "mafia")!.seat;
  let s = state;
  for (const p of living) {
    if (p.role === "mafia") s = actAt(s, p.seat, target);
    else if (p.role === "police") s = actAt(s, p.seat, living[0]!.seat);
    else if (p.role === "doctor") s = actAt(s, p.seat, p.seat !== target ? p.seat : mafiaSeat);
  }
  return s;
}

/**
 * 낮 단계는 서버 전용 필드가 채워진 상태를 실제 전이(tick·투표·밤 행동)로 만든다 — 손으로 필드를 채우지 않는다.
 * discussion: 토론이 시작된 상태 그대로다(07-12: 이모티콘 전송 기록이 사라져 더 채울 필드가 없다). 낮이 아닌 단계는 stateAt 그대로다.
 * night·morning: 그 토론 뒤 밤 행동과 아침.
 */
function richStateAt(phase: PhaseId, n: number, seed: number): RoomState {
  // 변론·처형: 후보가 시민/마피아로 갈린다.
  if (phase === "defense" || phase === "verdict" || phase === "execution") {
    return stateWithVerdict(n, seed, phase, { candidate: seed % 2 === 0 ? "mafia" : "citizen" });
  }
  if (phase === "ended") return endedState(n, seed, seed % 2 === 0 ? "mafia" : "citizen");
  if (phase === "night" || phase === "morning") {
    // 밤: 마피아 → 가장 작은 살아 있는 비마피아 seat, 경찰 → 살아 있는 첫 seat, 의사 → 자신(지목된 사람이면 마피아). 아침은 그 밤 뒤(한 명 탈락).
    const d = richStateAt("discussion", n, seed);
    const s = nightActions(advanceTo(d, "night", seed)); // 토론 뒤 지목(표 없음 → 밤)을 지나 밤에 닿는다
    if (phase === "night") return s;
    return tick(s, s.phaseEndsAt!, seededRandInt(seed));
  }
  return stateAt(phase, n, seed);
}

/** n명 판 1일차 밤: 마피아가 첫 비마피아 X 를 지목해 아침이 된 상태(의사는 보호하지 않는다 — 4명 판은 의사가 없다). */
function morningWithVictim(n: number, seed: number) {
  const s0 = stateAt("night", n, seed);
  const x = nonMafiaSeats(s0)[0]!;
  // 마피아 전원이 같은 대상을 골라야 확정이다(NIGHT-08, 결정 0061-6).
  const picked = s0.players
    .filter((p) => p.role === "mafia")
    .reduce((s, p) => actAt(s, p.seat, x), s0);
  return { s: tick(picked, picked.phaseEndsAt!, seededRandInt(seed)), x };
}

function mafiaSeatsOtherThan(state: RoomState, p: Player): number[] {
  return state.players
    .filter((q) => q.role === "mafia" && q.id !== p.id)
    .map((q) => q.seat)
    .sort((a, b) => a - b);
}

describe("buildView 단계 길이 (D-15, 결정 0012)", () => {
  it("phaseDurationMs 는 단계 길이를 보내고, phaseEndsAt·serverNow 는 상태·now 그대로다", () => {
    const got = PHASES.map((phase) => {
      const s = stateAt(phase, 4, 1);
      const v = buildView(s, s.hostId, 77_777);
      return `${phase}:${v.phaseDurationMs}:${v.phaseEndsAt === s.phaseEndsAt}:${v.serverNow}`;
    });
    expect(got.join(" ")).toBe(
      `lobby:null:true:77777 assigning:3000:true:77777 roleReveal:15000:true:77777 dayAnnounce:2000:true:77777 discussion:90000:true:77777 nomination:15000:true:77777 defense:20000:true:77777 verdict:10000:true:77777 execution:5000:true:77777 night:30000:true:77777 morning:5000:true:77777 ended:null:true:77777`,
    );
  });

  it("마감은 이전 마감 + 단계 길이로 이어진다: assigning +3000, roleReveal +15000, dayAnnounce +2000, discussion +90000, nomination +15000, night +30000, morning +5000", () => {
    const a = stateAt("assigning", 4, 1);
    const r = stateAt("roleReveal", 4, 1);
    const ends = ["assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "night", "morning"].map(
      (phase) => stateAt(phase as PhaseId, 4, 1).phaseEndsAt,
    );
    // discussion 은 낮 시작 발표 마감(20000) 바로 뒤에 이어진다(20000 + DISCUSSION_MS)
    const discussionEnd = START_AT + 20000 + DISCUSSION_MS;
    expect(DISCUSSION_MS).toBe(90000);
    expect(ends.join("/")).toBe(
      [
        START_AT + 3000,
        START_AT + 18000,
        START_AT + 20000,
        discussionEnd,
        discussionEnd + NOMINATION_MS,
        discussionEnd + NOMINATION_MS + NIGHT_MS,
        discussionEnd + NOMINATION_MS + NIGHT_MS + MORNING_MS,
      ].join("/"),
    );
    expect(r.phaseEndsAt).toBe(START_AT + 18000);
    expect(a.expiresAt).toBe(START_AT + ROOM_TTL_MS);
  });
});

describe("buildView 내 역할·마피아 동료 (ROLE-02, D-14)", () => {
  it("lobby·assigning 에서는 me.role·me.allies 가 없다", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of ["lobby", "assigning"] as const) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            const me = buildView(s, p.id, START_AT).me;
            if ("role" in me || "allies" in me) bad.push(`${phase}/${n}/${seed}/seat${p.seat}`);
          }
        }
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("역할을 보여 주는 모든 단계(roleReveal·낮 네 단계)에서 me.role 은 본인 역할이다", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of REVEALING_PHASES) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            checked += 1;
            const role = buildView(s, p.id, START_AT).me.role;
            if (role !== p.role) bad.push(`${phase}/${n}/${seed}/seat${p.seat}:${role}!=${p.role}`);
          }
        }
      }
    }
    expect(checked > 0).toBe(true);
    expect(bad.join(",")).toBe("");
  });

  it("마피아에게만 me.allies(다른 마피아 seat 오름차순)가 가고, 혼자면 빈 배열이다", () => {
    const bad: string[] = [];
    let mafiaChecks = 0;
    let soloChecks = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of REVEALING_PHASES) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            const me = buildView(s, p.id, START_AT).me;
            if (p.role === "mafia") {
              mafiaChecks += 1;
              const want = mafiaSeatsOtherThan(s, p);
              if (want.length === 0) soloChecks += 1;
              if (JSON.stringify(me.allies) !== JSON.stringify(want)) {
                bad.push(`${phase}/${n}/${seed}/seat${p.seat}:${JSON.stringify(me.allies)}!=${JSON.stringify(want)}`);
              }
            } else if ("allies" in me) {
              bad.push(`${phase}/${n}/${seed}/seat${p.seat}:non-mafia has allies`);
            }
          }
        }
      }
    }
    expect(mafiaChecks > 0).toBe(true);
    expect(soloChecks > 0).toBe(true); // 4·5명(마피아 1명) 조합이 실제로 검사됐다
    expect(bad.join(",")).toBe("");
  });
});

describe("buildView 전수 누출 검사 (T-01-23)", () => {
  it("4~8명 × 열두 단계 × 모든 플레이어 × 시드 3개: token·id 가 없고, role·allies 키는 me 아래에만 있으며, 공개 항목은 다섯 키뿐이다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of PHASES) {
          const s = richStateAt(phase, n, seed);
          for (const viewer of s.players) {
            views += 1;
            const tag = `${n}/${seed}/${phase}/seat${viewer.seat}`;
            const view = buildView(s, viewer.id, START_AT);
            const text = JSON.stringify(view);
            for (const q of s.players) {
              if (text.includes(q.token)) violations.push(`${tag}: token of seat${q.seat}`);
              if (text.includes(q.id)) violations.push(`${tag}: id of seat${q.seat}`);
              if (q.connId !== null && text.includes(q.connId)) violations.push(`${tag}: connId of seat${q.seat}`);
            }
            for (const path of keyPaths(view)) {
              const key = lastKey(path);
              if (key === "role" && path !== "me.role") violations.push(`${tag}: role at ${path}`);
              if (key === "allies" && path !== "me.allies") violations.push(`${tag}: allies at ${path}`);
            }
            for (const entry of view.players) {
              const keys = Object.keys(entry).sort().join(",");
              if (keys !== "alive,connected,isHost,nickname,seat") violations.push(`${tag}: players[] keys ${keys}`);
            }
            // 서버 전용 필드 이름은 어느 경로에도 없다
            for (const path of keyPaths(view)) {
              if (
                [
                  "claimLast", "claimChoice", "claimShown", "claimChanged", "claimPick", "claimOrder", "claimIdx",
                  "claimStart", "claimDone", "claims", "nightPick", "investigations", "lastPhrase",
                ].includes(lastKey(path))
              ) {
                violations.push(`${tag}: server-only key at ${path}`);
              }
            }
            // 최상위 키는 허용 목록뿐이다
            for (const key of Object.keys(view)) {
              if (!TOP_KEYS.has(key)) violations.push(`${tag}: top-level key ${key}`);
            }
            // 밤 필드는 받을 사람에게만: pick 은 밤·생존 본인, allyPicks 는 밤·생존 마피아, records 는 경찰·마피아·의사 본인(역할 공개 단계 전체, 줄 모양은 역할별)
            for (const path of keyPaths(view)) {
              if (["pick", "allyPicks", "records"].includes(lastKey(path)) && !path.startsWith("me.")) {
                violations.push(`${tag}: night field outside me at ${path}`);
              }
            }
            const isNight = phase === "night";
            const wantPick = isNight && isAlive(viewer) && viewer.nightPick !== undefined;
            if ("pick" in view.me !== wantPick) violations.push(`${tag}: me.pick presence ${"pick" in view.me}`);
            else if (wantPick && view.me.pick !== viewer.nightPick) violations.push(`${tag}: me.pick value`);
            const wantAlly = isNight && isAlive(viewer) && viewer.role === "mafia";
            if ("allyPicks" in view.me !== wantAlly) violations.push(`${tag}: me.allyPicks presence ${"allyPicks" in view.me}`);
            else if (wantAlly) {
              const want = [
                ...new Set(
                  s.players
                    .filter((q) => q.role === "mafia" && q.id !== viewer.id && isAlive(q) && q.nightPick !== undefined)
                    .map((q) => q.nightPick as number),
                ),
              ].sort((a, b) => a - b);
              if (flat(view.me.allyPicks) !== flat(want)) violations.push(`${tag}: me.allyPicks value ${flat(view.me.allyPicks)}`);
            }
            violations.push(...journalViolations(s, viewer, view, phase, tag));
            violations.push(...phaseKeyViolations(s, viewer, view, phase, tag));
            if ("morning" in (view.day ?? {}) !== (phase === "morning")) violations.push(`${tag}: day.morning presence`);
            // me 에는 어느 단계에서도 claim 키가 없고 day 에는 turn 키가 없다(07-08: 순차 주장 제거).
            if ("claim" in view.me) violations.push(`${tag}: claim key in me`);
            if ("turn" in (view.day ?? {})) violations.push(`${tag}: day.turn present`);
            // 역할 값은 허용 경로(me.role, day.roles[])에만 있다
            violations.push(...spectateViolations(s, viewer, view, phase, tag));
          }
        }
      }
    }
    expect(views).toBe(SEEDS.length * PHASES.length * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});

describe("buildView 낮 뷰 — 순차 주장 제거 뒤 (07-08, CHAT-06): turn 키 없음", () => {
  const ROLES_5 = ["mafia", "police", "doctor", "citizen"];

  it("lobby·assigning·roleReveal 뷰에는 day 키와 me 의 claim 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of ["lobby", "assigning", "roleReveal"] as const) {
      const s = stateAt(phase, 5, 1);
      for (const p of s.players) {
        const view = buildView(s, p.id, START_AT);
        if ("day" in view || "claim" in view.me) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("dayAnnounce·discussion·night·morning 의 day 키는 n,roles,voteLog(discussion 은 + endCount, night 는 + noExecution: 표 없이 지나온 밤, morning 은 + morning)이고 turn 키가 없다", () => {
    const got: string[] = [];
    for (const phase of ["dayAnnounce", "discussion", "night", "morning"] as const) {
      const s = richStateAt(phase, 5, 1);
      const keys = new Set(s.players.map((p) => Object.keys(buildView(s, p.id, START_AT).day ?? {}).sort().join(",")));
      got.push(`${phase}:${[...keys].join("|")}`);
    }
    expect(got.join(" ")).toBe("dayAnnounce:n,roles,voteLog discussion:endCount,n,roles,voteLog night:n,noExecution,roles,voteLog morning:morning,n,roles,voteLog");
  });

  it("dayAnnounce 뷰의 day 는 {n, roles, voteLog []} 뿐이다", () => {
    const s = stateAt("dayAnnounce", 5, 1);
    for (const p of s.players) {
      expect(flat(buildView(s, p.id, START_AT).day)).toBe(flat({ n: 1, roles: rolesInPlay(5), voteLog: [] }));
    }
  });

});

describe("buildView 낮 뷰 — 토론·이튿날 (D-02, D-05, D-15)", () => {
  it("discussion: me 에 claim 키·day 에 turn 키가 없다", () => {
    const bad: string[] = [];
    const s = richStateAt("discussion", 6, 42);
    for (const p of s.players) {
      const view = buildView(s, p.id, START_AT);
      if ("claim" in view.me) bad.push(`seat${p.seat}: claim key in me`);
      if ("turn" in (view.day ?? {})) bad.push(`seat${p.seat}: turn`);
    }
    expect(bad.join(" ")).toBe("");
  });

  it("옛 claimOrder 키가 남은 방도 view 에 서버 전용 키는 실리지 않는다 (07-08)", () => {
    const s = stateAt("discussion", 5, 1);
    const old = { ...s, claimOrder: [0, 1], claimIdx: 1, claimStart: 0, claimPick: "police" } as unknown as RoomState;
    const text = JSON.stringify(buildView(old, seatId(old, 0), START_AT));
    for (const key of ["claimOrder", "claimIdx", "claimStart", "claimPick"]) expect(text.includes(`"${key}"`)).toBe(false);
  });

  it("discussion: day 의 키는 endCount,n,roles,voteLog(8페이즈 토론 끝내기 수) 이고 messages·extendUsed 키가 없다 (결정 0017-5·0017-7)", () => {
    const s = stateAt("discussion", 5, 1);
    for (const viewer of s.players) {
      const view = buildView(s, viewer.id, START_AT);
      expect(Object.keys(view.day ?? {}).sort().join(",")).toBe("endCount,n,roles,voteLog");
      expect(roleValueLeaks(view).join(";")).toBe("");
    }
  });

  it("discussion phaseDurationMs 는 90000 이다(옛 상태의 연장 표시와 무관)", () => {
    const s = stateAt("discussion", 4, 1);
    const old = { ...s, extendUsed: true } as RoomState; // 옛 저장 방: 키로만 넣는다(타입 선언에 기대지 않는다)
    expect(buildView(s, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
    expect(buildView(old, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
  });
});

describe("buildView 밤 — 생존·본인 선택 (ELIM-01, D-06)", () => {
  it("night view: day 의 키는 n,noExecution,roles,voteLog(표 없이 지나온 밤이라 처형 무효 이유가 실린다, D-34) 이고 players[] 키는 alive,connected,isHost,nickname,seat, 모두 alive true", () => {
    const s = stateAt("night", 5, 1);
    const dayKeys = s.players.map((p) => Object.keys(buildView(s, p.id, START_AT).day ?? {}).sort().join(","));
    expect(`[${dayKeys.join(" ")}]`).toBe(`[${Array(5).fill("n,noExecution,roles,voteLog").join(" ")}]`);
    const got = s.players.map((p) => {
      const v = buildView(s, p.id, START_AT);
      return v.players.map((e) => `${Object.keys(e).sort().join(",")}:${String(e.alive)}`).join("|");
    });
    const one = Array(5).fill("alive,connected,isHost,nickname,seat:true").join("|");
    expect(got.join(" ")).toBe(Array(5).fill(one).join(" "));
  });

  it("5명 판 경찰이 seat X 를 고른 뒤: 경찰 view 의 me.pick === X, 다른 네 사람 view 의 me 에는 pick 키가 없다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const x = police === 0 ? 1 : 0;
    s = actAt(s, police, x);
    const got = s.players.map((p) => {
      const me = buildView(s, p.id, START_AT).me;
      return `${p.seat}:${"pick" in me ? String(me.pick) : "-"}`;
    });
    expect(got.join(" ")).toBe(s.players.map((p) => `${p.seat}:${p.seat === police ? x : "-"}`).join(" "));
  });

  it("탈락자(아침 뒤 상태)는 모든 viewer 의 players[] 에서 alive false 다", () => {
    let s = stateAt("night", 5, 1);
    const victim = seatOfRole(s, "citizen");
    s = actAt(s, seatOfRole(s, "mafia"), victim);
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    expect(s.phase).toBe("morning");
    const got = s.players.map((p) => {
      const v = buildView(s, p.id, START_AT);
      return v.players.map((e) => `${e.seat}:${String(e.alive)}`).join(",");
    });
    const want = s.players.map((q) => q.seat).map((seat) => `${seat}:${String(seat !== victim)}`).join(",");
    expect(got.join(" ")).toBe(Array(5).fill(want).join(" "));
  });

  it("lobby view 의 players[] 도 alive 키가 있다(true)", () => {
    const s = stateAt("lobby", 4, 1);
    const got = buildView(s, s.hostId, START_AT).players.map((e) => String(e.alive));
    expect(got.join(",")).toBe("true,true,true,true");
  });
});

describe("buildView 밤 — 동료 선택 (D-07)", () => {
  /** 6명 판 1일차 밤. 마피아 A<B, 비마피아 X<Y 를 함께 돌려준다. */
  function night6(seed: number) {
    const s = stateAt("night", 6, seed);
    const [a, b] = [seatOfRole(s, "mafia", 0), seatOfRole(s, "mafia", 1)];
    const [x, y] = nonMafiaSeats(s);
    return { s, a, b, x: x!, y: y! };
  }
  const meOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT).me;

  it("마피아 A 가 X 를 고르면 A: pick X·allyPicks [], B: allyPicks [X]·pick 키 없음", () => {
    const { s: s0, a, b, x } = night6(1);
    const s = actAt(s0, a, x);
    const ma = meOf(s, a);
    const mb = meOf(s, b);
    expect(`pick=${ma.pick} ally=${flat(ma.allyPicks)}`).toBe(`pick=${x} ally=[]`);
    expect(`pick=${"pick" in mb ? mb.pick : "-"} ally=${flat(mb.allyPicks)}`).toBe(`pick=- ally=[${x}]`);
  });

  it("둘 다 X 면 서로 allyPicks [X](중복 없음), A 는 X·B 는 Y(X<Y) 면 A 는 [Y], B 는 [X]", () => {
    const { s: s0, a, b, x, y } = night6(1);
    const same = actAt(actAt(s0, a, x), b, x);
    expect(`${flat(meOf(same, a).allyPicks)} ${flat(meOf(same, b).allyPicks)}`).toBe(`[${x}] [${x}]`);
    const split = actAt(actAt(s0, a, x), b, y);
    expect(`${flat(meOf(split, a).allyPicks)} ${flat(meOf(split, b).allyPicks)}`).toBe(`[${y}] [${x}]`);
  });

  it("비마피아 view 의 me 에는 allyPicks 키가 없다(마피아가 골랐어도). 혼자인 마피아(5명 판)는 night 에서 allyPicks [] (키 있음)", () => {
    const { s: s0, a, x } = night6(1);
    const s = actAt(s0, a, x);
    const bad = s.players.filter((p) => p.role !== "mafia").filter((p) => "allyPicks" in meOf(s, p.seat)).map((p) => p.seat);
    expect(`[${bad.join(",")}]`).toBe("[]");
    const solo = stateAt("night", 5, 1);
    const m = meOf(solo, seatOfRole(solo, "mafia"));
    expect(`${"allyPicks" in m} ${flat(m.allyPicks)}`).toBe("true []");
  });

  it("탈락한 마피아 view: allies 는 있고 allyPicks·pick 키는 없다. 살아 있는 동료 allyPicks 에 탈락자의 값은 들지 않는다 (A3)", () => {
    const { s: s0, a, b, x } = night6(1);
    const s: RoomState = {
      ...s0,
      players: s0.players.map((p) => (p.seat === b ? { ...p, alive: false, nightPick: x } : p)),
    };
    const mb = meOf(s, b);
    expect(`allies=${flat(mb.allies)} ally=${"allyPicks" in mb} pick=${"pick" in mb}`).toBe(`allies=[${a}] ally=false pick=false`);
    expect(flat(meOf(s, a).allyPicks)).toBe("[]");
  });

  it("night 가 아닌 단계에는 어떤 viewer 에도 pick·allyPicks 키가 없다(남은 nightPick 이 있어도)", () => {
    const bad: string[] = [];
    for (const phase of ["roleReveal", "dayAnnounce", "discussion", "morning"] as const) {
      const base = stateAt(phase, 6, 1);
      const s: RoomState = { ...base, players: base.players.map((p) => ({ ...p, nightPick: 0 })) };
      for (const p of s.players) {
        const me = meOf(s, p.seat);
        if ("pick" in me || "allyPicks" in me) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("buildView 역할별 일지 (D-09·D-10·D-11)", () => {
  const recordsOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT).me.records;

  it("경찰 view 는 roleReveal 부터 records 가 있고 첫 밤 동안은 [], 아침부터 [{n:1, target, isMafia}](키 정확히 isMafia,n,target)", () => {
    const early = stateAt("roleReveal", 5, 1);
    expect(flat(recordsOf(early, seatOfRole(early, "police")))).toBe("[]");
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(s, police, mafia);
    expect(flat(recordsOf(s, police))).toBe("[]");
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    const got = recordsOf(s, police) ?? [];
    expect(flat(got)).toBe(flat([{ n: 1, target: mafia, isMafia: true }]));
    expect(Object.keys(got[0] ?? {}).sort().join(",")).toBe("isMafia,n,target");
  });

  it("2일차 밤 뒤에는 두 개(n 1, 2 순서)다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const citizen = seatOfRole(s, "citizen");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(s, police, citizen);
    s = advanceTo(advanceTo(s, "morning", 1), "dayAnnounce", 1); // 1일차 아침을 지나 2일차 낮
    s = advanceTo(s, "night", 1); // 2일차 밤
    s = actAt(s, police, mafia);
    s = advanceTo(s, "morning", 1);
    expect(flat(recordsOf(s, police))).toBe(
      flat([{ n: 1, target: citizen, isMafia: false }, { n: 2, target: mafia, isMafia: true }]),
    );
  });

  it("탈락한 경찰도 records 를 받는다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(actAt(s, police, mafia), mafia, police); // 동시 해결: 조사는 적용되고 경찰은 탈락
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    const v = buildView(s, seatId(s, police), START_AT);
    expect(`${String(v.players.find((p) => p.seat === police)?.alive)} ${flat(v.me.records)}`).toBe(
      `false ${flat([{ n: 1, target: mafia, isMafia: true }])}`,
    );
  });

  it("시민·대기실·배정 view 에는 어떤 단계에서도 records 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of PHASES) {
      const s = richStateAt(phase, 6, 42);
      for (const p of s.players) {
        const hasRecords = "records" in buildView(s, p.id, START_AT).me;
        const mayHave = PHASE_DEFS[phase].revealsOwnRole && p.role !== undefined && p.role in JOURNAL_KEYS;
        if (hasRecords !== mayHave) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });

  it("마피아(6명판 둘): roleReveal 부터 records [], 1일차 아침부터 둘 다 같은 [{n:1, target:X, died:true}](키 정확히 died,n,target)", () => {
    const early = stateAt("roleReveal", 6, 1);
    expect(flat(recordsOf(early, seatOfRole(early, "mafia", 0)))).toBe("[]");
    const s0 = stateAt("night", 6, 1);
    const x = nonMafiaSeats(s0).filter((t) => t !== seatOfRole(s0, "doctor"))[0]!;
    const m1 = seatOfRole(s0, "mafia", 0);
    const m2 = seatOfRole(s0, "mafia", 1);
    const picked = actAt(actAt(s0, m1, x), m2, x);
    expect(flat(recordsOf(picked, m1))).toBe("[]"); // 밤 중에는 그 밤의 줄이 없다
    const s = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    const want = flat([{ n: 1, target: x, died: true }]);
    expect(flat(recordsOf(s, m1))).toBe(want);
    expect(flat(recordsOf(s, m2))).toBe(want);
    expect(Object.keys((recordsOf(s, m1) ?? [])[0] ?? {}).sort().join(",")).toBe("died,n,target");
  });

  it("의사가 X 를 막은 판: 마피아 둘 다 died:false 이고 아침 day.morning 은 { saved: true } 뿐(누구인지 없음); 의사 줄은 키가 n,target 뿐이다", () => {
    const s0 = stateAt("night", 6, 1);
    const x = nonMafiaSeats(s0).filter((t) => t !== seatOfRole(s0, "doctor"))[0]!;
    const doctor = seatOfRole(s0, "doctor");
    const m1 = seatOfRole(s0, "mafia", 0);
    const m2 = seatOfRole(s0, "mafia", 1);
    const picked = actAt(actAt(actAt(s0, m1, x), m2, x), doctor, x);
    const s = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    const miss = flat([{ n: 1, target: x, died: false }]);
    expect(flat(recordsOf(s, m1))).toBe(miss);
    expect(flat(recordsOf(s, m2))).toBe(miss);
    expect(flat(buildView(s, seatId(s, m1), START_AT).day?.morning)).toBe(flat({ saved: true }));
    expect(flat(recordsOf(s, doctor))).toBe(flat([{ n: 1, target: x }]));
    expect(Object.keys((recordsOf(s, doctor) ?? [])[0] ?? {}).sort().join(",")).toBe("n,target");
  });

  it("의사: roleReveal 부터 records [], 보호한 밤 뒤 [{n:1, target}]; 안 고른 밤은 줄이 없다", () => {
    const early = stateAt("roleReveal", 6, 1);
    expect(flat(recordsOf(early, seatOfRole(early, "doctor")))).toBe("[]");
    const s0 = stateAt("night", 6, 1);
    const doctor = seatOfRole(s0, "doctor");
    const healed = tick(actAt(s0, doctor, doctor), s0.phaseEndsAt!, seededRandInt(1));
    expect(flat(recordsOf(healed, doctor))).toBe(flat([{ n: 1, target: doctor }]));
    const idle = tick(s0, s0.phaseEndsAt!, seededRandInt(1));
    expect(flat(recordsOf(idle, doctor))).toBe("[]");
    expect(flat(recordsOf(idle, seatOfRole(idle, "mafia")))).toBe("[]");
  });

  it("탈락한 마피아·의사도 records 를 계속 받고, 탈락 view 의 spectate 키는 seats 뿐이다", () => {
    const s0 = stateAt("night", 6, 1);
    const doctor = seatOfRole(s0, "doctor");
    const m1 = seatOfRole(s0, "mafia", 0);
    const m2 = seatOfRole(s0, "mafia", 1);
    const police = seatOfRole(s0, "police");
    // 마피아가 의사를 지목하고 의사는 다른 사람(경찰)을 지킨다 → 의사 탈락. 의사 치료일지와 마피아 암살일지가 모두 남는다.
    const s = tick(actAt(actAt(actAt(s0, m1, doctor), m2, doctor), doctor, police), s0.phaseEndsAt!, seededRandInt(1));
    const dv = buildView(s, seatId(s, doctor), START_AT);
    expect(`${String(dv.players.find((p) => p.seat === doctor)?.alive)} ${flat(dv.me.records)} ${Object.keys(dv.spectate ?? {}).join(",")}`).toBe(
      `false ${flat([{ n: 1, target: police }])} seats`,
    );
    expect(flat(recordsOf(s, m1))).toBe(flat([{ n: 1, target: doctor, died: true }]));
  });

  it("records 는 역할을 싣는 모든 단계에서 같고 새 줄은 아침부터 보인다(2일차 낮·밤에도 어제 줄이 남는다)", () => {
    const s0 = stateAt("night", 6, 1);
    const m1 = seatOfRole(s0, "mafia", 0);
    const x = nonMafiaSeats(s0).filter((t) => t !== seatOfRole(s0, "doctor"))[0]!;
    const morning = tick(actAt(actAt(s0, m1, x), seatOfRole(s0, "mafia", 1), x), s0.phaseEndsAt!, seededRandInt(1));
    const want = flat([{ n: 1, target: x, died: true }]);
    const seen: string[] = [];
    for (const phase of ["dayAnnounce", "discussion", "night"] as const) {
      const a = advanceTo(morning, phase, 1);
      seen.push(`${phase}:${flat(recordsOf(a, m1)) === want}`);
    }
    expect(seen.join(" ")).toBe("dayAnnounce:true discussion:true night:true");
    for (const phase of ["dayAnnounce", "discussion"] as const) {
      const a = stateAt(phase, 6, 1);
      expect(flat(recordsOf(a, seatOfRole(a, "mafia", 0)))).toBe("[]");
    }
  });

  it("두 밤을 돌린 판의 전수 누출(4~8명 × 2일차 네 단계 × 모든 viewer × 시드 3): 일지·역할 값·spectate 경계가 지켜진다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const first = nightActions(advanceTo(richStateAt("discussion", n, seed), "night", seed));
        const morning1 = advanceTo(first, "morning", seed);
        const day2 = advanceTo(morning1, "dayAnnounce", seed);
        const night2 = advanceTo(day2, "night", seed);
        const morning2 = advanceTo(nightActions(night2), "morning", seed);
        const stages: Array<[PhaseId, RoomState]> = [
          ["dayAnnounce", day2],
          ["discussion", advanceTo(day2, "discussion", seed)],
          ["night", night2],
          ["morning", morning2],
        ];
        for (const [phase, s] of stages) {
          for (const viewer of s.players) {
            views += 1;
            const tag = `2d/${n}/${seed}/${phase}/seat${viewer.seat}`;
            const view = buildView(s, viewer.id, START_AT);
            violations.push(...journalViolations(s, viewer, view, phase, tag));
            violations.push(...spectateViolations(s, viewer, view, phase, tag));
            const text = JSON.stringify(view);
            for (const q of s.players) if (text.includes(q.token) || text.includes(q.id)) violations.push(`${tag}: token/id of seat${q.seat}`);
          }
        }
      }
    }
    expect(views > 0).toBe(true);
    expect(violations.join("; ")).toBe("");
  });
});

describe("buildView 아침 결과 (NIGHT-06·D-13)", () => {
  const morningsOf = (s: RoomState): string[] => s.players.map((p) => flat(buildView(s, p.id, START_AT).day?.morning));
  const toMorning = (s: RoomState): RoomState => tick(s, s.phaseEndsAt!, seededRandInt(1));

  it("마피아 전원이 시민 X 지목 → 모든 viewer 의 day.morning 이 같은 {eliminated: X} 하나(문구 번호 없음)", () => {
    const s0 = stateAt("night", 5, 1);
    const x = seatOfRole(s0, "citizen");
    const s = toMorning(s0.players.filter((p) => p.role === "mafia").reduce((acc, p) => actAt(acc, p.seat, x), s0));
    const got = morningsOf(s);
    expect(new Set(got).size).toBe(1);
    const m = buildView(s, s.hostId, START_AT).day?.morning ?? {};
    expect(`${Object.keys(m).sort().join(",")} ${m.eliminated}`).toBe(`eliminated ${x}`);
  });

  it("의사가 X 를 지킴 → { saved: true }, 아무도 안 고름 → {}", () => {
    const s0 = stateAt("night", 5, 1);
    const x = seatOfRole(s0, "citizen");
    const mafiaPicked = s0.players.filter((p) => p.role === "mafia").reduce((acc, p) => actAt(acc, p.seat, x), s0);
    const saved = toMorning(actAt(mafiaPicked, seatOfRole(s0, "doctor"), x));
    expect(`${morningsOf(saved).join(" ")}`).toBe(Array(5).fill(flat({ saved: true })).join(" "));
    const quiet = toMorning(s0);
    expect(`${morningsOf(quiet).join(" ")}`).toBe(Array(5).fill("{}").join(" "));
  });

  it("morning 이 아닌 단계(다음 dayAnnounce 포함)에는 day.morning 키가 없다", () => {
    let s = stateAt("night", 5, 1);
    const bad: string[] = [];
    const check = (tag: string) => {
      for (const p of s.players) if ("morning" in (buildView(s, p.id, START_AT).day ?? {})) bad.push(`${tag}/seat${p.seat}`);
    };
    check("night");
    s = advanceTo(s, "morning", 1);
    s = advanceTo(s, "dayAnnounce", 1);
    check("dayAnnounce");
    s = advanceTo(s, "discussion", 1);
    check("discussion");
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("buildView 관전 (결정 0021)", () => {
  const viewOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT);

  it("1일차 밤 뒤 X 가 탈락한 morning: X 의 spectate.seats 는 모든 사람의 {seat, job}(키 job,seat; seat 오름차순; 실제 역할)이고 picks 키는 없다", () => {
    const { s, x } = morningWithVictim(5, 1);
    expect(isAlive(s.players.find((p) => p.seat === x)!)).toBe(false);
    const sp = viewOf(s, x).spectate;
    const want = [...s.players].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, job: p.role }));
    expect(flat(sp?.seats)).toBe(flat(want));
    expect(Object.keys(sp?.seats[0] ?? {}).sort().join(",")).toBe("job,seat");
    expect(Object.keys(sp ?? {}).join(",")).toBe("seats");
  });

  it("같은 morning 의 살아 있는 viewer 전원 view 에는 spectate 키가 없다", () => {
    const { s, x } = morningWithVictim(5, 1);
    const bad = s.players.filter((p) => p.seat !== x && "spectate" in viewOf(s, p.seat)).map((p) => p.seat);
    expect(`[${bad.join(",")}]`).toBe("[]");
  });

  it("탈락하기 전(같은 판의 1일차 night) X 의 view 에는 spectate 키가 없다", () => {
    const s0 = stateAt("night", 5, 1);
    const x = nonMafiaSeats(s0)[0]!;
    expect(String("spectate" in viewOf(actAt(s0, seatOfRole(s0, "mafia"), x), x))).toBe("false");
  });

  it("2일차 night: 마피아 → Y, 경찰 → Z, 의사 → 자신(W) 일 때 X 의 spectate.picks 는 {mafia:[Y], police:[Z], doctor:[W]}; 아무도 안 고른 역할은 빈 배열", () => {
    const { s: m, x } = morningWithVictim(5, 1);
    const night = advanceTo(advanceTo(m, "dayAnnounce", 1), "night", 1);
    const y = nonMafiaSeats(night).find((q) => q !== x && q !== seatOfRole(night, "police") && q !== seatOfRole(night, "doctor"))!;
    const z = seatOfRole(night, "mafia");
    const w = seatOfRole(night, "doctor");
    const none = viewOf(night, x).spectate?.picks;
    expect(flat(none)).toBe(flat({ mafia: [], police: [], doctor: [] }));
    let s = actAt(night, seatOfRole(night, "mafia"), y);
    s = actAt(s, seatOfRole(night, "police"), z);
    s = actAt(s, w, w);
    expect(flat(viewOf(s, x).spectate?.picks)).toBe(flat({ mafia: [y], police: [z], doctor: [w] }));
    expect(`${viewOf(s, x).spectate?.picks ? Object.keys(viewOf(s, x).spectate!).sort().join(",") : "-"}`).toBe("picks,seats");
  });

  it("6명 판 마피아 둘이 Y·V 를 고르면 picks.mafia 는 [작은 seat, 큰 seat] 중복 없음(같은 대상이면 하나)", () => {
    const { s: m, x } = morningWithVictim(6, 1);
    const night = advanceTo(advanceTo(m, "dayAnnounce", 1), "night", 1);
    const [a, b] = [seatOfRole(night, "mafia", 0), seatOfRole(night, "mafia", 1)];
    const open = nonMafiaSeats(night).filter((q) => q !== x);
    const [y, v] = [open[open.length - 1]!, open[0]!];
    const two = actAt(actAt(night, a, y), b, v);
    expect(flat(viewOf(two, x).spectate?.picks?.mafia)).toBe(flat([v, y].sort((p, q) => p - q)));
    const one = actAt(actAt(night, a, y), b, y);
    expect(flat(viewOf(one, x).spectate?.picks?.mafia)).toBe(flat([y]));
  });

  it("탈락한 마피아가 고른 값은 picks 에 들지 않는다(살아 있는 사람의 현재 선택만) — 상태를 직접 만들어 확인", () => {
    const s0 = stateAt("night", 6, 1);
    const [a, b] = [seatOfRole(s0, "mafia", 0), seatOfRole(s0, "mafia", 1)];
    const [x, y] = nonMafiaSeats(s0);
    const s: RoomState = {
      ...actAt(s0, a, y!),
      players: actAt(s0, a, y!).players.map((p) =>
        p.seat === b ? { ...p, alive: false, nightPick: y! } : p.seat === x ? { ...p, alive: false } : p,
      ),
    };
    expect(flat(viewOf(s, x!).spectate?.picks)).toBe(flat({ mafia: [y], police: [], doctor: [] }));
    const s2: RoomState = { ...s, players: s.players.map((p) => (p.seat === a ? { ...p, nightPick: undefined } : p)) };
    expect(flat(viewOf(s2, x!).spectate?.picks?.mafia)).toBe("[]");
  });

  it("탈락한 경찰의 view: records 와 spectate 가 함께 있고, spectate 의 키는 seats·picks 뿐이다(지난 정보 없음)", () => {
    const s0 = stateAt("night", 5, 1);
    const police = seatOfRole(s0, "police");
    const mafia = seatOfRole(s0, "mafia");
    const picked = actAt(actAt(s0, police, mafia), mafia, police);
    const dead = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    const v = viewOf(dead, police);
    expect(`${flat(v.me.records)} ${Object.keys(v.spectate ?? {}).join(",")}`).toBe(`${flat([{ n: 1, target: mafia, isMafia: true }])} seats`);
    const night2 = advanceTo(advanceTo(dead, "dayAnnounce", 1), "night", 1);
    expect(Object.keys(viewOf(night2, police).spectate ?? {}).sort().join(",")).toBe("picks,seats");
  });

  it("탈락자 view 의 me 에는 pick·allyPicks 가 없다(관전자는 행동하지 않는다) — 남은 nightPick 이 있어도", () => {
    const s0 = stateAt("night", 6, 1);
    const [a, b] = [seatOfRole(s0, "mafia", 0), seatOfRole(s0, "mafia", 1)];
    const police = seatOfRole(s0, "police");
    const y = nonMafiaSeats(s0)[0]!;
    const s: RoomState = {
      ...s0,
      players: s0.players.map((p) => (p.seat === b || p.seat === police ? { ...p, alive: false, nightPick: y } : p)),
    };
    const bad = [b, police].filter((seat) => "pick" in viewOf(s, seat).me || "allyPicks" in viewOf(s, seat).me);
    expect(`[${bad.join(",")}] ${a}`).toBe(`[] ${a}`);
    expect(Object.keys(viewOf(s, b).spectate ?? {}).sort().join(",")).toBe("picks,seats");
  });

  it("2일차 night(1일차 밤에 한 명 탈락): 4~8명 × 시드 3개 × 모든 viewer — 살아 있으면 spectate 경로가 없고 탈락했으면 직업 허용 경로가 더해진다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const { s: m } = morningWithVictim(n, seed);
        const s = nightActions(advanceTo(advanceTo(m, "dayAnnounce", seed), "night", seed));
        for (const viewer of s.players) {
          views += 1;
          const view = buildView(s, viewer.id, START_AT);
          violations.push(...spectateViolations(s, viewer, view, "night", `${n}/${seed}/seat${viewer.seat}`));
          for (const path of keyPaths(view)) {
            if (lastKey(path) === "role" && path !== "me.role") violations.push(`${n}/${seed}/seat${viewer.seat}: role at ${path}`);
          }
        }
      }
    }
    expect(views).toBe(3 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});

describe("buildView 허용 키 전수 (결정 0036-12, D-17, D-34)", () => {
  it("day 는 변론·처형·ended 에 있고 voteLog 는 배열이다; lobby·assigning·roleReveal 에는 day 키 자체가 없다 (4~8명 × 시드 3)", () => {
    const bad: string[] = [];
    let seen = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of ["defense", "execution", "ended"] as const) {
          const s = richStateAt(phase, n, seed);
          for (const p of s.players) {
            seen += 1;
            const day = buildView(s, p.id, START_AT).day;
            if (day === undefined || !Array.isArray(day.voteLog)) bad.push(`${phase}/${n}/${seed}/seat${p.seat}`);
          }
        }
        for (const phase of ["lobby", "assigning", "roleReveal"] as const) {
          const s = richStateAt(phase, n, seed);
          for (const p of s.players) if ("day" in buildView(s, p.id, START_AT)) bad.push(`${phase}/${n}/${seed}/seat${p.seat}: day`);
        }
      }
    }
    expect(seen > 0).toBe(true);
    expect(bad.join(",")).toBe("");
  });

  it("ended 의 result 는 모든 viewer(생존·탈락)에게 같다: 승리 팀·모든 직업·요약, 두 팀의 승리가 모두 검사된다 (4~8명 × 시드 3)", () => {
    const bad: string[] = [];
    const winners = new Set<string>();
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const team of ["citizen", "mafia"] as const) {
          const s = endedState(n, seed, team);
          winners.add(String(s.winner));
          const results = new Set(s.players.map((p) => flat(buildView(s, p.id, START_AT).result)));
          if (results.size !== 1) bad.push(`${n}/${seed}/${team}: result differs between viewers`);
          const view = buildView(s, s.hostId, START_AT);
          if (view.result?.winner !== (team === "citizen" ? "citizenWin" : "mafiaWin")) bad.push(`${n}/${seed}/${team}: winner ${String(view.result?.winner)}`);
          if (view.result?.summary.length === 0) bad.push(`${n}/${seed}/${team}: empty summary`);
          for (const p of s.players) {
            const v = buildView(s, p.id, START_AT);
            bad.push(...phaseKeyViolationsEnded(s, p, v, `${n}/${seed}/${team}/seat${p.seat}`));
          }
        }
      }
    }
    expect([...winners].sort().join(",")).toBe("citizenWin,mafiaWin");
    expect(bad.join("; ")).toBe("");
  });

  /** ended 상태(어느 팀이 이겼든)에 phaseKeyViolations 의 ended 규칙만 적용한다. 밤 기록을 쌓지 않는 판이라 요약에 night 줄이 없다. */
  function phaseKeyViolationsEnded(s: RoomState, viewer: Player, view: RoomView, tag: string): string[] {
    return [...phaseKeyViolations(s, viewer, view, "ended", tag), ...spectateViolations(s, viewer, view, "ended", tag)];
  }

  it("result 는 ended 전 어느 단계에도 없다 — 처형 단계에서 승패가 이미 정해져도(마지막 마피아를 처형) 처형 발표 동안은 키가 없다", () => {
    const bad: string[] = [];
    for (const n of [4, 5] as const) {
      for (const seed of SEEDS) {
        // 마피아가 한 명인 판에서 마피아가 후보 → 처형 발표 단계에서 이미 승패가 났지만 결과는 ended 로 가야 실린다.
        const s = stateWithVerdict(n, seed, "execution", { candidate: "mafia" });
        for (const p of s.players) {
          const view = buildView(s, p.id, START_AT);
          if ("result" in view) bad.push(`${n}/${seed}/seat${p.seat}: result in execution`);
          bad.push(...roleValueLeaks(view, !isAlive(p)).map((leak) => `${n}/${seed}/seat${p.seat}: ${leak}`));
        }
      }
    }
    expect(bad.join("; ")).toBe("");
  });
});

describe("buildView 처형 무효 이유 (D-34)", () => {
  it("처형이 이뤄진 날의 밤과 그 아침에는 noExecution 키가 없다", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const afterExec = advanceTo(stateWithVerdict(n, seed, "execution", { candidate: "citizen" }), "night", seed);
        for (const [tag, night, wantKey] of [["executed", afterExec, false]] as const) {
          for (const p of night.players) if (("noExecution" in (buildView(night, p.id, START_AT).day ?? {})) !== wantKey) bad.push(`${n}/${seed}/${tag}/night/seat${p.seat}`);
          const morning = advanceTo(night, "morning", seed);
          for (const p of morning.players) if ("noExecution" in (buildView(morning, p.id, START_AT).day ?? {})) bad.push(`${n}/${seed}/${tag}/morning/seat${p.seat}`);
        }
      }
    }
    expect(bad.join("; ")).toBe("");
  });
});

describe("buildView 마감 뒤 서버 전용 투표 키 (VOTE-01, D-02, T-04-30)", () => {
  it("마감 뒤: 어느 플레이어에도 execVote 키가 없고(서버에도 남지 않는다) voteLog 의 exec 는 no·passed·yes 세 키뿐이며 개인 줄이 없다 (4~8명 × 시드 3)", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of ["defense", "execution"] as const) {
          const s = stateWithVerdict(n, seed, phase);
          for (const p of s.players) if ("execVote" in p) bad.push(`${n}/${seed}/${phase}/seat${p.seat}: execVote key kept`);
          const line = buildView(s, s.hostId, START_AT).day!.voteLog![0]!;
          if (keysOf(line.exec) !== "no,passed,yes") bad.push(`${n}/${seed}/${phase}: exec keys ${keysOf(line.exec)}`);
          if (JSON.stringify(buildView(s, s.hostId, START_AT)).includes("execVote")) bad.push(`${n}/${seed}/${phase}: execVote in view`);
        }
      }
    }
    expect(bad.join("; ")).toBe("");
  });
});

describe("buildView 후보 공개 기록 (VOTE-02, D-19, T-04-32)", () => {
  it("변론부터는 모든 viewer 에게 같은 votes 가 실리고 어느 플레이어에도 candidateVote 키가 없다 (4~8명 × 시드 3)", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of ["defense", "execution"] as const) {
          const s = stateWithVerdict(n, seed, phase);
          const votes = new Set(s.players.map((p) => flat(buildView(s, p.id, START_AT).day!.voteLog![0]!.cand)));
          if (votes.size !== 1 || [...votes][0] === "undefined") bad.push(`${n}/${seed}/${phase}: cand differs or missing`);
          for (const p of s.players) if ("candidateVote" in p) bad.push(`${n}/${seed}/${phase}/seat${p.seat}: candidateVote key kept`);
        }
      }
    }
    expect(bad.join("; ")).toBe("");
  });
});

describe("buildView 처형자 직업 비공개 (D-09, T-04-31)", () => {
  it("처형 발표·그 뒤 밤·아침의 살아 있는 viewer 에게 역할 단어는 me.role·day.roles[] 경로에만 있고, 처형 발표는 seat 뿐이다 (4~8명 × 시드 3 × 시민·마피아 후보)", () => {
    const bad: string[] = [];
    let aliveViews = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const candidate of ["citizen", "mafia"] as const) {
          const exec = stateWithVerdict(n, seed, "execution", { candidate });
          const stages: Array<[string, RoomState]> = [["execution", exec]];
          // 마지막 마피아를 처형하면 아침·밤 없이 끝난다(4·5명 판) — 이어지는 판만 밤·아침을 본다
          if (n >= 6 || candidate === "citizen") {
            const night = advanceTo(exec, "night", seed);
            stages.push(["night", night], ["morning", advanceTo(night, "morning", seed)]);
          }
          for (const [name, s] of stages) {
            for (const p of s.players) {
              const view = buildView(s, p.id, START_AT);
              const tag = `${n}/${seed}/${candidate}/${name}/seat${p.seat}`;
              if (isAlive(p)) {
                aliveViews += 1;
                bad.push(...roleValueLeaks(view, false).map((leak) => `${tag}: ${leak}`));
              } else {
                bad.push(...roleValueLeaks(view, true).map((leak) => `${tag}: ${leak}`));
              }
              if (name === "execution" && keysOf(view.day!.execution) !== "seat") bad.push(`${tag}: execution keys ${keysOf(view.day!.execution)}`);
            }
          }
        }
      }
    }
    expect(aliveViews > 0).toBe(true);
    expect(bad.join("; ")).toBe("");
  });
});

describe("buildView 테스트 방 봇 투표 설정 me.testBotVote (P-13, T-04-45)", () => {
  const testLobby = (testBotVote?: RoomState["testBotVote"]): RoomState => ({
    ...lobbyOf(5),
    testMode: true,
    ...(testBotVote !== undefined ? { testBotVote } : {}),
  });
  const guestOf = (state: RoomState): Player => state.players.find((p) => p.id !== state.hostId)!;

  it("테스트 방 방장의 대기실 view 에서 무작위가 아닌 값이 있을 때만 me.testBotVote 가 실리고, 빠진 쪽은 random 이다", () => {
    const both = testLobby({ exec: "no", pick: "host" });
    expect(JSON.stringify(buildView(both, both.hostId, 1).me.testBotVote)).toBe('{"exec":"no","pick":"host"}');
    const execOnly = testLobby({ exec: "yes" });
    expect(JSON.stringify(buildView(execOnly, execOnly.hostId, 1).me.testBotVote)).toBe('{"exec":"yes","pick":"random"}');
    const pickOnly = testLobby({ pick: "other" });
    expect(JSON.stringify(buildView(pickOnly, pickOnly.hostId, 1).me.testBotVote)).toBe('{"exec":"random","pick":"other"}');
  });

  it("값이 없으면(빈 객체 포함) 키 자체가 없다", () => {
    for (const state of [testLobby(), testLobby({})]) {
      expect(Object.hasOwn(buildView(state, state.hostId, 1).me, "testBotVote")).toBe(false);
    }
  });

  it("손님·일반 방 방장·미리보기에는 값이 있어도 키 자체가 없다", () => {
    const state = testLobby({ exec: "no", pick: "host" });
    expect(JSON.stringify(buildView(state, guestOf(state).id, 1)).includes("testBotVote")).toBe(false);
    const normal: RoomState = { ...lobbyOf(5), testBotVote: { exec: "no", pick: "host" } };
    expect(JSON.stringify(buildView(normal, normal.hostId, 1)).includes("testBotVote")).toBe(false);
    expect(JSON.stringify(buildPreview(state)).includes("testBotVote")).toBe(false);
  });

  it("게임 중(대기실이 아닌 모든 단계)에는 방장 view 에도 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of PHASES) {
      if (phase === "lobby") continue;
      const s = { ...stateAt(phase, 5, 1), testMode: true as const, testBotVote: { exec: "no" as const, pick: "host" as const } };
      for (const p of s.players) {
        const json = JSON.stringify(buildView(s, p.id, START_AT));
        if (json.includes("testBotVote")) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(bad.join(",")).toBe("");
  });
});

// 07-10: 서버가 정한 내 채널(channelOf)이 본인 view 의 me.chat 에만 실린다. 말할 수 없으면 키 자체가 없다(허용 목록 방식).
describe("buildView me.chat — 서버가 정한 내 채널 (07-10, CHAT-02·03)", () => {
  /** 좌석 오름차순으로 '좌석:채널' (키 없음은 '-'). 한 줄 문자열이라 실패 보고가 한 줄이다. */
  const chatLine = (s: RoomState): string =>
    [...s.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
        const me = buildView(s, p.id, START_AT).me;
        return `${p.seat}:${"chat" in me ? String(me.chat) : "-"}`;
      })
      .join(" ");
  const everyone = (s: RoomState, ch: string): string =>
    [...s.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${ch}`).join(" ");

  it("대기실: 모두 all", () => {
    const s = stateAt("lobby", 5, 1);
    expect(chatLine(s)).toBe(everyone(s, "all"));
  });

  it.each(["dayAnnounce", "discussion", "defense", "execution", "morning"] as const)(
    "%s: 살아 있는 사람은 모두 all",
    (phase) => {
      const s = stateAt(phase, 6, 1);
      // 처형 발표 단계에는 방금 처형된 사람이 이미 탈락 상태다 — 그 사람은 ghost, 산 사람은 all.
      const want = [...s.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${isAlive(p) ? "all" : "ghost"}`).join(" ");
      expect(chatLine(s)).toBe(want);
    },
  );

  it("낮(discussion): 탈락자만 ghost 이고 산 사람은 all", () => {
    const s = withDead(stateAt("discussion", 6, 1), 2);
    const want = [...s.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${p.seat === 2 ? "ghost" : "all"}`).join(" ");
    expect(chatLine(s)).toBe(want);
  });

  it("밤: 산 마피아는 mafia, 산 비마피아는 키 없음", () => {
    const s = stateAt("night", 6, 1);
    const want = [...s.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${p.role === "mafia" ? "mafia" : "-"}`).join(" ");
    expect(chatLine(s)).toBe(want);
  });

  it("밤: 탈락자는 역할과 상관없이 ghost (탈락한 마피아도 mafia 가 아니다)", () => {
    const base = stateAt("night", 6, 1);
    const deadMafia = base.players.find((p) => p.role === "mafia")!.seat;
    const deadCitizen = base.players.find((p) => p.role === "citizen")!.seat;
    const s = withDead(withDead(base, deadMafia), deadCitizen);
    const want = [...s.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => `${p.seat}:${p.seat === deadMafia || p.seat === deadCitizen ? "ghost" : p.role === "mafia" ? "mafia" : "-"}`)
      .join(" ");
    expect(chatLine(s)).toBe(want);
  });

  it.each(["assigning", "roleReveal", "ended"] as const)("%s: 모두 키 없음 (탈락자 포함)", (phase) => {
    const s = withDead(stateAt(phase, 6, 1), 1);
    expect(chatLine(s)).toBe(everyone(s, "-"));
  });
});

// ---- 8페이즈 낮 처형 필드 (08-07, DAY-03~06, 결정 0053·0060) ----
// 흐름 전환(08-11) 전이라 지목·찬반 단계는 실제 전이로 닿지 못한다 — 상태를 손으로 세우되 규칙 함수 모양(키 이름·값)은 그대로 쓴다.
describe("buildView 낮 처형 필드 (08-07, DAY-03~06)", () => {
  const base = (): RoomState => startedAt(5, 1, "discussion");
  const withPlayer = (s: RoomState, seat: number, patch: Partial<Player>): RoomState => ({
    ...s,
    players: s.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)),
  });
  const wireKeys = (day: RoomView["day"]): string => Object.keys(day ?? {}).filter((k) => ["points", "endCount", "voted", "verdict"].includes(k)).sort().join(",");

  /** 후보 seat 2 가 변론자인 찬반·처형 단계 상태. */
  const trial = (phase: "nomination" | "verdict" | "execution"): RoomState => {
    const s = base();
    const day = s.day ?? 1;
    const common: RoomState = { ...s, phase, verdict: { passed: false, candidate: 2 } };
    if (phase === "execution") {
      return { ...common, verdict: { passed: true, candidate: 2 }, execution: { seat: 2 }, voteLog: [{ n: day, exec: { yes: 3, no: 1, passed: true }, cand: { votes: [], candidate: 2 } }] };
    }
    return common;
  };

  it("공개 필드는 자기 단계에서만 생긴다: discussion=endCount, nomination=points, verdict=voted, execution=verdict (모든 viewer)", () => {
    const states: Array<[PhaseId, RoomState]> = [
      ["discussion", base()],
      ["nomination", trial("nomination")],
      ["verdict", trial("verdict")],
      ["execution", trial("execution")],
    ];
    const got = states.map(([phase, s]) => `${phase}:${[...new Set(s.players.map((p) => wireKeys(buildView(s, p.id, START_AT).day)))].join("|")}`);
    expect(got.join(" ")).toBe("discussion:endCount nomination:points verdict:voted execution:verdict");
  });

  it("nomination: day.points 는 산 사람이 산 대상을 가리킨 줄만 좌석 순이고 모든 viewer 가 같다; 후보 키는 아직 없다", () => {
    let s = trial("nomination");
    s = withPlayer(s, 1, { nominate: 3 });
    s = withPlayer(s, 3, { nominate: 1 });
    s = withPlayer(s, 4, { nominate: 0, alive: false }); // 탈락자의 남은 값은 줄이 아니다
    const lines = new Set(s.players.map((p) => JSON.stringify(buildView(s, p.id, START_AT).day?.points)));
    expect([...lines].join("|")).toBe(JSON.stringify([{ seat: 1, target: 3 }, { seat: 3, target: 1 }]));
    expect(s.players.every((p) => !("candidate" in (buildView(s, p.id, START_AT).day ?? {})))).toBe(true);
  });

  it("discussion: day.endCount 는 누른 산 사람 수이고 me.endDiscussion 은 누른 산 본인에게만, 키는 다른 경로에 없다", () => {
    let s = base();
    s = withPlayer(s, 0, { endVote: true });
    s = withPlayer(s, 1, { endVote: true });
    s = withPlayer(s, 4, { endVote: true, alive: false }); // 죽은 사람의 남은 값은 세지 않는다
    const views = s.players.map((p) => ({ seat: p.seat, view: buildView(s, p.id, START_AT) }));
    expect(views.map((v) => String(v.view.day?.endCount)).join(" ")).toBe("2 2 2 2 2");
    expect(views.map((v) => String(v.view.me.endDiscussion)).join(" ")).toBe("true true undefined undefined undefined");
    expect(views.map((v) => Object.hasOwn(v.view.me, "endDiscussion")).join(" ")).toBe("true true false false false");
    const stray = views.flatMap((v) => keyPaths(v.view).filter((path) => ["endDiscussion", "endVote"].includes(lastKey(path)) && path !== "me.endDiscussion"));
    expect(stray.join(",")).toBe("");
  });

  it("verdict: day.voted 는 던진 유권자 좌석(오름차순, 값 없음), day.candidate 가 있고, me.verdictVote 는 본인(산 사람)에게만이며 남의 값·서버 키는 어느 경로에도 없다", () => {
    let s = trial("verdict");
    s = withPlayer(s, 3, { verdictVote: false });
    s = withPlayer(s, 0, { verdictVote: true });
    s = withPlayer(s, 2, { verdictVote: true }); // 변론자의 남은 값은 던진 것이 아니다
    s = withPlayer(s, 4, { verdictVote: true, alive: false }); // 죽은 사람도 던진 것이 아니다
    const views = s.players.map((p) => buildView(s, p.id, START_AT));
    expect(new Set(views.map((v) => JSON.stringify(v.day?.voted))).size).toBe(1);
    expect(JSON.stringify(views[0]!.day?.voted)).toBe(JSON.stringify([0, 3]));
    expect(views.map((v) => String(v.day?.candidate)).join(" ")).toBe("2 2 2 2 2");
    expect(views.map((v) => String(v.me.verdictVote)).join(" ")).toBe("true undefined undefined false undefined");
    const stray = views.flatMap((v) => keyPaths(v).filter((path) => ["verdictVote", "nominate", "endVote"].includes(lastKey(path)) && path !== "me.verdictVote"));
    expect(stray.join(",")).toBe("");
  });

  it("execution: day.verdict 는 그날 voteLog 줄의 {yes,no,passed} 세 키뿐이고, 줄이 없으면 키가 없다; day 에 역할 키가 없다", () => {
    const s = trial("execution");
    const views = s.players.map((p) => buildView(s, p.id, START_AT));
    expect(views.map((v) => JSON.stringify(v.day?.verdict)).join("|")).toBe(Array(5).fill(JSON.stringify({ yes: 3, no: 1, passed: true })).join("|"));
    expect(keysOf(views[0]!.day?.verdict)).toBe("no,passed,yes");
    const dayKeys = views.flatMap((v) => keyPaths(v.day).map(lastKey));
    expect(dayKeys.filter((k) => ["role", "job"].includes(k)).join(",")).toBe("");
    const noLine: RoomState = { ...s, voteLog: [] };
    expect(noLine.players.every((p) => !("verdict" in (buildView(noLine, p.id, START_AT).day ?? {})))).toBe(true);
  });
});

describe("마피아 집계 me.nightTally·me.nightSure (NIGHT-08, 결정 0061-7, L8)", () => {
  const viewOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT);
  const night6 = () => {
    const s0 = stateAt("night", 6, 1);
    const [m1, m2] = [seatOfRole(s0, "mafia", 0), seatOfRole(s0, "mafia", 1)];
    const [c1, c2] = nonMafiaSeats(s0);
    return { s0, m1, m2, c1: c1!, c2: c2! };
  };

  it("아직 아무도 안 골랐으면 산 마피아의 nightTally 는 [] 이고 nightSure 키는 없다", () => {
    const { s0, m1, m2 } = night6();
    for (const m of [m1, m2]) {
      const me = viewOf(s0, m).me;
      expect(flat(me.nightTally)).toBe("[]");
      expect("nightSure" in me).toBe(false);
    }
  });

  it("마피아 둘이 갈라 고르면 대상 seat 별 1표씩(seat 오름차순, 본인 포함) 이고 nightSure 가 없다 — 누가 골랐는지는 없다", () => {
    const { s0, m1, m2, c1, c2 } = night6();
    const s = actAt(actAt(s0, m1, c2), m2, c1);
    const want = flat([c1, c2].sort((a, b) => a - b).map((seat) => ({ seat, n: 1 })));
    for (const m of [m1, m2]) {
      const me = viewOf(s, m).me;
      expect(flat(me.nightTally)).toBe(want);
      expect("nightSure" in me).toBe(false);
    }
  });

  it("마피아 둘이 같은 대상을 고르면 [{seat, n:2}] 이고 nightSure 가 그 seat 다", () => {
    const { s0, m1, m2, c1 } = night6();
    const s = actAt(actAt(s0, m1, c1), m2, c1);
    for (const m of [m1, m2]) {
      const me = viewOf(s, m).me;
      expect(flat(me.nightTally)).toBe(flat([{ seat: c1, n: 2 }]));
      expect(me.nightSure).toBe(c1);
    }
    const half = actAt(s0, m1, c1);
    expect("nightSure" in viewOf(half, m1).me).toBe(false);
    expect(flat(viewOf(half, m1).me.nightTally)).toBe(flat([{ seat: c1, n: 1 }]));
  });

  it("마피아 1명 판은 선택 즉시 nightSure 다", () => {
    const s0 = stateAt("night", 4, 1);
    const m = seatOfRole(s0, "mafia");
    const x = nonMafiaSeats(s0)[0]!;
    const s = actAt(s0, m, x);
    expect(viewOf(s, m).me.nightSure).toBe(x);
    expect(flat(viewOf(s, m).me.nightTally)).toBe(flat([{ seat: x, n: 1 }]));
  });

  it("시민·경찰·의사 view 에는 두 키가 없다(밤, 마피아가 모두 고른 뒤에도)", () => {
    const { s0, m1, m2, c1, c2 } = night6();
    const s = actAt(actAt(s0, m1, c1), m2, c1);
    for (const seat of [c1, c2, seatOfRole(s0, "police"), seatOfRole(s0, "doctor")]) {
      const me = viewOf(s, seat).me;
      expect(["nightTally" in me, "nightSure" in me]).toEqual([false, false]);
    }
  });

  it("탈락한 사람(유령)·탈락한 마피아의 view 에도 두 키가 없다", () => {
    const { s0, m1, m2, c1, c2 } = night6();
    const picked = actAt(actAt(s0, m1, c1), m2, c1);
    const dead: RoomState = { ...picked, players: picked.players.map((p) => (p.seat === c2 || p.seat === m2 ? { ...p, alive: false } : p)) };
    for (const seat of [c2, m2]) {
      const me = viewOf(dead, seat).me;
      expect(["nightTally" in me, "nightSure" in me]).toEqual([false, false]);
    }
    expect(viewOf(dead, m1).me.nightSure).toBe(c1); // 산 마피아 1명이 된 밤: 그 한 명의 선택이 확정
  });

  it("낮·아침 단계의 마피아 view 에는 두 키가 없다", () => {
    const { s0, m1, m2, c1 } = night6();
    const picked = actAt(actAt(s0, m1, c1), m2, c1);
    const morning = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    const day = advanceTo(morning, "discussion", 1);
    for (const s of [morning, day]) {
      const me = viewOf(s, m1).me;
      expect(["nightTally" in me, "nightSure" in me]).toEqual([false, false]);
    }
  });

  it("저장된 선택이 탈락자·마피아를 가리키면 집계에 들지 않는다(방어적 재검증)", () => {
    const { s0, m1, m2, c1, c2 } = night6();
    const raw: RoomState = {
      ...s0,
      players: s0.players.map((p) =>
        p.seat === m1 ? { ...p, nightPick: m2 } : p.seat === m2 ? { ...p, nightPick: c2 } : p.seat === c2 ? { ...p, alive: false } : p,
      ),
    };
    const me = viewOf(raw, m1).me;
    expect(flat(me.nightTally)).toBe("[]");
    expect("nightSure" in me).toBe(false);
    expect(c1).toBeGreaterThanOrEqual(0);
  });
});

describe("buildView 아침 morning.saved (MORN-03, 결정 0061-12)", () => {
  it("의사가 확정 대상을 지키면 모든 viewer 의 day.morning 이 { saved: true } 뿐이다(보호 대상 seat 없음)", () => {
    const s0 = stateAt("night", 6, 1);
    const x = nonMafiaSeats(s0).filter((t) => t !== seatOfRole(s0, "doctor"))[0]!;
    const picked = actAt(
      actAt(actAt(s0, seatOfRole(s0, "mafia", 0), x), seatOfRole(s0, "mafia", 1), x),
      seatOfRole(s0, "doctor"),
      x,
    );
    const m = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    for (const p of m.players) {
      const day = buildView(m, p.id, START_AT).day;
      expect(flat(day?.morning)).toBe(flat({ saved: true }));
    }
  });
});

describe("buildView 분필 day.chalk (MORN-01, 결정 0061-14)", () => {
  it("chalk 가 있는 아침 상태 → 모든 viewer 의 day.chalk 가 { x, z } 필드별 복사, 없으면 키 자체가 없다", () => {
    const { s } = morningWithVictim(5, 1);
    const without = s.players.map((p) => "chalk" in (buildView(s, p.id, START_AT).day ?? {})).filter(Boolean).length;
    expect(without).toBe(0);
    const marked: RoomState = { ...s, chalk: { x: 120, z: -80 } };
    const got = marked.players.map((p) => flat(buildView(marked, p.id, START_AT).day?.chalk));
    expect(got.join("|")).toBe(marked.players.map(() => flat({ x: 120, z: -80 })).join("|"));
  });
});
