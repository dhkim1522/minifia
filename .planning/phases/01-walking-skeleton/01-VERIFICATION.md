---
phase: 01-walking-skeleton
verified: 2026-10-24T00:00:00Z
status: passed
score: 5/5 로드맵 성공 기준 검증, 이전 열린 갭 4건(G-01-9·G-01-1a·G-01-2·G-01-5) 모두 닫힘, UAT 11/11
covered_files: [".planning/phases/01-walking-skeleton/01-01-PLAN.md",".planning/phases/01-walking-skeleton/01-01-SUMMARY.md",".planning/phases/01-walking-skeleton/01-02-PLAN.md",".planning/phases/01-walking-skeleton/01-02-SUMMARY.md",".planning/phases/01-walking-skeleton/01-03-PLAN.md",".planning/phases/01-walking-skeleton/01-03-SUMMARY.md",".planning/phases/01-walking-skeleton/01-04-PLAN.md",".planning/phases/01-walking-skeleton/01-04-SUMMARY.md",".planning/phases/01-walking-skeleton/01-05-PLAN.md",".planning/phases/01-walking-skeleton/01-05-SUMMARY.md",".planning/phases/01-walking-skeleton/01-06-PLAN.md",".planning/phases/01-walking-skeleton/01-06-SUMMARY.md",".planning/phases/01-walking-skeleton/01-07-PLAN.md",".planning/phases/01-walking-skeleton/01-07-SUMMARY.md",".planning/phases/01-walking-skeleton/01-08-PLAN.md",".planning/phases/01-walking-skeleton/01-08-SUMMARY.md",".planning/phases/01-walking-skeleton/01-09-PLAN.md",".planning/phases/01-walking-skeleton/01-09-SUMMARY.md",".planning/phases/01-walking-skeleton/01-10-PLAN.md",".planning/phases/01-walking-skeleton/01-10-SUMMARY.md",".planning/phases/01-walking-skeleton/01-11-PLAN.md",".planning/phases/01-walking-skeleton/01-11-SUMMARY.md",".planning/phases/01-walking-skeleton/01-12-PLAN.md",".planning/phases/01-walking-skeleton/01-12-SUMMARY.md",".planning/phases/01-walking-skeleton/01-13-PLAN.md",".planning/phases/01-walking-skeleton/01-13-SUMMARY.md",".planning/phases/01-walking-skeleton/01-14-PLAN.md",".planning/phases/01-walking-skeleton/01-14-SUMMARY.md",".planning/phases/01-walking-skeleton/01-15-PLAN.md",".planning/phases/01-walking-skeleton/01-15-SUMMARY.md",".planning/phases/01-walking-skeleton/01-16-PLAN.md",".planning/phases/01-walking-skeleton/01-16-SUMMARY.md",".planning/phases/01-walking-skeleton/01-17-PLAN.md",".planning/phases/01-walking-skeleton/01-17-SUMMARY.md",".planning/phases/01-walking-skeleton/01-18-PLAN.md",".planning/phases/01-walking-skeleton/01-18-SUMMARY.md",".planning/phases/01-walking-skeleton/01-19-PLAN.md",".planning/phases/01-walking-skeleton/01-19-SUMMARY.md","design/tokens.json","index.html","package.json","public/og.png","scripts/make-og.mjs","shared/game/room.ts","src/components/ConfirmSheet.tsx","src/components/NicknameSheet.tsx","src/components/ShareSheet.tsx","src/components/Sheet.tsx","src/debug/sheetDebug.ts","src/debug/sheetProbe.ts","src/main.tsx","src/net/linkReducer.ts","src/net/useRoomConnection.ts","src/screens/Home.tsx","src/screens/JoinByLink.tsx","src/screens/Lobby.tsx","src/styles/ds.css","src/styles/lobby.css","src/styles/sheet.css","src/styles/tokens.css","test/client/app.test.tsx","test/client/entryContrast.test.tsx","test/client/joinByLink.test.tsx","test/client/lobby.test.tsx","test/client/phaseScreens.test.tsx","test/client/screens.test.tsx","test/client/sheet.test.tsx","test/client/sheetDebug.test.tsx","test/client/useRoomConnection.test.tsx","test/unit/gameRoom.test.ts","test/unit/linkReducer.test.ts","test/worker/alarm.test.ts","test/worker/helpers.ts","vite.config.ts","worker/room.ts"]
covered_digest: "v3:sha256:357d0360338a418370278df85874fbdcccd8b28eb2725fade9a22ce745058a42"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "5/5 로드맵 성공 기준 코드 검증, UAT 사용자 합의 truth 4건 열림"
  gaps_closed:
    - "G-01-9 (시트 진입 모션): e581bd8 로 .mf-dialog overflow: clip. 사용자 실기기 확인(2026-10-24)으로 닫힘"
    - "G-01-1a (폰트): 결정 0013, Gowun Dodum. 사용자 확인"
    - "G-01-2 (원형 테이블): 결정 0013, 크림 대리석 테이블. 사용자 확인"
    - "G-01-5 (OG 이미지): 결정 0013, public/og.png 재생성. 카카오 미리보기 재확인은 캐시 만료 뒤"
    - "G-01-1b (글자 대비): 사용자 눈 확인 통과(2026-10-23)"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
