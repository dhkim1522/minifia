---
phase: 01-walking-skeleton
verified: 2026-10-30T02:30:00Z
status: passed
score: 10/10 must-haves verified (로드맵 성공 기준 5/5 + 플랜·UAT truth 5/5)
covered_files: [".planning/phases/01-walking-skeleton/01-01-PLAN.md",".planning/phases/01-walking-skeleton/01-01-SUMMARY.md",".planning/phases/01-walking-skeleton/01-02-PLAN.md",".planning/phases/01-walking-skeleton/01-02-SUMMARY.md",".planning/phases/01-walking-skeleton/01-03-PLAN.md",".planning/phases/01-walking-skeleton/01-03-SUMMARY.md",".planning/phases/01-walking-skeleton/01-04-PLAN.md",".planning/phases/01-walking-skeleton/01-04-SUMMARY.md",".planning/phases/01-walking-skeleton/01-05-PLAN.md",".planning/phases/01-walking-skeleton/01-05-SUMMARY.md",".planning/phases/01-walking-skeleton/01-06-PLAN.md",".planning/phases/01-walking-skeleton/01-06-SUMMARY.md",".planning/phases/01-walking-skeleton/01-07-PLAN.md",".planning/phases/01-walking-skeleton/01-07-SUMMARY.md",".planning/phases/01-walking-skeleton/01-08-PLAN.md",".planning/phases/01-walking-skeleton/01-08-SUMMARY.md",".planning/phases/01-walking-skeleton/01-09-PLAN.md",".planning/phases/01-walking-skeleton/01-09-SUMMARY.md",".planning/phases/01-walking-skeleton/01-10-PLAN.md",".planning/phases/01-walking-skeleton/01-10-SUMMARY.md",".planning/phases/01-walking-skeleton/01-11-PLAN.md",".planning/phases/01-walking-skeleton/01-11-SUMMARY.md",".planning/phases/01-walking-skeleton/01-12-PLAN.md",".planning/phases/01-walking-skeleton/01-12-SUMMARY.md",".planning/phases/01-walking-skeleton/01-13-PLAN.md",".planning/phases/01-walking-skeleton/01-13-SUMMARY.md",".planning/phases/01-walking-skeleton/01-14-PLAN.md",".planning/phases/01-walking-skeleton/01-14-SUMMARY.md",".planning/phases/01-walking-skeleton/01-15-PLAN.md",".planning/phases/01-walking-skeleton/01-15-SUMMARY.md",".planning/phases/01-walking-skeleton/01-16-PLAN.md",".planning/phases/01-walking-skeleton/01-16-SUMMARY.md",".planning/phases/01-walking-skeleton/01-17-PLAN.md",".planning/phases/01-walking-skeleton/01-17-SUMMARY.md",".planning/phases/01-walking-skeleton/01-18-PLAN.md",".planning/phases/01-walking-skeleton/01-18-SUMMARY.md",".planning/phases/01-walking-skeleton/01-19-PLAN.md",".planning/phases/01-walking-skeleton/01-19-SUMMARY.md","design/tokens.json","index.html","package.json","public/og.png","scripts/make-og.mjs","shared/game/phases.ts","shared/game/roles.ts","shared/game/room.ts","shared/game/tick.ts","shared/game/view.ts","shared/nickname.ts","shared/protocol.ts","shared/roomCode.ts","src/components/ConfirmSheet.tsx","src/components/DayTable.tsx","src/components/NicknameSheet.tsx","src/components/RoleCardSheet.tsx","src/components/ShareSheet.tsx","src/components/Sheet.tsx","src/main.tsx","src/net/linkReducer.ts","src/net/session.ts","src/net/share.ts","src/net/useRoomConnection.ts","src/screens/Home.tsx","src/screens/JoinByLink.tsx","src/screens/Lobby.tsx","src/screens/RoomScreen.tsx","src/styles/ds.css","src/styles/lobby.css","src/styles/sheet.css","src/styles/tokens.css","test/client/app.test.tsx","test/client/entryContrast.test.tsx","test/client/joinByLink.test.tsx","test/client/lobby.test.tsx","test/client/phaseScreens.test.tsx","test/client/screens.test.tsx","test/client/sheet.test.tsx","test/client/useRoomConnection.test.tsx","test/unit/gameRoom.test.ts","test/unit/linkReducer.test.ts","test/unit/nickname.test.ts","test/unit/roles.test.ts","test/unit/view.test.ts","test/worker/alarm.test.ts","test/worker/helpers.ts","test/worker/leak.test.ts","test/worker/reconnect.test.ts","test/worker/start.test.ts","worker/allocate.ts","worker/index.ts","worker/room.ts","wrangler.jsonc"]
covered_digest: "v3:sha256:a6e5b815af5fbdee59a3ed4ced3e7a52f4b59b0f07a6deb5ea9e039648589621"
behavior_unverified: 0
overrides_applied: 0
human_verification_approved:
  approved_by: "사용자(dhkim1522)"
  approved_at: "2026-10-30"
  scope: "실기기 확인 항목 전부 (01-UAT.md 11건 complete, 이후 페이즈의 실기기 확인과 함께 승인)"
  note: "검증자는 기기를 보지 못했다. 사용자가 실기기에서 확인했고 승인했다는 기록을 받아 적었다."
