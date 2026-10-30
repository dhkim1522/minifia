---
phase: 04-execution-verdict
verified: 2026-10-30T02:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/04-execution-verdict/04-01-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-01-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-02-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-02-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-03-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-03-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-04-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-04-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-05-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-05-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-06-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-06-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-07-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-07-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-08-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-08-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-09-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-09-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-10-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-10-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-11-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-11-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-12-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-12-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-13-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-13-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-14-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-14-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-15-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-15-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-16-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-16-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-17-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-17-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-18-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-18-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-19-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-19-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-20-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-20-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-21-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-21-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-22-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-22-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-23-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-23-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-24-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-24-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-25-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-25-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-26-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-26-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-27-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-27-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-28-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-28-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-29-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-29-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-30-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-30-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-31-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-31-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-32-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-32-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-33-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-33-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-34-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-34-SUMMARY.md"
  - ".planning/phases/04-execution-verdict/04-35-PLAN.md"
  - ".planning/phases/04-execution-verdict/04-35-SUMMARY.md"
  - "shared/game/chat.ts"
  - "shared/game/endgame.ts"
  - "shared/game/execution.ts"
  - "shared/game/phases.ts"
  - "shared/game/tick.ts"
  - "shared/game/view.ts"
  - "shared/game/vote.ts"
  - "shared/game/win.ts"
  - "src/components/ExecVotePanel.tsx"
  - "src/game/blankTap.ts"
  - "src/game/verdict.ts"
  - "src/screens/ResultScreen.tsx"
  - "src/screens/verdictScene.tsx"
  - "worker/room.ts"
covered_digest: "v3:sha256:a054012811887b49ba00d2cbddd53e84e721656999a53bf754d73ce7c481c940"
behavior_unverified: 0
overrides_applied: 0
---

# 4페이즈: 처형과 승패 검증 보고서

**페이즈 목표:** 낮 토론 뒤 처형 여부 투표, 후보 선택 투표, 최후 변론, 처형을 거치고 승패가 나면 모든 역할이 공개되는 결과 화면으로 가서, 한 판이 끝까지 돌아간다 (결정 0034).
**검증 시각:** 2026-10-30
**상태:** passed
**재검증:** 아니오 (최초 검증)

판정 기준: 현재 코드(`shared/`, `worker/`, `src/`)를 직접 읽고, 시간·UX 문구는 결정 0039(토론 40초, 여부 투표 13초 + 카드 3초, 공개 한 표 2초)와 0040(후보 선택 빈 곳 탭 취소, 무효표)을 갱신본으로 본다. SUMMARY 의 주장은 근거로 쓰지 않았다.

## 목표 달성

### 관찰 가능한 참 (ROADMAP 성공 기준 6개)