---

# Phase 1: 걷는 뼈대 검증 보고서 (재검증, UAT 갭 4건 닫힘 이후)

**Phase Goal:** As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다. (Mode: mvp)
**Verified:** 2026-10-24
**Status:** passed
**Re-verification:** 예 — 이전 상태 gaps_found(2026-10-23T11:00Z) 이후 e581bd8, 결정 0013, 결정 0014, WR-01~06 수정 반영

## 한 줄 요약

로드맵 성공 기준 5개와 요구사항 8개가 코드와 배포본에서 성립한다. 전체 테스트 42파일 675개와 타입 검사가 통과했고, 배포본(`e92e932`)에서 `smoke.mjs --prod --stage full` 이 통과했다(단 첫 시도 한 번이 POST /api/rooms 500 으로 실패, 아래 '주의' 참조). 이전에 열려 있던 갭 4건은 모두 닫혔다. 서버가 규칙과 판정을 정하고, 남의 역할과 토큰은 어떤 프레임·HTTP 응답에도 실리지 않는 구조를 코드와 누출 전수 테스트로 다시 확인했다. 비차단 항목(IN-01~09 INFO, 아티팩트 동기화 R18, 문서 정합, 실기기 잔여 관찰)은 아래 '비차단 항목'에 따로 적었다.

## 이번에 직접 확인한 것