re_verification:
  previous_status: passed
  previous_score: "5/5 로드맵 성공 기준, 이전 열린 갭 4건 모두 닫힘, UAT 11/11 (2026-10-24, 배포본 e92e932)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  reason: "이전 보고서 이후 2~5페이즈와 결정 0013·0014·0017·0021·0026·0028~0033 이 덮은 파일(폰트·첫 화면·고정 테이블·역할 카드 시트·실내 배경·방장 배지 등 23개)을 바꿔 digest 가 stale 이 됐다. 현재 코드로 다시 확인했다."
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
---

# Phase 1: 걷는 뼈대 검증 보고서 (재검증, 2~5페이즈 이후 현재 코드 기준)

**Phase Goal:** As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다. (Mode: mvp)
**Verified:** 2026-10-30
**Status:** passed
**Re-verification:** 예 — 이전 상태 passed(2026-10-24)였으나 뒤 페이즈가 덮은 파일을 바꿔 stale. 현재 HEAD `8153b1a` 와 배포본 `cb6979c` 로 다시 확인했다.

## 한 줄 요약

로드맵 성공 기준 5개와 요구사항 8개가 현재 코드와 배포본에서 모두 성립한다. 전체 테스트 117파일 3094개와 `npm run typecheck` 가 통과했고, 배포본(`2026-10-29T14:52:03Z+cb6979c`)의 full 스모크는 세 번 중 두 번 통과했다. 실패한 한 번은 1페이즈 구간(방 만들기·참가·시작·역할 수령·낮 전환)을 모두 지난 뒤 3페이즈 구간(밤 → 아침)에서 났다. 이전 보고서 문구 중 뒤 페이즈 결정이 명시적으로 바꾼 것은 갭이 아니라 '대체됨'으로 센다(아래 표). 열린 갭 없음.

## 이번에 직접 확인한 것