| # | 참 | 상태 | 근거 |
|---|----|------|------|
| 1 | 처형 여부 투표에서 생존자가 찬성·반대를 고르고(집계 실시간, 번복 가능, 개인 표 비공개), 던진 표 중 찬성 과반일 때만 후보 선택으로 가며 아니면 밤. 기권 버튼 없음, 못 보낸 표는 무효 | VERIFIED | `shared/game/vote.ts` `castExecVote`(번복·마감 불변), `execTallyOf`(실시간·마감 동일 함수), `resolveExecVote`(`yes*2 > thrown`, 던진 표 0 이면 불통과 → night, 마감 때 `execVote` 키째 삭제). `view.ts` 가 `execTally` 만 모두에게, `voteAgree` 는 본인에게만 싣는다. `ExecVotePanel.tsx` 에 [찬성][반대] 둘뿐, 기권 버튼 없음. 시간은 0039 로 13초(`EXEC_VOTE_MS`, 카드 3초 포함) — ROADMAP 의 "10초" 는 0039 로 대체됨 |
| 2 | 후보 선택에서 자기 제외 한 명을 고르고 최다 득표가 후보(동률이면 처형 없이 밤), 마감 뒤 누가 누구를 골랐는지 화살표·표수로 한 명씩 공개 | VERIFIED | `castCandidateVote`(자기 자신 `BAD_MESSAGE`, 탈락자 대상 거부, `null` 취소는 0040), `tallyCandidateVote`(동률·0표 후보 없음 → `routeAfterCandidateVote` 가 night). 서버가 Fisher–Yates 로 공개 순서를 정해 `voteLog.cand.votes` 에 기록, 길이는 `candidateRevealMs(n)`(= 400 + n×2000 + 600, 0표 2000). 화면 `RevealLayer`/`useRevealState` 가 같은 상수로 시간표를 만든다. 취소·미선택은 키가 없어 무효표(0040) |
| 3 | 최후 변론 동안 후보가 가운데로 스포트라이트를 받고, 후보만 변론 메시지, 나머지는 이모티콘만. 여부·후보 선택 중에는 빠른 메시지·이모티콘 가능 | VERIFIED | `chat.ts` `say`: `defense` 에서 `verdict.candidate !== sender.seat` 이면 `WRONG_PHASE`, 변론 템플릿 6개(`defNotMe`…`defPlead`, `when: "defense"`), `emote` 는 `EMOTE_PHASES` 에 `defense` 포함. `SAY_PHASES`/`EMOTE_PHASES` 에 `execVote`·`candidateVote` 포함. `verdictScene.tsx` defense 분기: 후보 `center: true`, 어둡게·흐림(`VERDICT_DIM_PERCENT`·`VERDICT_BLUR_PX`), 후보 본인 `DefenseChips`, 그 밖 `DefensePanel` |
| 4 | 처형에 후보가 탈락하고 직업은 비공개. 폰을 꺼 둔 사람이 있어도 각 단계가 제때 마감. 처형 중 메시지 불가 | VERIFIED | `enterExecution` 이 후보 `alive:false` 처리, `execution { seat, phrase }` 에 직업 없음(`view.ts` 도 직업을 싣지 않음). `tick.ts` 는 서버 시각(`deadline + 길이`)만으로 진행하고 연결 여부를 보지 않는다(CONN-02). 못 던진 표는 분모에서 빠짐(`execTallyOf`, `tallyCandidateVote`). `SAY_PHASES`·`EMOTE_PHASES` 에 `execution`·`candidateVoteReveal`·`ended` 없음 → 거부. `test/worker/alarm.test.ts`·`endgame.test.ts` 통과 |
| 5 | 마피아 전멸이면 시민 승, 마피아 ≥ 나머지 생존자면 마피아 승으로 처형·아침 직후 즉시 종료, 아니면 다음 밤 | VERIFIED | `win.ts` `checkWinner`(역할 없으면 null, 마피아 0 → citizen, `mafia >= others` → mafia, 연결 상태 미참조). `endgame.ts` `routeAfterExecution`·`routeAfterMorning` 이 마감 훅에서만 판정해 `ended` 또는 기본 다음 단계(night / dayAnnounce). `tick.ts` ON_DEADLINE 표에 execution·morning 등록, `enterEnded` 가 `winner` 기록 |
| 6 | 결과 화면에 승리 팀, 모든 사람의 역할, 판 요약이 공개되고, 처음 화면으로 돌아가 새 방을 만들 수 있다 | VERIFIED | `view.ts` 가 `ended` 에서만 `result { winner, seats, summary }`(`buildSummary`)를 모두에게 같게 싣는다. `RoomScreen.tsx` `ended` → `ResultScreen`(배너·직업 카드 격자·`summaryLines`·[처음으로]). `onExit("left")` → `App.tsx` `clearSession(); goHome()` 으로 첫 화면 복귀. 방은 `ENDED_ROOM_TTL_MS`(30분) 뒤 정리 |

**점수:** 6/6 참 확인 (코드 증거). 실기기 항목은 아래 별도 기록.

### 결정 0039·0040 반영 확인 (갱신본 기준)