| 확인 | 방법 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` (tokens:check, wrangler types, tsc 앱·워커) | 종료 코드 0 |
| 전체 테스트 | `npx vitest run` (한 번) | 42 files, 675 tests passed |
| 배포본 스모크 | `node scripts/smoke.mjs --prod --stage full` | 첫 시도 `SMOKE FAIL: POST /api/rooms 상태 500`. 이어서 3회 연속, 다시 3회 연속 `SMOKE OK full players=5` (낮 전환 편차 11~78ms, 버전 `…+e92e932`) |
| 방 만들기 반복 | `curl -X POST /api/rooms` 15회 | 15회 모두 201 |
| 배포본 버전 | `curl /api/health` | `2026-10-23T15:17:14Z+e92e932`. 로컬 HEAD `7de9346` 는 e92e932 뒤 문서 커밋만 추가 |
| 원격 동기 | `git ls-remote origin main` | `7de9346`, 로컬 HEAD 와 같음 (push 됨) |
| 부채 마커 | 변경 소스 파일 `TBD/FIXME/XXX/TODO/HACK` grep | 없음 |
| 이전 검증 이후 서버 쪽 변경 | `git diff 59caa32 HEAD -- worker shared` | `shared/nickname.ts`, `shared/game/room.ts`, `worker/room.ts` 3파일. 닉네임 키(01-15)와 WR-02·05·06 수정만. 역할 뷰·시계·단계 표 변경 없음 |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cloudflare 배포 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다 | VERIFIED | 배포본 `https://minifia.dhplay.workers.dev` 에서 full 스모크가 서로 다른 소켓 5명이 방 만들기·참가·시작·역할 수령까지 통과. UAT 10번에서 사용자가 폰 1 + PC 브라우저 3 으로 실제 한 판 확인 |
| 2 | 방장이 방을 만들면 4자리 코드와 참가 링크, 공유 버튼, 링크·코드로 닉네임만 입력해 대기실 진입 | VERIFIED | `worker/allocate.ts` + `handleCreateRoom`(201, code·token·seat), `handleJoin`, 비인증 `buildPreview`. 새 첫 화면(`Home.tsx` → `NicknameSheet` → `createRoom`/`joinRoom`)을 app.test 가 덮음. UAT 3·4·5번 pass |
| 3 | 4명 이상에서 시작하면 구성표대로 배정, 자기 카드만, 마피아는 동료도, 남의 역할은 네트워크에 없음 | VERIFIED | `shared/game/roles.ts` ROLE_TABLE(4~8명) 과 Fisher–Yates, `shared/game/view.ts` 허용 목록: `revealsOwnRole` 단계에서 `me.role` 만, 마피아에게만 동료 seat. `test/worker/leak.test.ts` 가 6명 한 판의 모든 소켓 프레임과 HTTP 응답에서 금지 키(token·id·playerId·connId·hostId 등)와 남의 역할을 검사하고 통과. 스모크 full 도 누출 전수 검사 포함 |
| 4 | 배정 약 3초, 역할 확인 15초, 같은 시각 낮 전환, 새로고침·재접속에도 같은 자리·역할 | VERIFIED | `shared/game/phases.ts` PHASE_DEFS(assigning→roleReveal→day), 서버 알람 `worker/room.ts`, `serverNow`·`phaseEndsAt` 로 클라이언트는 남은 시간만 표시. alarm/tick/reconnect/start 테스트 통과(단일 전체 실행에 포함). 스모크 낮 전환 편차 11~78ms. UAT 9번(잠금 2분 뒤 복귀)·10번(게임 중 두 번 재배포 후 같은 자리·역할) 사용자 확인 |
| 5 | 코드를 고치고 `wrangler deploy` 하면 주소는 그대로이고 새 버전이 보인다 | VERIFIED | 같은 주소가 이전 검증 때 `…+59caa32` 였고 지금 `…+e92e932`. UAT 10번에서 게임 중 재배포 2회 모두 같은 주소 유지 |
| P1 | 01-15: 보이지 않는 문자로 닉네임 비교 우회 불가 | VERIFIED | `shared/nickname.ts`, nickname/gameRoom/join 테스트 통과 |
| P2 | G-01-9: 폰에서 시트가 아래에서 올라와 그대로 멈춘다 | VERIFIED | `src/styles/sheet.css` 에 `.mf-dialog { overflow: clip }`(e581bd8). 실기기 패널 근거로 고쳤고 사용자가 폰에서 확인(UAT 9번 resolved_note) |
| P3 | G-01-1a/2/5: 폰트·테이블·OG | VERIFIED | `index.html` 의 Gowun Dodum 링크, `tokens.css` `--font-ui`, 크림 테이블 토큰, `public/og.png` 295KB 재생성, `og:image` 절대 주소. 사용자 확인 |
| P4 | 결정 0014: 첫 화면이 버튼+코드 칸, 닉네임은 시트 | VERIFIED | `Home.tsx`, `NicknameSheet.tsx`, app.test 통과. 이 브라우저에 입장 정보가 있으면 닉네임을 묻지 않고 복귀(D-07)도 `loadSession` 으로 유지 |
| P5 | WR-01~06 수정이 연결·방 수명 계층에서 동작 | VERIFIED | 커밋 9b89310·2b308f4·735ef3a·efdf811·6b298b5·aaf0228, 각 변경에 대응하는 테스트 추가(useRoomConnection·linkReducer·lobby·alarm·gameRoom), 전체 통과 |

