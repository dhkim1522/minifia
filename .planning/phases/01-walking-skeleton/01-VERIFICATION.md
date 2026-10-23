---
phase: 01-walking-skeleton
verified: 2026-10-23T10:30:00Z
status: gaps_found
score: 5/5 로드맵 성공 기준 코드·배포본 검증 (플랜 truth 중 D-06 닉네임 1건 실패)
covered_files: [".planning/phases/01-walking-skeleton/01-01-PLAN.md",".planning/phases/01-walking-skeleton/01-01-SUMMARY.md",".planning/phases/01-walking-skeleton/01-02-PLAN.md",".planning/phases/01-walking-skeleton/01-02-SUMMARY.md",".planning/phases/01-walking-skeleton/01-03-PLAN.md",".planning/phases/01-walking-skeleton/01-03-SUMMARY.md",".planning/phases/01-walking-skeleton/01-04-PLAN.md",".planning/phases/01-walking-skeleton/01-04-SUMMARY.md",".planning/phases/01-walking-skeleton/01-05-PLAN.md",".planning/phases/01-walking-skeleton/01-05-SUMMARY.md",".planning/phases/01-walking-skeleton/01-06-PLAN.md",".planning/phases/01-walking-skeleton/01-06-SUMMARY.md",".planning/phases/01-walking-skeleton/01-07-PLAN.md",".planning/phases/01-walking-skeleton/01-07-SUMMARY.md",".planning/phases/01-walking-skeleton/01-08-PLAN.md",".planning/phases/01-walking-skeleton/01-08-SUMMARY.md",".planning/phases/01-walking-skeleton/01-09-PLAN.md",".planning/phases/01-walking-skeleton/01-09-SUMMARY.md",".planning/phases/01-walking-skeleton/01-10-PLAN.md",".planning/phases/01-walking-skeleton/01-10-SUMMARY.md",".planning/phases/01-walking-skeleton/01-11-PLAN.md",".planning/phases/01-walking-skeleton/01-11-SUMMARY.md",".planning/phases/01-walking-skeleton/01-12-PLAN.md",".planning/phases/01-walking-skeleton/01-12-SUMMARY.md",".planning/phases/01-walking-skeleton/01-13-PLAN.md",".planning/phases/01-walking-skeleton/01-13-SUMMARY.md",".planning/phases/01-walking-skeleton/01-14-PLAN.md",".planning/phases/01-walking-skeleton/01-14-SUMMARY.md","index.html","package.json","public/_headers","scripts/gen-tokens.mjs","scripts/make-og.mjs","scripts/prod-url.txt","scripts/smoke.mjs","shared/game/phases.ts","shared/game/roles.ts","shared/game/room.ts","shared/game/tick.ts","shared/game/view.ts","shared/nickname.ts","shared/protocol.ts","shared/roomCode.ts","shared/schemas.ts","shared/seatLayout.ts","shared/version.ts","src/App.tsx","src/components/Backdrop.tsx","src/components/Button.tsx","src/components/ConfirmSheet.tsx","src/components/Figure.tsx","src/components/Icon.tsx","src/components/MyRoleSheet.tsx","src/components/PhaseBar.tsx","src/components/ReconnectBanner.tsx","src/components/RoleCard.tsx","src/components/ShareSheet.tsx","src/components/Sheet.tsx","src/components/Table.tsx","src/components/TextField.tsx","src/components/Timer.tsx","src/components/Toast.tsx","src/game/roleText.ts","src/main.tsx","src/net/api.ts","src/net/assets.ts","src/net/cardFace.ts","src/net/clock.ts","src/net/copy.ts","src/net/countdown.ts","src/net/linkReducer.ts","src/net/roomDiff.ts","src/net/session.ts","src/net/share.ts","src/net/useRoomConnection.ts","src/net/useSeatTransitions.ts","src/screens/Assigning.tsx","src/screens/Day.tsx","src/screens/ErrorScreen.tsx","src/screens/Home.tsx","src/screens/JoinByLink.tsx","src/screens/Lobby.tsx","src/screens/RoleReveal.tsx","src/screens/RoomScreen.tsx","src/styles/base.css","src/styles/ds.css","src/styles/lobby.css","src/styles/phase.css","src/styles/room.css","src/styles/sheet.css","src/styles/tokens.css","vite.config.ts","worker/allocate.ts","worker/index.ts","worker/random.ts","worker/room.ts","wrangler.jsonc"]
covered_digest: "v3:sha256:12740978235a7819be7f21be6b1bfc8467b4471e8a9c28bb797de4388901c19f"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "닉네임 중복 비교 키는 같은 이름으로 보이는 입력을 같은 키로 만들고, 보이는 글자가 하나도 없는 값은 INVALID_CHARS 다 (01-03 플랜 truth, D-06 '같은 방에 같은 닉네임이 있으면 거절')"
    status: failed
    reason: "CR-01 재현 확인. nicknameKey 는 NFKC+소문자만 하고 FORBIDDEN 은 Cc/Zl/Zp/Cf 만 막아서, 글자 사이에 ZWJ(U+200D)·변형 선택자(U+FE0F)를 넣은 '철\u200D수' 가 '철수' 와 다른 키로 통과하고, 한글 채움 문자(U+3164)·점자 빈칸(U+2800)은 \\p{L}/\\p{S} 라 VISIBLE 을 통과해 화면에 아무것도 안 보이는 닉네임이 ok:true 가 된다. 로컬에서 validateNickname 을 직접 실행해 확인했다. 서버(shared/game/room.ts joinRoom)가 이 키로만 NICKNAME_TAKEN 을 판정하므로 서버에서도 우회된다. 이후 페이즈의 투표·지목이 닉네임을 공개 식별자로 쓰므로 소셜 추론 게임의 신원 혼동으로 이어진다."
    artifacts:
      - path: "shared/nickname.ts"
        issue: "nicknameKey(9-14행 근처)가 보이지 않는 문자를 제거하지 않음, FORBIDDEN/VISIBLE 이 채움·결합·변형 문자를 투명 문자로 보지 않음. IN-07: ZWJ 상수가 눈에 보이지 않는 리터럴 문자"
    missing:
      - "nicknameKey 에서 채움 문자(U+115F U+1160 U+3164 U+FFA0 U+2800)·ZWJ·변형 선택자(U+FE00-FE0F)·결합 문자(\\p{M})를 제거"
      - "표시용 닉네임 검사에서 채움 문자만으로 이뤄진 값 거절 (키가 비면 INVALID_CHARS)"
      - "test/unit/nickname.test.ts 에 '철\u200D수'·U+3164·U+2800·U+FE0F 변형 입력 추가"
      - "shared/nickname.ts 의 ZWJ 를 이스케이프(\\u200D)로 바꿈 (IN-07)"
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: "360×640 실기기에서 링크 참가, 대기실 8인, 역할 확인, 낮 화면을 연다"
    expected: "세로 스크롤 없이 화면에 들어가고, 시민 역할 설명이 세 줄 이내다 (가정 A15)"
    why_human: "실제 폰 뷰포트·글꼴 렌더링은 코드·스모크로 볼 수 없다"
  - test: "iOS Safari 에서 나가기·내보내기·공유 시트(<dialog>)를 열고 닫는다"
    expected: "시트 열 때 포커스가 시트 안으로 가고, 닫은 뒤 시트를 연 버튼으로 돌아온다 (A12)"
    why_human: "iOS Safari 의 dialog 포커스 동작은 happy-dom 테스트가 대신할 수 없다"
  - test: "방장 폰에서 [공유하기]·[링크 복사]를 누른다"
    expected: "Web Share 시트가 열리거나 링크가 복사된다 (사용자 제스처 인정, A14)"
    why_human: "브라우저 제스처 정책은 실기기에서만 확인된다"
  - test: "카카오톡에 방 링크(/r/{코드})를 보내 미리보기를 본다"
    expected: "제목·설명·임시 OG 이미지가 나온다. og:image 는 minifia.dhplay.workers.dev 절대 주소 (A7)"
    why_human: "카카오톡 스크레이퍼는 외부 서비스다"
  - test: "폰 2대 이상(연결된 사람 4명 이상은 폰 4대, 또는 폰+PC 의 서로 다른 브라우저)으로 한 판 시작하고 역할 확인 카운트다운을 같이 본다"
    expected: "폰들이 0.5초 이내로 함께 '낮이 되었습니다' 로 넘어가는 것이 체감된다 (A1). 본 검증의 배포본 스모크 편차는 467ms(상한 500ms) 로 여유가 작았다"
    why_human: "체감 동기와 실기기 시계 오프셋은 사람 눈으로 본다"
  - test: "연결이 끊긴 채 30초를 기다린다"
    expected: "30초 뒤 포기 화면 [다시 시도]/[처음으로] 가 나온다 (A17)"
    why_human: "실제 망 상태·타이머 체감"
  - test: "화면을 잠그고 2분 뒤 다시 켠다 (역할 확인 도중과 낮 단계에서)"
    expected: "같은 자리·같은 역할로 돌아온다. 좀비 소켓이 남지 않는다 (A3, Open Question 7)"
    why_human: "iOS 백그라운드 소켓 동작은 실기기에서만 확인된다"
  - test: "게임 중 wrangler deploy 로 재배포한다"
    expected: "소켓이 끊겼다가 자동 재접속되고 같은 자리·역할이다 (A5)"
    why_human: "배포 중 소켓 끊김은 운영 환경에서만 확인된다 (본 검증은 프로덕션을 재배포하지 않았다)"
  - test: "@2x 와 @4x 그림 중 폰이 어느 쪽을 받는지 네트워크 탭으로 본다"
    expected: "srcset 이 화면 밀도에 맞게 선택된다 (A11)"
    why_human: "기기 DPR 의존"
  - test: "느린 망에서 첫 대기실 채움 시간과 첫 화면의 버전 글자를 본다"
    expected: "체감상 문제 없고 버전 글자가 배포본 버전과 같다"
    why_human: "체감 성능"