| 항목 | 현재 코드 | 상태 |
|------|-----------|------|
| 낮 토론 40초 | `phases.ts` `DISCUSSION_MS = 40_000` | OK |
| 여부 투표 13초(카드 3초 포함) | `EXEC_VOTE_MS = 13_000` | OK |
| 공개 한 표 2초, 서버가 표 수로 단계 길이 결정 | `candidateRevealMs`, `discussion.ts` `phaseDurationOf`, `tick.ts` 가 진입 훅 뒤 길이로 마감 재설정; 서버·화면이 `phases.ts` 상수 한 출처 | OK |
| 후보 선택 취소(`target: null`), 마감 때 미선택은 무효표 | `shared/schemas.ts` `.nullable()`, `protocol.ts`, `castCandidateVote`, `worker/room.ts` `applyCandidateVote`(투표자 본인에게만 state), `verdictScene.tsx` `cancelPick`, `src/game/blankTap.ts` | OK |
| 공개 길이가 표를 흘리지 않음 | 진행 중 `candidateVote` 길이는 표 수와 무관(`phaseDurationOf` 는 공개 단계에서만 파생) | OK |

ROADMAP 성공 기준 1번의 "10초" 문구는 0039 이후 실제 값(13초)과 어긋나는 문서 표기 잔재다. 구현 결함은 아니다 (참고 사항).

### 필수 산출물

| 산출물 | 상태 | 내용 |
|--------|------|------|
| `shared/game/vote.ts`·`execution.ts`·`endgame.ts`·`win.ts`·`phases.ts`·`tick.ts`·`discussion.ts` | VERIFIED | 존재·실질 구현·배선(`tick.ts` ON_ENTER/ON_DEADLINE 표) |
| `shared/game/chat.ts`·`view.ts`·`shared/protocol.ts`·`shared/schemas.ts` | VERIFIED | 변론 후보 제한, 허용 목록 view, 와이어 타입·스키마 |
| `worker/room.ts` | VERIFIED | `execVote`·`candidateVote` 핸들러 → `castExecVote`·`castCandidateVote`, 봇 행동도 같은 `apply*` 를 통과 |
| `src/screens/verdictScene.tsx`·`RoomScreen.tsx`·`ResultScreen.tsx`·`src/components/ExecVotePanel.tsx` 외 | VERIFIED | 단계별 장면 조립, `ended` → `ResultScreen` 라우팅 |
| `src/game/verdict.ts`·`blankTap.ts` | VERIFIED | 연출 상수·문구 정본, 빈 곳 탭 판정 |

### 핵심 연결 확인

| 출발 | 도착 | 경유 | 상태 |
|------|------|------|------|
| `verdictScene.tsx` | `worker/room.ts` | `connection.send({t:"candidateVote", target})` → `handleCandidateVote` → `castCandidateVote` | WIRED |
| `ExecVotePanel.tsx` | `worker/room.ts` | `send({t:"execVote", agree})` → `handleExecVote` → `castExecVote` | WIRED |
| `tick.ts` | `vote.ts`·`execution.ts`·`endgame.ts` | ON_ENTER·ON_DEADLINE 표 | WIRED |
| `view.ts` | `ResultScreen.tsx` | `result` 가 `ended` 에서만 실림, `RoomScreen` 이 `view.result` 있을 때만 라우팅 | WIRED |
| `ResultScreen.tsx` | `App.tsx` | `onExit("left")` → `clearSession` + `goHome` | WIRED |

### 데이터 흐름 (레벨 4)

| 산출물 | 데이터 | 출처 | 실제 데이터 | 상태 |
|--------|--------|------|-------------|------|
| `ExecVotePanel` | `view.day.execTally` | `execTallyOf(state)` ← 플레이어 `execVote` | 예 | FLOWING |
| `RevealLayer` | 공개 계획 | 서버 `voteLog.cand.votes`(서버 셔플 순서) | 예 | FLOWING |
| `ResultScreen` | `result.seats`·`summary` | `buildSummary(voteLog, nightLog)`, 실제 역할 | 예 | FLOWING |

