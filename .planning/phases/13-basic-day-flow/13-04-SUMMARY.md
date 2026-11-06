---
phase: 13-basic-day-flow
plan: "04"
subsystem: basic-ruleset-off-gates
tags: [ruleset, leak-check, silent-reject, view-gate, vitest, flow-03]

requires:
  - phase: 13-01
    provides: RULESET(다섯 값 모두 꺼짐), 서버 흐름 분기
  - phase: 13-02
    provides: 봇·smoke 동시 투표
  - phase: 13-03
    provides: 동시 투표 화면(day.turn 없는 투표)
provides:
  - badge·whisper 메시지의 조용한 거절(보낸 소켓에만 BAD_MESSAGE 한 프레임, 저장·방송·채팅 줄 없음)
  - view 게이트(badge·badgeSwapped·day.turn·runoff·showdown·me.whisperUsed·me.ballot 을 서버 상태와 무관하게 RULESET 이 막음)
  - 누설 검사 기본판 전수(허용 경로를 켜진 장치만 허용하도록 좁힘, 한 판 전체 꺼진 장치 키 0건)
  - 화면 진입점 게이트(떠 있는 버튼·묶음·주장/한 줄 시트 없음, 결과 화면 귓속말 탭 없음)
affects: [13-05, 13-06]

requirements-completed: [FLOW-03]

actuals:
  tokens: 23900
  tasks: 3
  commits: 6

plan_head_before: 2e7b15fddd71e183436061985e89c271ab2ad58e
plan_head_after: 60ef9292eaa49cf9cf1996255ff76437b4292c64

tech-stack:
  added: []
  patterns:
    - "꺼진 장치 코드는 지우지 않고 한 곳(RULESET)으로 끈다: 서버 메시지 문·view 키·화면 진입점이 모두 같은 값을 읽는다"
    - "켜짐 전용 시험은 describe.skipIf(!RULESET.x) / it.skipIf(!RULESET.x) — 본문은 지우지 않는다"
    - "누설 검사 허용 경로는 politicsPathsFor(ruleset) 로 켜진 장치만 넣는다(기본판은 찬반 기록 하나뿐)"

key-files:
  created:
    - test/worker/basicOff.test.ts
  modified:
    - worker/room.ts
    - shared/game/view.ts
    - src/game/badgeView.ts
    - src/game/whisperView.ts
    - src/game/resultText.ts
    - src/components/v2/ResultPanel.tsx
    - test/unit/view.test.ts
    - test/unit/ruleset.test.ts
    - test/unit/badge.test.ts
    - test/unit/whisper.test.ts
    - test/unit/badgeView.test.ts
    - test/unit/whisperView.test.ts
    - test/worker/badge.test.ts
    - test/worker/whisper.test.ts
    - test/worker/leak.test.ts
    - test/worker/resultLog.test.ts
    - test/client/badgeUi.test.tsx
    - test/client/whisperUi.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/resultPanel.test.tsx
    - test/client/resultScreen.test.tsx

key-decisions:
  - "꺼진 badge·whisper 는 rejectDisabled 한 곳으로 모아 sendTo(error BAD_MESSAGE) 한 프레임만 보낸다 — 알 수 없는 메시지와 같게 보여 장치가 있었다는 사실도 새지 않는다"
  - "view 게이트는 서버 상태에 값이 남은 옛 저장 방도 막도록 RULESET 만 읽는다(상태 유무로 가르지 않음)"
  - "누설 허용 경로는 넓히지 않고 좁힌다: me.ballot 은 결선·결전 중 하나가 켜질 때, verdict.last 는 결전이 켜질 때, 찬반 기록(day.ballots)은 다섯 장치 밖이라 늘 허용"
  - "RESULT_TABS 와 ResultTabId 는 그대로 두고 화면은 RESULT_TABS_SHOWN 만 읽는다(켜면 다시 귓속말 탭이 보인다)"

duration: 약 70분
completed: 2026-11-07
status: complete
---

# Phase 13 Plan 04: 꺼진 장치 끝까지 막기 Summary

**직업 주장·귓속말·순차 지목·결선·결전이 기본판의 서버 메시지·view·누설 검사·화면 진입점·결과 탭 어디에도 나타나지 않게 RULESET 한 곳으로 막았고, 기본판 한 판 전체에서 꺼진 장치의 키·줄·단계가 0건임을 누설 검사가 고정한다. 코드는 지우지 않았다.**

## Performance