deferred: []
---

# Phase 1: 걷는 뼈대 검증 보고서

**Phase Goal:** As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다. (Mode: mvp)
**Verified:** 2026-10-23
**Status:** gaps_found (BLOCKER 1건 CR-01, 실기기 UAT 10건은 별도로 보존)
**Re-verification:** 아니오, 최초 검증

## 한 줄 요약

로드맵 성공 기준 5개는 코드와 배포본에서 모두 성립한다. 그러나 코드 리뷰의 BLOCKER CR-01(닉네임 비교 우회)을 직접 재현했고, 이는 01-03 플랜 truth(D-06)를 어긴다. 판정 순서상 `gaps_found` 가 `human_needed` 보다 앞서므로 상태는 `gaps_found` 다. CR-01 을 닫으면 남는 것은 실기기 UAT 뿐이라 상태는 `human_needed` 로 내려간다.

## Goal Achievement

### Observable Truths (로드맵 성공 기준)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cloudflare 배포 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다 | VERIFIED (실기기는 human) | `curl https://minifia.dhplay.workers.dev/api/health` 200 `{"ok":true,"version":"2026-10-23T07:59:34Z+59caa32"}`. 루트 `/` 는 200 text/html(OG 메타 포함). 직접 돌린 `node scripts/smoke.mjs --prod --stage full --players 6` 가 `SMOKE OK full code=1427 players=6 spread=467ms` (WebSocket 6개로 방 만들기, 참가, 시작, 역할 수신, 낮까지). 배포 버전의 커밋 59caa32 이후 HEAD 까지 코드 변경 없음(`git diff 59caa32 HEAD`가 .planning/HANDOFF/README 밖에서 비어 있음). 진짜 폰 2대는 human 항목 |
| 2 | 방 만들기에 4자리 코드와 참가 링크가 나오고 공유 버튼으로 보낼 수 있다. 다른 사람은 링크·코드로 닉네임만 입력해 대기실에 나타난다 | VERIFIED (공유·카카오는 human) | `worker/index.ts` POST /api/rooms, GET /api/rooms/{code}, POST /join 라우트. `src/screens/Lobby.tsx` 가 `view.code` 와 ShareSheet 를 렌더, `src/components/ShareSheet.tsx` 가 `shareOnly`/`copyLink`(클릭 처리기 첫 줄)를 호출, `src/net/share.ts` 의 Web Share, 클립보드, 수동 3단. 링크 형식 `{origin}/r/{코드}`, `App.tsx` 가 `/r/{코드}` 로 JoinByLink. 설치·로그인 없음. 전체 테스트 588개 통과(join.test, preview.test, joinByLink.test, share.test) |
| 3 | 4명 이상 모인 방에서 방장이 시작하면 인원 구성표대로 배정, 각자 자기 카드만 본다. 마피아는 동료도 본다. 네트워크 메시지에서도 남의 역할은 확인할 수 없다 | VERIFIED | `shared/game/roles.ts` ROLE_TABLE 이 REQUIREMENTS ROLE-01 표와 일치(4: 1·1·0·2 … 8: 2·1·1·4), Fisher-Yates + cryptoRandInt 주입. `shared/game/view.ts` 는 허용 목록 객체 리터럴: `role` 은 `revealsOwnRole` 단계의 본인에게만, `allies`(seat 번호)는 마피아 본인에게만. 미리보기는 `{seat,nickname}` 만. `test/worker/leak.test.ts`(6명 한 판 전 프레임·HTTP 응답 수집, 남의 토큰 없음, 역할 수 일치)가 통과하고 배포본 스모크도 같은 누출 전수 단언을 포함해 통과 |
| 4 | 시작하면 모든 폰에 '직업을 배정하고 있습니다…' 약 3초 뒤 역할 확인 15초, 마감에 맞춰 모두 '낮이 되었습니다'. 껐다 켜거나 새로고침해도 같은 자리·역할로 돌아온다 | VERIFIED (동기 체감·잠금 복귀는 human) | `shared/game/phases.ts` ASSIGNING_MS 3000, ROLE_REVEAL_MS 15000, `shared/game/tick.ts` 가 `이전 마감 + 다음 길이`로 연쇄 계산해 모든 폰이 같은 마감을 받음. `worker/room.ts` 알람이 `nextWakeAt` 에 맞춰지고 하이버네이션 복구 시 `connected` 를 소켓 첨부로 재계산(test/worker/alarm.test, reconnect.test, start.test 통과). 클라이언트는 서버 `phaseEndsAt` 와 핑 표본 오프셋(`src/net/clock.ts`)으로만 표시. `src/net/session.ts` 가 토큰을 localStorage 에 저장, `App.tsx` 가 새로고침 때 이어받기. 스모크: 재접속 시 같은 seat·역할, 낮 도착 편차 467ms(상한 500ms) |
| 5 | 코드를 고치고 `wrangler deploy` 를 다시 하면 주소는 그대로이고 새 버전이 보인다 | VERIFIED (이번 검증에서 재배포는 하지 않음) | `scripts/prod-url.txt` 는 첫 배포 커밋 ccffa44 이후 변경 이력이 없고(`git log`), 그 주소에서 현재 version 이 마지막 코드 커밋 59caa32 의 것이다. 01-14 SUMMARY 에 OLD `…+9625cab` → `…+21a41e7` → `…+59caa32` 이 같은 주소에서 바뀐 기록이 있고, 스모크의 `--previous-version` 검사로 확인했다고 한다. 프로덕션 변경을 피하려고 이번 검증에서는 재배포를 다시 하지 않았다. `npm run build` 가 `dist/client` 를 만들고 `wrangler.jsonc` 가 단일 Worker + 정적 에셋 + ROOM DO 를 선언 |