### 행동 점검 (실제 실행)

| 행동 | 명령 | 결과 | 상태 |
|------|------|------|------|
| 4페이즈 관련 단위·화면·워커 시험 27개 파일 | `npx vitest run test/unit/{vote,execution,endgame,win,verdict,tick,discussion,schemas,chat,view}.test.ts test/client/{blankTap,candidateVote,execVote,execIntro,execution,noExecution,defense,defenseChips,resultScreen,reveal,revealLayer,verdictStates}.test.ts(x) test/worker/{vote,endgame,leak,alarm,day}.test.ts` | 27 파일 · 949 시험 통과 | PASS |
| 전체 시험 | `npx vitest run` | 111 파일 · 3035 시험 통과 | PASS |
| 타입 검사 | `tsc -p tsconfig.app.json --noEmit`, `tsc -p tsconfig.worker.json --noEmit` | 오류 없음 | PASS |

`test/worker/leak.test.ts` 가 한 판의 모든 프레임에서 남의 표·역할·`nightLog` 누출이 없음을 확인한다(결정 0002 준수).

### 요구사항 충족

| 요구사항 | 상태 | 근거 |
|----------|------|------|
| VOTE-01 | SATISFIED | 위 참 1 |
| VOTE-02 | SATISFIED | 위 참 2 (0040 취소·무효표 포함) |
| VOTE-03 | SATISFIED | 위 참 3 (후보 가운데·어둡게·흐림) |
| VOTE-04 | SATISFIED | 위 참 4, 투표 내역은 `voteLog`/`summary` 와 기록 카드(`recordRows`)로 날짜별 누적 |
| COMM-03 | SATISFIED | `chat.ts` 변론 후보 전용 say, 나머지 emote |
| CONN-02 | SATISFIED | 서버 시각 진행, 못 보낸 표 무효, 끊긴 사람도 생존자 수에 포함(`checkWinner` 가 연결 미참조) |
| END-01 | SATISFIED | 위 참 5 |
| END-02 | SATISFIED | 위 참 6 |

고아 요구사항 없음: REQUIREMENTS.md 의 4페이즈 매핑 8개가 모두 계획에서 청구되고 구현 증거가 있다.

### 안티패턴

`TBD|FIXME|XXX` 는 `shared/game`, `worker`, `src/screens`, `src/game`, `src/components` 에서 발견되지 않았다. 스텁·빈 구현·하드코딩 빈 데이터로 렌더링에 흘러드는 곳 없음.

### 실기기 확인 (사용자 승인 완료)

`04-UAT.md` 10개 항목(처형 투표 인트로, 후보 선택, 표 공개 연출, 최후 변론 스포트라이트, 처형 카드·유령 전환, 처형 무효 → 밤, 결과 화면, 승패 판정, 8명판·360폭, 관전 화면)이 모두 pass 이며 사용자가 2026-10-30 에 실기기로 확인·승인했다. 결정 0039·0040 의 체감값(토론 40초, 카드 3초, 한 표 2초, 빈 곳 탭 취소)도 같은 날 사용자가 전체 승인했다. 보류 항목 없음.

### 배포

`HANDOFF.md` 기준 0039·0040 반영본이 개인 Cloudflare 계정 `https://minifia.dhplay.workers.dev` 버전 `2026-10-29T14:52:03Z+cb6979c` 로 배포되어 smoke 4·5·8명, UAT 5종, E2E 를 통과했다고 기록돼 있다. 이 검증에서 배포본에 직접 접속하지는 않았다(코드와 로컬 시험 기준). 04-35 에서 최초 배포·배포본 검증이 수행됐다.

### 갭 요약

갭 없음. 막는 항목(BLOCKER)과 경고(WARNING) 없음. 참고 사항 하나: ROADMAP.md 4페이즈 성공 기준 1번의 "10초" 문구가 0039 의 13초와 어긋난다. 다음 문서 정리 때 맞추면 된다.

---

_검증: 2026-10-30_
_검증자: Claude (gsd-verifier)_