- **Duration:** 약 70분
- **Tasks:** 3 / **Files:** 22 수정, 신규 1(`test/worker/basicOff.test.ts`)
- **Commits:** 6 (측정값, `plan_head_before` 2e7b15fd → `plan_head_after` 60ef9292)

## Accomplishments

- `worker/room.ts`: `case "badge"`·`case "whisper"` 가 `RULESET.badge`·`RULESET.whisper` 꺼짐이면 `rejectDisabled(ws)` — 보낸 소켓에 `{t:"error", code:"BAD_MESSAGE"}` 한 프레임. handle*·스키마는 그대로. 거절 뒤 같은 소켓의 정상 채팅은 평소처럼 모두에게 간다.
- `shared/game/view.ts`: players 행의 badge·badgeSwapped, `day.turn`·`day.runoff`·`day.showdown`, `me.whisperUsed`, runoff·showdown 의 `me.ballot` 을 각 RULESET 값일 때만 만든다(파일 머리 받는 사람 표에 한 줄).
- `src/game/badgeView.ts`·`whisperView.ts`: `floatVisible`·`whisperVisible` 맨 앞 `if (!RULESET.x) return false` → GameMap 의 `FloatActions` 컨테이너(빈 띠)·주장 시트·한 줄 시트가 만들어지지 않는다. GameMap 은 고치지 않았다(`floatRef` 는 높이 측정에 쓰이지 않아 플로팅 줄 높이 0 확인 불필요).
- `src/game/resultText.ts`: `RESULT_TABS_SHOWN`(귓속말 뺀 all·mafia·ghost·log), `ResultPanel` 이 이를 읽는다.
- 시험: 신규 `basicOff.test.ts` 4건, view 게이트 4건, 누설 검사 "기본판 — 꺼진 장치 키 0건"(richEndedGame6 한 판 전체, 오류 프레임이 경찰 1·시민 X 2 뿐임까지), "허용 경로 고정" 2건, 클라이언트 "기본판: 낮 토론에 떠 있는 버튼·시트가 없다"·"기본판: 결과 화면 귓속말 탭이 없다".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 이월 실패 파일을 기본판 계약으로 정리**
- **Found during:** Task 1·2
- **Issue:** `test/unit/view.test.ts` 14건(day.turn 가정·단계 길이·결선/결전 view·산 셋 결전 진입)과 `test/worker/leak.test.ts` 5~6건이 13-01~03 의 동시 투표·꺼진 장치 계약과 어긋났다.
- **Fix:** 단계 길이는 동시 투표 15초(`NOMINATION_MS`)·전원 기권 밤 +30초로 고쳤고, 켜짐 전용(순차 지목·결선·결전) 시험은 `skipIf(!RULESET.x)`. 전수 누설 검사의 `day.turn` 은 `RULESET.pickTurn && nomination` 일 때만 있다고 단언해 기본판에서는 어느 단계에도 키가 없음을 본다. 판정을 느슨하게 하지 않았다(허용 경로는 오히려 좁힘).
- **Files modified:** test/unit/view.test.ts, test/worker/leak.test.ts
- **Commit:** 16da35a6, bfdea73f

**2. [Rule 3 - Blocking] 계획 목록 밖 시험 보정**
- **Found during:** Task 2·3 (전체 unit·worker·client 실행)
- **Issue:** 계획의 파일 목록에 없던 시험이 꺼진 장치를 전제해 실패했다: `test/unit/badge.test.ts`(3)·`test/unit/whisper.test.ts`(1)(view 에 badge·whisperUsed 기대), `test/worker/resultLog.test.ts`(2)(귓속말·주장 줄 기대), `test/client/gameMap.test.tsx`(2, 떠 있는 버튼 거절 소리), `test/client/resultScreen.test.tsx`(탭 다섯 기대 + 이어서 번지는 시상식 36건), `test/client/phaseScreens.test.tsx`(공개 예고 문구).
- **Fix:** 켜짐 전용은 `skipIf(!RULESET.x)`, 탭·점 표식 기대는 `RESULT_TABS_SHOWN` 기준, 결과 공개 묶음의 귓속말·주장 부분은 기본판에서 빈 줄 기대(`RULESET` 켜짐이면 기존 기대 그대로). resultScreen 의 시상식 연쇄 실패는 탭 시험 실패가 남긴 상태 때문이었고 탭 시험을 고치자 사라졌다.
- **Commit:** bfdea73f, 79f971a0