**플랜 truth 점검:** 14개 플랜의 must_haves 를 훑어 위 성공 기준과 겹치지 않는 항목(01-09 의 참가·나가기·내보내기·기기 교체·속도 제한·알람 재시도, 01-03 의 순수 규칙, 01-11 의 재접속 상태기계 등)은 해당 `test/` 파일이 전부 통과하는 것으로 확인했다. 실패한 것은 01-03 의 닉네임 truth 한 건(위 gaps)이다.

**점수:** 로드맵 성공 기준 5/5 성립, 플랜 truth 1건 실패(CR-01), 동작 미검증(PRESENT_BEHAVIOR_UNVERIFIED) 0건. 상태·전환·정리 불변식(단계 전환, 낡은 소켓 닫힘 무시, 하이버네이션 복구, 알람 재시도)은 워커 통합 테스트가 직접 실행한다.

### Behavioral Spot-Checks

| 동작 | 명령 | 결과 | 상태 |
| --- | --- | --- | --- |
| 전체 테스트 | `npx vitest run` (한 번만 실행) | 40 files, 588 tests passed | PASS |
| 타입 검사 | `npm run typecheck` (tokens:check, 앱, 워커) | 오류 없음 | PASS |
| 빌드 | `npm run build` | dist/client 생성 (index.html, JS 265kB, CSS 25kB) | PASS |
| 배포본 건강 확인 | `curl …/api/health` | 200, version `2026-10-23T07:59:34Z+59caa32` | PASS |
| 배포본 full 스모크 | `node scripts/smoke.mjs --prod --stage full --players 6` | `SMOKE OK full … spread=467ms` | PASS |
| CR-01 재현 | `validateNickname("철\u200D수")`, `"\u3164"`, `"\u2800"`, `"철\uFE0F수"` | 모두 `ok:true`, `"철\u200D수"` 의 key 가 `"철수"` 와 다름 | FAIL (gap) |