| 확인 | 방법 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` (tokens:check, wrangler types, tsc 앱·워커) | 종료 코드 0 |
| 전체 테스트 | `npx vitest run` (한 번) | 117 files, 3094 tests passed, 종료 코드 0 |
| 배포본 버전 | `curl /api/health` | `{"ok":true,"version":"2026-10-29T14:52:03Z+cb6979c"}` |
| 배포본 = 현재 소스 | `git diff --stat cb6979c HEAD -- worker shared src index.html public wrangler.jsonc` | 차이 없음 (이후 커밋은 문서·테스트뿐) |
| 배포본 한 판 (1회차) | `node scripts/smoke.mjs --prod --stage full` | 낮 토론·여부 투표(미통과 → 밤)까지 통과 후 `SMOKE FAIL: 밤 마감 뒤 morning 이 모든 클라이언트에 오지 않음 (40초 제한 초과)` |
| 배포본 한 판 (2회차) | 같은 명령 | `SMOKE OK full code=0388 players=5 spread=13ms discSpread=11ms` |
| 배포본 한 판 (3회차) | 같은 명령 | `SMOKE OK full code=3703 players=5 spread=4ms discSpread=8ms` |
| 부채 마커 | `worker shared src index.html scripts/make-og.mjs` 에서 `TBD/FIXME/XXX/TODO/HACK` grep | 없음 |
| `dangerouslySetInnerHTML` | `src` grep | 0건 |
| 작업 트리 | `git status` | 구현 파일 변경 없음 (`.planning/` 문서만 수정 상태, 이 검증은 구현 파일을 건드리지 않음) |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cloudflare 배포 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다 | VERIFIED | `https://minifia.dhplay.workers.dev` 가 현재 소스 버전(`cb6979c`)이다. 스모크 full 이 서로 다른 소켓 5개로 방 만들기 → 참가 → 시작 → 역할 수령을 두 번 통과(입장 편차 아래 참고). 사용자 UAT 10번이 폰 1 + PC 3 으로 실제 한 판을 확인 |
| 2 | 방장이 방을 만들면 4자리 코드와 참가 링크, 공유 버튼, 링크·코드로 닉네임만 입력해 대기실 진입 | VERIFIED | `worker/index.ts` `handleCreateRoom`(201, code·token·seat)·`handleJoin`·`handlePreview`, `worker/allocate.ts`(코드 충돌 8회 재시도). 클라이언트 `Home.tsx`(코드 칸 + [방 만들기] → `NicknameSheet` → `createRoom`/`joinRoom`), `JoinByLink.tsx`(미리보기 + 닉네임), `ShareSheet.tsx`·`src/net/share.ts`(Web Share, 없으면 `clipboard.writeText`). 해당 클라이언트 테스트(app·joinByLink·lobby·sheet·screens) 통과 |
| 3 | 4명 이상에서 시작하면 구성표대로 배정, 자기 카드만, 마피아는 동료도, 남의 역할은 네트워크에 없음 | VERIFIED | `shared/game/roles.ts` `ROLE_TABLE`(4:1·1·0·2 / 5:1·1·1·2 / 6:2·1·1·2 / 7:2·1·1·3 / 8:2·1·1·4)와 Fisher–Yates + 주입 난수 범위 검사. `shared/game/view.ts` 는 `PHASE_DEFS[phase].revealsOwnRole` 일 때만 `me.role`, 마피아에게만 `me.allies`(동료 seat). 공개 목록은 `{seat,nickname,connected,isHost,alive}` 객체 리터럴. `test/worker/leak.test.ts` 가 실제 workerd 에서 6명 한 판 전체의 모든 소켓 프레임·HTTP 응답에서 금지 키와 남의 역할을 검사해 통과. 스모크 full 도 같은 검사를 한다 |
| 4 | 배정 약 3초, 역할 확인 15초, 같은 시각 낮 전환, 새로고침·재접속에도 같은 자리·역할 | VERIFIED | `shared/game/phases.ts` `ASSIGNING_MS=3000`·`ROLE_REVEAL_MS=15000`, `assigning → roleReveal → dayAnnounce`("낮이 되었습니다"). 서버 알람(`worker/room.ts` `setAlarm`)이 단계를 넘기고 클라이언트는 `phaseEndsAt`·`serverNow`·핑 오프셋(`src/net/clock.ts`)으로 남은 시간만 그린다. `reconnect.test.ts`·`alarm.test.ts`·`start.test.ts`·`useRoomConnection.test.tsx`·`linkReducer.test.ts` 통과. 스모크 낮 전환 편차 4~13ms(2회). 사용자 UAT 9번(잠금 2분 뒤 복귀)·10번(게임 중 두 번 재배포 후 같은 자리·역할) |
| 5 | 코드를 고치고 `wrangler deploy` 하면 주소는 그대로이고 새 버전이 보인다 | VERIFIED | 같은 주소가 이전 검증 때 `…+e92e932` 였고 지금 `…+cb6979c`. `wrangler.jsonc` 에 `account_id` 없이 이름 `minifia` 고정, DO 마이그레이션 선언. 이후 모든 페이즈 배포가 같은 주소로 이루어졌다 |
| P1 | 01-15: 보이지 않는 문자로 닉네임 비교 우회 불가 | VERIFIED | `shared/nickname.ts`(비교 키에서 ZWJ·변형 선택자·결합 문자 제외, 채움 문자·빈 키 거부), `test/unit/nickname.test.ts`·`gameRoom.test.ts`·`join.test.ts` 통과 |
| P2 | G-01-9: 폰에서 시트가 아래에서 올라와 그대로 멈춘다 | VERIFIED | `src/styles/sheet.css` 14행 `overflow: hidden; overflow: clip;`(e581bd8)이 현재도 있다. `Sheet.tsx` 는 이후 `className` prop 만 추가됐다(시트별 높이). 사용자가 폰에서 확인(UAT 9번 resolved_note) |
| P3 | G-01-1a/2/5: 폰트·테이블·OG | VERIFIED | `index.html` Gowun Dodum 링크, `tokens.css` `--font-ui`, `og:image` 절대 주소(1200×630), `public/og.png` 296KB, `scripts/make-og.mjs` 는 원본 배경(`design/backgrounds/A_cute`)에서 재생성. 테이블은 크림 대리석 계열 에셋이 `src/net/assets.ts` 의 `table` 디렉터리 그림으로 남아 있다. 사용자 확인 |
| P4 | 결정 0014: 첫 화면이 버튼 + 코드 칸, 닉네임은 시트 | VERIFIED | `Home.tsx` 가 코드 칸·[참가]·[방 만들기]만 두고 `NicknameSheet` 를 시트로 연다. 이 브라우저에 그 방의 입장 정보가 있으면 닉네임을 묻지 않고 복귀(D-07, `loadSession`). `app.test.tsx`·`screens.test.tsx` 통과 |
| P5 | WR-01~06 수정이 연결·방 수명 계층에서 동작 | VERIFIED | `useRoomConnection.ts`·`linkReducer.ts`·`worker/room.ts` 알람·만료 경로가 그대로 있고(이후 `onEvent` 구독만 추가: 이모티콘·채팅·오류 프레임을 상태 렌더 밖으로 흘림), `useRoomConnection.test.tsx`·`linkReducer.test.ts`·`alarm.test.ts`·`lobby.test.tsx` 통과 |