**점수:** 로드맵 성공 기준 5/5, 플랜·UAT truth 전부 VERIFIED. PRESENT_BEHAVIOR_UNVERIFIED 0건(상태 전이·재접속 불변식은 reconnect/alarm/leak 테스트가 직접 실행).

### 역할 비누출·토큰 비누출 (결정 0002) 직접 확인

- `shared/game/view.ts`: `buildView` 는 공개 목록을 `{seat, nickname, connected, isHost}` 네 키 객체 리터럴로만 만들고, `me` 에는 `revealsOwnRole` 단계에서만 `role`(과 마피아의 `allies` seat)을 넣는다. `buildPreview` 도 `{seat, nickname}` 허용 목록이고 대기실이 아닐 때는 빈 배열.
- `worker/room.ts`: 모든 상태 전송은 `broadcast()` 에서 연결별 `buildView(room, att.playerId, now)` 로만 나간다. 토큰은 `createRoom`·`join` 의 HTTP 응답 본인 몫으로만 나가고, WebSocket 은 첫 `hello` 메시지로 토큰을 받으므로 주소(로그)에 토큰이 실리지 않는다. 서버 로그는 `console.error("room alarm failed", err.name)` 한 곳이고 토큰·역할을 찍지 않는다.
- 클라이언트의 `sheetdebug` 계측(`src/debug/*`)은 `?sheetdebug=1` 일 때만 지연 로드되며 네트워크 호출이 없다.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/game/view.ts` | 허용 목록 뷰 | VERIFIED | 위 확인 |
| `shared/game/roles.ts` | 구성표·배정 | VERIFIED | 4~8명 표, 중복 id·잘못된 난수 거부 |
| `shared/game/phases.ts` | 단계 표 | VERIFIED | 3초·15초·낮 |
| `worker/room.ts`, `worker/allocate.ts`, `worker/index.ts` | Room DO·라우트 | VERIFIED | 실제 DO 저장소·알람·소켓 배선, 코드 충돌 재시도 8회 |
| `src/screens/Home.tsx`, `src/components/NicknameSheet.tsx` | 새 첫 화면 | VERIFIED | `createRoom`/`joinRoom` 호출과 오류 분기에 연결 |
| `src/components/Sheet.tsx`, `src/styles/sheet.css` | 시트 | VERIFIED | WIRED, 실기기 확인 |
| `public/og.png`, `index.html` OG 메타 | 링크 미리보기 | VERIFIED | 절대 주소, 1200×630 |
| `design/tokens.json` → `src/styles/tokens.css` | 토큰 | VERIFIED | `tokens:check` 가 typecheck 안에서 통과 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `worker/room.ts` broadcast | `shared/game/view.ts` buildView | 연결별 playerId | WIRED | 직접 읽어 확인, leak.test |
| `worker/index.ts` | `worker/allocate.ts` → Room DO | `env.ROOM.getByName(code)` | WIRED | 스모크 201 |
| `Home.tsx` | `net/api.ts` → `/api/rooms` | NicknameSheet 제출 | WIRED | app.test |
| `Sheet.tsx` | `sheet.css` | `mf-dialog--open` | WIRED | sheet.test |
| `tokens.json` | `tokens.css` | `npm run tokens` | WIRED | tokens:check |

### Data-Flow Trace (Level 4)

역할 데이터: 서버 `assignRoles`(cryptoRandInt) → 저장된 `RoomState.players[].role` → `buildView` 허용 목록 → 본인 소켓 `state` 프레임 → `RoleCard`. 정적 반환·하드코딩 없음. 시계: 서버 `serverNow` + 핑 표본 오프셋 → 카운트다운(WR-04 로 첫 pong 전에도 state 의 serverNow 사용).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 테스트 | `npx vitest run` | 42 files, 675 passed | PASS |
| 타입·토큰 | `npm run typecheck` | exit 0 | PASS |
| 배포본 한 판 | `node scripts/smoke.mjs --prod --stage full` | 첫 시도 500, 이후 6회 OK | PASS (간헐 실패 1건, 비차단 항목 참조) |
| 방 만들기 반복 | curl 15회 | 201 ×15 | PASS |

### Probe Execution

SKIPPED. 선언된 `probe-*.sh` 없음.

### Requirements Coverage

PLAN 이 선언한 ID: ROOM-01, ROOM-02, ROOM-03, CONN-01, DEPLOY-01, GAME-01, ROLE-01, ROLE-02. REQUIREMENTS.md 의 Phase 1 매핑과 같고 ORPHANED 없음.

| Requirement | 판정 | 근거 |
| --- | --- | --- |
| ROOM-01 | SATISFIED | 방 만들기 201·링크·공유 시트, UAT 4번 사용자 통과 |
| ROOM-02 | SATISFIED | 링크·코드 참가, 닉네임 키 규칙, UAT 3번 |
| ROOM-03 | SATISFIED | 4~8명, 연결자 4명 이상 시작(결정 0012), 8명이면 ROOM_FULL |
| CONN-01 | SATISFIED | reconnect 테스트, UAT 9·10번 |
| DEPLOY-01 | SATISFIED | 고정 주소 재배포, 버전 변경 확인 |
| GAME-01 | SATISFIED | 서버 단계 표·알람·마감 시각 |
| ROLE-01 | SATISFIED | ROLE_TABLE 서버 한 곳 |
| ROLE-02 | SATISFIED | view.ts 허용 목록, leak.test 전수 검사 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 변경 소스 파일 | - | `TBD/FIXME/XXX/TODO/HACK` | 없음 | - |

### Human Verification Required

없음. 사용자가 실기기·배포본에서 직접 확인한 UAT 11건이 모두 pass 다. 아래 비차단 항목의 '실기기 잔여 관찰'은 자동 확인으로 통과했고 사용자 UAT 에서도 문제가 보고되지 않은 것으로, 게이트가 아니라 모니터링 대상이다.

### Gaps Summary

닫을 갭 없음.

## 비차단 항목

### 주의 (다음 배포·2페이즈 전에 보면 좋음)

1. **배포본 POST /api/rooms 간헐 500 한 건.** 이번 검증 첫 스모크 시도가 `POST /api/rooms 상태 500` 으로 실패했다. 이어진 스모크 6회와 curl 15회는 모두 성공해 재현하지 못했고 원인은 모른다(worker 코드 경로 `allocateRoom` → `createRoom` 에서 던질 만한 곳을 읽었으나 확정 못 함. 방이 한동안 놀다 처음 부르는 콜드 스타트나 Cloudflare 쪽 일시 오류 가능성). 클라이언트는 비정상 응답을 `NETWORK` 오류로 받아 재시도 가능한 오류 문구를 보인다. 간헐이 다시 보이면 `npx wrangler tail` 로 원인을 잡는다. 이 항목 때문에 상태를 낮추지 않은 이유: 로드맵 기준은 반복 시험에서 성립하고, 재현이 없으며, 사용자 UAT 에서 보고된 적이 없다.
2. **IN-01~IN-09 (01-REVIEW.md INFO) 모두 open.** IN-01 hello 안 한 소켓 수명 제한 없음, IN-02 청크 전송 본문 상한 미적용, IN-03 방에서 빠진 플레이어의 소켓 메시지가 예외, IN-04 저장 상태 검증 없이 사용, IN-05 입장 정보 한 칸, IN-06 도메인 하드코딩·보안 헤더 없음, IN-07 ZWJ 리터럴(01-15 로 닉네임 쪽은 처리), IN-08 클라이언트가 서버 error 프레임을 버림, IN-09 알람 실패 시 1초 재시도 무한. 로드맵 성공 기준을 깨지 않는다. IN-03·IN-09 는 첫 항목의 500 과 연관될 가능성이 낮지만 같은 방 DO 경로라 함께 보는 것이 좋다.
3. **외부 폰트 의존.** `index.html` 이 Google Fonts(`fonts.googleapis.com`)에서 Gowun Dodum 을 받는다. `display=swap` 과 시스템 한글 폰트 대체가 있어 실패해도 동작하지만 대체 글꼴이 먼저 보이다 바뀌는 순간 글자 폭이 달라진다. 정식 출시 마일스톤에서 자체 호스팅을 검토한다.

### 문서 정합 (갱신 필요, 코드와 무관)

- `HANDOFF.md` 현재 상태가 아직 "검증 gaps_found, G-01-9 재진단 필요" 와 "배포본은 옛 버전 59caa32" 로 적혀 있다. 지금은 모든 갭이 닫혔고 배포본은 `e92e932`.
- `.planning/REQUIREMENTS.md` Traceability 가 ROOM-02 만 Complete 이고 나머지 7개가 Pending, 체크박스도 ROOM-02 만 `[x]`. 이 검증은 갱신하지 않았다.
- `.planning/ROADMAP.md` 1페이즈 진행(16/19)과 01-16·01-18·01-19 체크박스 `[ ]` 가 현재(01-16 은 해결, 01-18 완료, 01-19 대체)와 어긋난다.
- `01-REVIEW-DISPOSITION.md` 의 CR-01 이 `open` 으로 남아 있으나 01-15 로 닫혔다.
- 결정 0013 과 0014 로 바뀐 화면(영문 Minifia, 크림 테이블, 닉네임 시트)은 아직 디자인 시스템·화면설계서 아티팩트에 반영되지 않았다.

### 디자인 아티팩트 동기화 (R18)

디자인 시스템 아티팩트에 아직 없는 것: "방장" 배지, 내 역할 시트, 공유 시트, 토스트, 52px 재접속 띠, 닉네임 시트, 모션 길이(220·240·300·320ms, 배정 링 1s)를 토큰으로 올릴지 여부. 아티팩트는 클로드 데스크톱 세션 몫(결정 0010·0011)이라 코드 페이즈를 막지 않는다.

### 8인 · 360×640 폰 레이아웃 (CSS 로 추론)

- 대기실 `.mf-lobby` 는 `height:100%`, `overflow:hidden`, 테이블 `height:100%; width:auto; max-width:100%`. 이름표는 `max-width: 96px`(뒷줄 72px)로 폭이 고정이라 폰트를 바꿔도 8인 배치의 가로·세로 크기는 변하지 않는다. 폰트 크기 토큰은 결정 0013 에서 그대로 두었다(글자만 바뀜).
- 글리프 폭이 시스템 고딕과 달라질 수 있으나(실측하지 않음) 이름표 폭이 고정이라 이름이 길면 잘릴 뿐 겹치지는 않는다고 추론한다. 사용자가 대기실·첫 화면을 폰으로 확인한 UAT 2번 재확인(크림 테이블 포함)에서 문제를 보고하지 않았다.
- 입장 화면 `.mf-entry` 는 `min-height:100dvh` 로 높이를 고정하지 않아 키패드가 올라와도 스크롤된다. 영문 제목에 `-webkit-text-stroke 2px` 가 들어가므로 아주 작은 화면에서 제목 폭은 한 줄을 유지한다(`Minifia` 7글자).
- 360×640 에서 8인·역할 설명 세 줄 이내(A15)를 Playwright 로 확인한 것은 폰트 교체 이전이다. 폰트 교체 뒤 같은 자동 재확인은 이번에 하지 않았다(변경이 글리프뿐이라 위험 낮음).

### 실기기 잔여 관찰 (게이트 아님)

- 여러 폰 동시 낮 전환(A1): 자동 11~78ms, 이전 배포본 스모크 467ms 한 번(상한 500ms). 실기기 시계 오프셋 편차는 자동 시험이 같은 PC 시계라 반영되지 않았다.
- 단절 직후 띠가 뜨기까지 약 10초(UAT 8번 노트), 느린 망 체감(UAT 11번).
- WR-01~06 은 UAT 통과 뒤에 고쳤으므로 연결 계층 수정의 폰 확인은 테스트만으로 되어 있다.

---

_Verified: 2026-10-24_
_Verifier: Claude (gsd-verifier)_