참고: 스모크는 프로덕션에 임시 방을 만든다(방은 3시간 TTL 후 만료). 상태 변경은 이것이 전부다.

### Probe Execution

SKIPPED. 플랜이 선언한 `probe-*.sh` 가 없고 `scripts/*/tests/probe-*.sh` 도 없다.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `worker/index.ts` | 방 생성·미리보기·참가·WS 라우트 | VERIFIED | 실제 DO 호출, 정적 에셋은 `run_worker_first: ["/api/*"]` |
| `worker/room.ts` | 참가·나가기·내보내기·재접속·시작·알람·속도 제한 | VERIFIED | `nextWakeAt`, `buildPreview`, `startGame` 배선 확인, 테스트 통과 |
| `shared/game/{room,roles,tick,phases,view}.ts` | 순수 규칙 | VERIFIED | 서버가 신원·시각을 정하고 클라이언트 값 미사용 |
| `shared/nickname.ts` | 닉네임 규칙 | STUB 아님, 규칙 결함 | 위 gap |
| `src/screens/{Home,JoinByLink,Lobby,Assigning,RoleReveal,Day,RoomScreen}.tsx` | 화면 | VERIFIED | `RoomScreen` 이 view.phase 로 분기, 서버 단계만 따름 |
| `src/net/{useRoomConnection,linkReducer,clock,session,share}.ts` | 연결·시계·세션·공유 | VERIFIED (WR 경고 있음) | 아래 경고 참조 |
| `scripts/smoke.mjs`, `public/_headers`, `public/og.png` | 배포 스모크·캐시·OG | VERIFIED | 스모크 직접 실행 통과, 배포본 `/` 에 og 메타 |
| `wrangler.jsonc` | Worker 이름 minifia, ROOM DO(sqlite), SPA 폴백 | VERIFIED | 배포본 응답으로 확인 |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `worker/index.ts` | `worker/room.ts` | `env.ROOM.getByName(code).preview/join/fetch` | WIRED |
| `worker/room.ts` | `shared/game/room.ts` | `joinRoom/leaveRoom/kickPlayer/startGame` | WIRED |
| `worker/room.ts` | `shared/game/tick.ts` | 모든 진입점 `advance` 에서 `tick`, `nextWakeAt` 로 알람 | WIRED |
| `worker/room.ts` | `shared/game/view.ts` | `buildView`, `buildPreview` | WIRED |
| `worker/room.ts` start | `worker/random.ts` | `cryptoRandInt` 주입 | WIRED |
| `App.tsx` | `RoomScreen` → `useRoomConnection` | 토큰으로 WS hello, `view` 로 단계 렌더 | WIRED |
| `Lobby` | `ShareSheet` → `share.ts` | 클릭 처리기에서 `shareOnly`/`copyLink` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | 데이터 | 출처 | 실제 데이터 | 상태 |
| --- | --- | --- | --- | --- |
| `Lobby` 참가자 목록·코드 | `view.players`, `view.code` | WS `state` ← `buildView` ← DO 저장소 | 예 | FLOWING |
| `RoleReveal` 역할·동료 | `view.me.role`, `allies` | 서버 `buildView` (본인 한정) | 예 | FLOWING |
| `Timer`, 카드 자동 뒤집기 | `view.phaseEndsAt`, 오프셋 | 서버 마감 + 핑 표본 | 예 (WR-04 참조) | FLOWING |
| `Day` | 정적 문구 | 1페이즈 끝 화면이라 데이터 없음(의도) | 해당 없음 | 설계상 정적 |