**3. [Rule 2 - 꺼진 장치의 글 없음] 역할 확인 공개 예고 문구에서 귓속말 제거**
- **Found during:** Task 3
- **Issue:** `RESULT_PANEL_TEXT.preNotice`("끝나면 밤 대화와 귓속말이 공개돼요")가 역할 확인 화면(`RoleReveal`)에 4초 보였다 — 기본판에는 귓속말이 없어 UI-SPEC "꺼진 장치의 글이 없다"와 어긋난다.
- **Fix:** `RULESET.whisper` 꺼짐이면 "끝나면 밤 대화가 공개돼요". 켜짐이면 원래 문구. 마피아 밤 대화는 기본판에도 있어 앞부분은 유지.
- **Files modified:** src/game/resultText.ts, test/client/phaseScreens.test.tsx
- **Commit:** 79f971a0

**4. [프로세스] TDD 순서**
- Task 1·3 은 RED 커밋(230b1480, e292651a) → GREEN 커밋. Task 2 는 시험만 있는 작업이라(허용 경로 좁힘·전수 검사 추가) 단일 `test` 커밋(bfdea73f)이다. 새 "꺼진 장치 키 0건" 시험은 view 게이트가 이미 들어간 뒤에 쓰여 처음부터 통과한다 — 게이트를 빼면 실패하는지는 view 게이트 RED(230b1480, 4건 실패 확인)가 직접 보여 준다.

**총:** 4건(Rule 3 2, Rule 2 1, 프로세스 1). 계획 범위 안이고 사용자 영향 없음(3번은 4초 안내 문구 한 줄).

## Authentication Gates

없음.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·스키마 경계 없음. T-13-11(view 게이트+전수 0건), T-13-12(조용한 거절 DO 시험), T-13-13(귓속말 줄 0건), T-13-14(허용 경로 좁힘)를 지켰다.

## 검증

- `npx vitest run --project unit --project worker`: 167 파일 통과 / 6 건너뜀, 4521 통과·161 건너뜀·**실패 0** (Task 2 마지막 실행).
- `npm test` 전체(마지막 상태, 클라이언트 포함): 237 파일 통과 / 6 건너뜀, **6852 통과·260 건너뜀·실패 0**.
- `npm run typecheck`(tokens:check·wrangler types·app·worker) 통과.
- 인수 기준: `grep -c "RULESET.badge\|RULESET.whisper" worker/room.ts` 2, `grep -c "RULESET\." shared/game/view.ts` 7, `basicOff.test.ts` `it(` 4, badge·whisper 워커 시험 `skipIf(!RULESET` 각 3, `leak.test.ts` "꺼진 장치 키 0건" 1·`skipIf(!RULESET` 4, `badgeView.ts` `RULESET.badge` 2, `whisperView.ts` `RULESET.whisper` 2, `RESULT_TABS_SHOWN` 2, "떠 있는 버튼·시트가 없다" 1.
- 간헐 실패 기록: `test/worker/continuity.test.ts` "옛 방장이 같은 토큰으로 돌아오면…" 이 병렬 전체 실행의 한 번과 단독 실행 한 번에서 5초 시간 초과로 실패했고 이후 단독 두 번·전체 실행 두 번은 통과했다(이 계획의 변경과 무관한 타이밍 시험으로 판단, 가리지 않았다). `bots.test.ts` 의 알려진 간헐 두 건은 이번 실행에서 실패하지 않았다.
- E2E(`npm run e2e` 계열)는 이 계획에서 돌리지 않았다 — 13-05·13-06 의 몫.

## 이월 메모 (13-05·13-06)

- 서버·view·화면 진입점은 모두 닫혔다. 이제 E2E·배포 검증에서 기본판 화면에 `[data-float]`·`[data-claim-sheet]`·`[data-line-sheet]`·`[data-speak-sheet]`·`data-result-tab="whisper"` 가 0개여야 한다(부재 검사 선택자 그대로).
- `test/worker/helpers.ts` 의 `richEndedGame6` 는 아직 badge·whisper 를 보내(거절됨) 결과 공개 묶음의 귓속말·주장 부분이 빈 줄인 한 판을 만든다. 기본판 E2E 대본에서 같은 메시지를 보내면 오류 프레임이 온다는 점에 주의.
- 켜짐 전용 시험은 본문이 그대로 남아 있다. `RULESET` 값을 바꿔 정통 판을 켜면 `skipIf(!RULESET.x)` 가 풀리며 다시 돈다(누설 검사 허용 경로도 함께 넓어진다).

## Self-Check: PASSED

- 신규 `test/worker/basicOff.test.ts` 와 수정 파일 22개 존재 확인, 커밋 230b1480·16da35a6·bfdea73f·e292651a·79f971a0·60ef9292 가 HEAD 의 조상임을 확인.