**점수:** 10/10 (로드맵 성공 기준 5/5, 플랜·UAT truth 5/5). PRESENT_BEHAVIOR_UNVERIFIED 0건 — 상태 전이·재접속·누출 불변식은 reconnect·alarm·leak 테스트가 직접 실행한다.

### 뒤 페이즈 결정으로 대체된 문구 (갭 아님)

이전 보고서와 1페이즈 문서에 남은 아래 문구는 뒤 결정이 명시적으로 바꿨다. 현재 동작이 새 결정과 맞는지만 확인했다.

| 1페이즈 당시 문구 | 대체한 결정 | 현재 코드에서 확인한 것 |
| --- | --- | --- |
| 닉네임 1~8자 | 0017-4 (고정 테이블 이름표를 말줄임 없이 보이려고 5자) | `NICKNAME_MAX_GRAPHEMES = 5`(`nickname.test.ts` 가 5 를 고정), `JoinByLink.tsx` placeholder `1~5자로 입력` |
| 원근 테이블 `Table` · `shared/seatLayout.ts` | 0017·0028 (고정 `DayTable`, 대기실도 같은 테이블·장면 상자) | `Table.tsx`·`seatLayout.ts` 삭제됨, `Lobby.tsx` 가 `<DayTable slide hostCrown />` 사용 |
| 배경 `variant="lobby"`, SVG 배경 | 0029~0033 (실내 배경 v4, 후광, 층 전환) | `Backdrop scene="lobby"`, `public/backgrounds/*.webp`, `ds.css` 의 `data-state` 층 전환 |
| 내 역할 시트(C-01) | 0026 (역할 카드 + 역할별 일지, 탭형 시트) | `RoleCardButton`·`RoleCardSheet` 가 `RoomScreen` 에 연결 |
| 방장 표시가 항상 보임 | 0030-3·0031-7 (방장 왕관 배지는 대기실에서만) | `Lobby` 만 `hostCrown` 을 준다 |
| 역할 확인 다음 "낮" 화면에서 멈춤 (`roleReveal → day`) | 0007·0023·0034 (낮 시작 발표 → 직업 주장 → 토론 → 투표 → 밤 …) | `PHASE_DEFS` 가 `roleReveal → dayAnnounce` 로 이어지고 이후 단계가 같은 표에 얹혔다. REQUIREMENTS.md GAME-01 문장도 이미 개정됨 |
| 공개 플레이어 항목 4키 `{seat,nickname,connected,isHost}` | 0021 (탈락자 관전) 의 `alive` 추가 | 5키 객체 리터럴 유지, 펼쳐 복사 없음. `view.test.ts` 가 고정. 허용 목록 원칙은 그대로 |
| `revealsOwnRole` 은 역할 확인 단계 | 뒤 페이즈 단계 전부로 확장 | `me.role` 은 여전히 본인 것만, `allies` 는 마피아에게만. 남의 직업은 탈락한 본인에게만 `spectate`(결정 0021) |