### Requirements Coverage

PLAN 프런트매터 `requirements` 를 모아 REQUIREMENTS.md 와 대조했다. 14개 플랜이 8개 ID 전부를 선언하며, ROADMAP 1페이즈의 요구사항 8개와 일치한다. 이 페이즈에 매핑되었지만 어느 플랜도 선언하지 않은(ORPHANED) 요구사항은 없다.

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| ROOM-01 코드·링크·공유 | 01-02, 01-03, 01-05, 01-12, 01-14 | SATISFIED (공유 제스처는 human) | Lobby 코드, ShareSheet, share.ts 3단 |
| ROOM-02 링크·코드로 닉네임만 입력해 참가 | 01-03, 01-04, 01-06, 01-09, 01-10, 01-14 | SATISFIED (닉네임 중복 방어에 CR-01 결함) | join.test, joinByLink.test, 스모크 |
| ROOM-03 4~8명, 연결자 4명 이상 시작, 8명 차면 거절 | 01-04, 01-07, 01-09, 01-10, 01-12, 01-14 | SATISFIED | `checkStart`(`connectedCount >= MIN_PLAYERS`), `ROOM_FULL` 8석(끊긴 사람 포함), start.test, 스모크의 연결 3명 거절 |
| CONN-01 토큰 발급·저장·같은 자리·역할 복귀 | 01-06, 01-09, 01-11, 01-13, 01-14 | SATISFIED (잠금 복귀는 human) | session.ts, reconnect.test, 스모크 재접속 |
| DEPLOY-01 `wrangler deploy` 로 같은 주소 | 01-01, 01-02, 01-14 | SATISFIED | 배포본 200, 주소 이력 불변 |
| GAME-01 서버 단계 전환·마감 시각, 배정 3초·확인 15초 | 01-03, 01-07, 01-08, 01-09, 01-11, 01-13, 01-14 | SATISFIED (동기 체감은 human) | tick.ts, alarm.test, 스모크 전환 편차 |
| ROLE-01 인원별 무작위 배정 | 01-03, 01-07, 01-09, 01-14 | SATISFIED | ROLE_TABLE = 요구사항 표, roles.test, 스모크 인원별 역할 수 단언 |
| ROLE-02 자기 카드만, 마피아는 동료도, 서버는 남의 역할을 안 보냄 | 01-04, 01-07, 01-08, 01-09, 01-13, 01-14 | SATISFIED | view.ts 허용 목록, leak.test, 스모크 누출 전수 |

참고: REQUIREMENTS.md Traceability 의 상태 열은 아직 모두 Pending 이다. 이 검증이 갱신하지 않았다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `shared/nickname.ts` | 9-14, 28-30 | 투명 문자 우회 (CR-01) | BLOCKER | 위 gap |
| `src/screens/Lobby.tsx` | 168-176 | 연결이 끊긴 사이 [나가기] 확인: `send` 가 조용히 버려지는데 `onLeave()`(입장 정보 삭제)는 실행 (WR-01) | WARNING | 서버에 유령 자리가 남고 같은 이름 재참가가 NICKNAME_TAKEN |
| `src/net/useRoomConnection.ts` | 194-199, 203-214 | 종료 상태(replaced/removed)에서도 pong 대기 타이머가 새 연결을 엶 (WR-02) | WARNING | 두 창이 서로 쫓아낼 수 있음 |
| `src/net/linkReducer.ts` / `Lobby.tsx` | 55-57 / 39-47 | epoch 가 첫 state 보다 먼저 올라 재연결 직후 낡은 비교로 토스트·등장 전이 재생 (WR-03) | WARNING | 지난 입장 토스트가 다시 뜸 |
| `src/screens/RoleReveal.tsx` / `useRoomConnection.ts` | 31-33 / 76-77 | 첫 pong 전 오프셋 0 으로 카드 초기 면 결정 (WR-04) | WARNING | 시계가 5초 이상 빠른 폰은 사용자가 누르기 전에 역할이 앞면으로 열릴 수 있음(본인 역할이라 서버 누출은 아님) |
| `worker/index.ts`, `worker/allocate.ts` | 43-96 | 방 만들기·참가 HTTP 에 속도 제한 없음 (WR-05) | WARNING | 코드 공간 10,000개 소진·8석 점유 가능 |
| `worker/room.ts` | 80-98 | 만료됐지만 정리 전인 방 코드를 `createRoom` 이 덮어씀 (WR-06) | WARNING | 옛 소켓이 죽은 연결로 남음 |
| 여러 파일 | - | IN-01~IN-09 (hello 없는 소켓 수명, 본문 청크 상한, 낡은 첨부, 저장 상태 검증, 한 칸 세션, 보안 헤더, ZWJ 리터럴, error 프레임 무시, 알람 백오프) | INFO | 코드 리뷰 문서 참조 |
| 전 소스 | - | `TBD`/`FIXME`/`XXX` 마커 | 없음 | `src`, `shared`, `worker`, `scripts`, `index.html` grep 결과 비어 있음 |