### 역할 비누출·토큰 비누출 (결정 0002) 직접 확인

- `shared/game/view.ts`: 공개 목록과 `me` 모두 허용 목록 리터럴로 만든다. 남의 `role` 은 어떤 키로도 나가지 않는다. 직업 키 이름은 `me` 밖에서 `job`(관전·결과 전용)이고 `leak.test.ts` 가 그 규칙을 검사한다. 서버 전용 필드(`claimOrder`·`nightLog` 등)는 view 에 없다.
- `worker/room.ts` `broadcast()` 는 연결별 `buildView(room, att.playerId, now)` 로만 보낸다. 토큰은 `createRoom`·`join` 의 HTTP 응답 본인 몫과 WebSocket 첫 `hello` 본문으로만 오가고 주소에는 실리지 않는다.
- 비인증 `buildPreview` 는 `{seat,nickname}` 만, 대기실이 아닐 때는 빈 배열.
- `shared/` 에 `Math.random` 없음, 서버 난수는 `worker/random.ts` `cryptoRandInt`.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/game/view.ts` | 허용 목록 뷰 | VERIFIED | 위 확인, `view.test.ts` |
| `shared/game/roles.ts` | 구성표·배정 | VERIFIED | 4~8명 표, 범위·중복 거부, `roles.test.ts` |
| `shared/game/phases.ts` | 단계 표 | VERIFIED | 3초·15초, 이후 단계가 같은 표에 얹힘 |
| `worker/room.ts`, `worker/allocate.ts`, `worker/index.ts` | Room DO·라우트 | VERIFIED | 실제 DO 저장소·알람·소켓 배선, `env.ROOM.getByName(code)` |
| `src/screens/Home.tsx`, `src/components/NicknameSheet.tsx` | 첫 화면 | VERIFIED | `createRoom`/`joinRoom` 과 오류 분기에 연결 |
| `src/screens/JoinByLink.tsx` | 링크 참가 | VERIFIED | 미리보기 폴링, 5명 이상이면 광장 축소(05, 0038) |
| `src/screens/Lobby.tsx`, `src/components/DayTable.tsx` | 대기실 | VERIFIED | 서버 view 만으로 그림, 연결자 기준 시작 |
| `src/components/Sheet.tsx`, `src/styles/sheet.css` | 시트 | VERIFIED | `overflow: clip` 유지, `sheet.test.tsx` |
| `src/components/RoleCardSheet.tsx` | 내 역할 | VERIFIED | `RoomScreen` 에 연결, `roleCardSheet.test.tsx` |
| `public/og.png`, `index.html` OG 메타 | 링크 미리보기 | VERIFIED | 절대 주소, 1200×630 |
| `design/tokens.json` → `src/styles/tokens.css` | 토큰 | VERIFIED | `tokens:check` 가 typecheck 안에서 통과 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `worker/room.ts` broadcast | `shared/game/view.ts` buildView | 연결별 playerId | WIRED | 직접 읽어 확인, `leak.test.ts` |
| `worker/index.ts` | `worker/allocate.ts` → Room DO | `env.ROOM.getByName(code)` | WIRED | 스모크 201 |
| `Home.tsx` | `net/api.ts` → `/api/rooms` | `NicknameSheet` 제출 | WIRED | `app.test.tsx` |
| `Lobby.tsx` | `DayTable.tsx` | 서버 view 의 `players` | WIRED | `lobby.test.tsx` |
| `RoomScreen.tsx` | `RoleCardSheet.tsx` | `RoleCardButton` | WIRED | `roleCardFlow.test.tsx` |
| `Sheet.tsx` | `sheet.css` | `mf-dialog--open` | WIRED | `sheet.test.tsx` |
| `tokens.json` | `tokens.css` | `npm run tokens` | WIRED | `tokens:check` |

### Data-Flow Trace (Level 4)

역할 데이터: 서버 `assignRoles`(`cryptoRandInt`) → 저장 `RoomState.players[].role` → `buildView` 허용 목록 → 본인 소켓 `state` 프레임 → 역할 카드. 정적 반환·하드코딩 없음. 시계: 서버 `serverNow` + 핑 표본 오프셋 → 카운트다운. 대기실 좌석: 서버 `players` → `DayTable` 좌석 (하드코딩 빈 prop 없음).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 테스트 | `npx vitest run` | 117 files, 3094 passed | PASS |
| 타입·토큰 | `npm run typecheck` | exit 0 | PASS |
| 배포본 버전 | `curl /api/health` | `…+cb6979c` | PASS |
| 배포본 한 판 | `smoke.mjs --prod --stage full` ×3 | 2 OK, 1 FAIL(밤 → 아침 구간) | PASS (간헐 실패 1건, 아래 주의 참조) |

### Probe Execution

SKIPPED. 선언된 `probe-*.sh` 없음.

### Requirements Coverage

PLAN 이 선언한 ID: ROOM-01, ROOM-02, ROOM-03, CONN-01, DEPLOY-01, GAME-01, ROLE-01, ROLE-02. REQUIREMENTS.md 의 Phase 1 매핑(8개, 모두 `[x]`·Complete)과 같고 ORPHANED 없음.

| Requirement | 판정 | 근거 |
| --- | --- | --- |
| ROOM-01 | SATISFIED | 방 만들기 201·링크·`ShareSheet`(Web Share/복사), UAT 4번 |
| ROOM-02 | SATISFIED | 링크·코드 참가, 닉네임 키 규칙, UAT 3번 |
| ROOM-03 | SATISFIED | `MIN_PLAYERS=4`·`MAX_PLAYERS=8`, `checkStart` 가 연결자 4명 이상(결정 0012), 정원 시 `ROOM_FULL` |
| CONN-01 | SATISFIED | `session.ts` 토큰 저장, `hello` 재접속, `reconnect.test.ts`, UAT 9·10번 |
| DEPLOY-01 | SATISFIED | 고정 주소 재배포, 버전 변경 확인 |
| GAME-01 | SATISFIED | 서버 단계 표·알람·마감 시각, 이후 단계가 같은 틀에 얹힘 |
| ROLE-01 | SATISFIED | `ROLE_TABLE` 서버 한 곳 |
| ROLE-02 | SATISFIED | `view.ts` 허용 목록, `leak.test.ts` 전수 검사 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 변경 소스 파일 | - | `TBD/FIXME/XXX/TODO/HACK` | 없음 | - |

### Human Verification Required

없음(승인 완료). 실기기에서만 볼 수 있는 항목 — 여러 폰 동시 낮 전환 체감, 폰에서 시트가 올라와 멈추는 모션, 폰트·테이블·OG 모양, 화면 잠금 복귀, 배포 중 재접속 — 은 사용자가 직접 확인했고 2026-10-30 에 전부 승인했다(`human_verification_approved`). 검증자는 기기를 보지 못했고, 위 값은 사용자 승인 기록을 옮긴 것이다. 자동 확인(테스트·스모크)은 별도로 통과했다.

### Gaps Summary

닫을 갭 없음.

## 비차단 항목

### 주의

1. **배포본 full 스모크 간헐 실패 1건(3회 중 1회).** 1회차가 `밤 마감 뒤 morning 이 모든 클라이언트에 오지 않음 (40초 제한 초과)` 로 실패했다. 방 만들기·참가·시작·역할 수령·낮 전환·토론·여부 투표(미통과) 까지는 통과한 뒤 밤 → 아침 구간(3페이즈 소관)에서 났다. 이어진 2회는 둘 다 통과했다. 같은 단계는 로컬 알람·밤 테스트(`night.test.ts`, `alarm.test.ts`)가 결정적으로 통과한다. HANDOFF 에도 "이 PC 의 배포본 smoke 는 네트워크에 따라 간헐 실패한 적이 있다"고 기록돼 있다. 재현하지 못했으므로 1페이즈 상태를 낮추지 않지만, 다시 보이면 `npx wrangler tail` 로 밤 마감 알람 경로를 먼저 본다. 이전 검증에서 본 `POST /api/rooms` 500 과는 다른 지점이다.
2. **IN-01~IN-09 (01-REVIEW.md INFO) 는 이번에 다시 닫지 않았다.** 로드맵 성공 기준을 깨지 않는 수용 항목이다(예: hello 안 한 소켓 수명 제한 없음 AR-01, 저장 상태 검증 없이 사용). 보안 쪽 결론은 `01-SECURITY.md`(threats_open 0)를 따른다.
3. **외부 폰트 의존.** `index.html` 이 Google Fonts 에서 Gowun Dodum 을 받는다. `display=swap` 과 시스템 한글 대체가 있어 실패해도 동작한다. 자체 호스팅 검토는 정식 출시 마일스톤.

### 문서 정합

- 이전 보고서의 "REQUIREMENTS.md Traceability 가 ROOM-02 만 Complete", "ROADMAP 1페이즈 16/19" 지적은 현재 해소됐다(Phase 1 요구사항 8개 `[x]`·Complete, ROADMAP 1페이즈 19/19 완료 표시).
- 1페이즈 `01-UI-SPEC.md`·`01-CONTEXT.md` 의 8자·원근 테이블 등은 위 '대체된 문구' 표대로 뒤 결정이 바꿨다. 문서 자체는 당시 기록이라 고치지 않았다.

### 이후 변경 확인 (2026-10-30, 결정 0042)

- 이 보고서 뒤 `package.json`(배포 스크립트 앞에 `node scripts/check-account.mjs` 추가)과 `wrangler.jsonc`(`preview_urls: false`)가 바뀌어 digest 가 stale 이 됐다. 둘 다 배포 절차 설정이고 게임 코드·Worker 동작은 그대로다(`src`·`shared`·`worker`·`public` 변경 없음). 계정 확인 테스트 5/5, `wrangler deploy --dry-run` 통과, 전체 vitest 3094/3094 로 확인하고 digest 만 다시 계산했다. 1페이즈 판정은 바뀌지 않는다.

### 실기기 잔여 관찰 (게이트 아님)

- 여러 폰 동시 낮 전환 시계 오프셋 편차: 자동 시험은 같은 PC 시계라 실기기 편차가 반영되지 않는다. 사용자가 실기기에서 확인·승인했다.
- 단절 직후 재연결 띠가 뜨기까지 약 10초(UAT 8번 노트).

---

_Verified: 2026-10-30_
_Verifier: Claude (gsd-verifier)_