WR-01~WR-04 는 소스 대조로 확인했다(코드가 리뷰 서술과 일치). WR-05·WR-06 은 리뷰 서술을 읽고 해당 줄이 설명대로임을 확인했다. 전부 로드맵 성공 기준 5개를 깨지는 않는다(경계 조건·복원력 결함). 02 페이즈가 같은 연결 계층을 얹으므로 WR-01~04 는 2페이즈 전에 고치는 편이 안전하다. 리뷰 처분 문서(`01-REVIEW-DISPOSITION.md`)의 처분은 전부 `open` 이다.

### Human Verification Required

프런트매터 `human_verification` 에 10건을 적었다(360×640 레이아웃, iOS Safari 시트 포커스, 공유·복사 제스처, 카카오톡 미리보기, 실기기 시계 동기 체감, 30초 포기, 잠금화면 2분 복귀, 배포 중 끊김, srcset, 느린 망·버전 글자). 01-14 SUMMARY 의 "검증되지 않은" 목록과 호출자 지시 목록을 합친 것이다. 모두 `/gsd-verify-work 1` 의 사람 확인 대상이다.

### Gaps Summary

- **GAP-1 (BLOCKER, CR-01):** 닉네임 중복·투명 이름 방어가 우회된다. 해결 범위가 `shared/nickname.ts` 와 단위 테스트에 국한된 작은 수정이고, 서버·클라이언트가 같은 파일을 쓰므로 한 곳을 고치면 양쪽이 고쳐진다. 리뷰 문서의 제안(채움·변형·결합 문자를 비교 키에서 제거, 투명 문자 금지)을 쓰면 된다.
- 로드맵 성공 기준 5개는 이 gap 과 무관하게 성립한다. 따라서 페이즈 목표(역할을 모른 채 한 판을 시작)는 달성되었으나, 플랜이 약속한 닉네임 규칙이 완전하지 않아 `gaps_found` 로 둔다. 원하면 이 gap 을 override 로 수락(예: 2페이즈 시작 전 수정으로 미룸)할 수 있지만, 닉네임이 이후 페이즈의 투표·지목 식별자가 되므로 권장하지 않는다.
- 배포본 스모크의 낮 도착 편차가 467ms 로 상한(500ms)에 가까웠다(01-14 SUMMARY 의 50~80ms 대비 큼). 이 환경의 네트워크 변동일 가능성이 크지만 실기기 시계 동기 항목에서 다시 본다.
- 오래된 인계 상태: 원격 `origin/main` 은 010b738 이고 로컬 HEAD 는 59bbc9d(문서 커밋 2개 앞섬)다. 코드는 배포본과 같아 영향이 없다.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
