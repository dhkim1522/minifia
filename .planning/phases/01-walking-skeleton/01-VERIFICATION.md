---
phase: 01-walking-skeleton
verified: 2026-10-23T17:58:00Z
status: human_needed
score: 5/5 로드맵 성공 기준 + 플랜 truth 전부 코드 검증 (GAP-1 닫힘), 실기기 UAT 10건 남음
covered_files: [".planning/phases/01-walking-skeleton/01-01-PLAN.md",".planning/phases/01-walking-skeleton/01-01-SUMMARY.md",".planning/phases/01-walking-skeleton/01-02-PLAN.md",".planning/phases/01-walking-skeleton/01-02-SUMMARY.md",".planning/phases/01-walking-skeleton/01-03-PLAN.md",".planning/phases/01-walking-skeleton/01-03-SUMMARY.md",".planning/phases/01-walking-skeleton/01-04-PLAN.md",".planning/phases/01-walking-skeleton/01-04-SUMMARY.md",".planning/phases/01-walking-skeleton/01-05-PLAN.md",".planning/phases/01-walking-skeleton/01-05-SUMMARY.md",".planning/phases/01-walking-skeleton/01-06-PLAN.md",".planning/phases/01-walking-skeleton/01-06-SUMMARY.md",".planning/phases/01-walking-skeleton/01-07-PLAN.md",".planning/phases/01-walking-skeleton/01-07-SUMMARY.md",".planning/phases/01-walking-skeleton/01-08-PLAN.md",".planning/phases/01-walking-skeleton/01-08-SUMMARY.md",".planning/phases/01-walking-skeleton/01-09-PLAN.md",".planning/phases/01-walking-skeleton/01-09-SUMMARY.md",".planning/phases/01-walking-skeleton/01-10-PLAN.md",".planning/phases/01-walking-skeleton/01-10-SUMMARY.md",".planning/phases/01-walking-skeleton/01-11-PLAN.md",".planning/phases/01-walking-skeleton/01-11-SUMMARY.md",".planning/phases/01-walking-skeleton/01-12-PLAN.md",".planning/phases/01-walking-skeleton/01-12-SUMMARY.md",".planning/phases/01-walking-skeleton/01-13-PLAN.md",".planning/phases/01-walking-skeleton/01-13-SUMMARY.md",".planning/phases/01-walking-skeleton/01-14-PLAN.md",".planning/phases/01-walking-skeleton/01-14-SUMMARY.md",".planning/phases/01-walking-skeleton/01-15-PLAN.md",".planning/phases/01-walking-skeleton/01-15-SUMMARY.md","package.json","shared/game/room.ts","shared/nickname.ts","test/unit/gameRoom.test.ts","test/unit/nickname.test.ts","test/worker/join.test.ts"]
covered_digest: "v3:sha256:b5b259866642292732bde3eeb24c3a314dc768afa661be7c129e6721f47e8df7"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "5/5 로드맵 성공 기준, 플랜 truth 1건 실패"
  gaps_closed:
    - "GAP-1 (CR-01): 닉네임 비교 키가 보이지 않는 문자로 우회되고 채움 문자 이름이 통과함 — 01-15 로 닫힘"
    - "IN-07: ZWJ 상수가 눈에 보이지 않는 리터럴이었음 — 코드 포인트 이스케이프로 교체"
  gaps_remaining: []
  regressions: []
gaps: []
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
    expected: "폰들이 0.5초 이내로 함께 '낮이 되었습니다' 로 넘어가는 것이 체감된다 (A1). 이전 검증의 배포본 스모크 편차는 467ms(상한 500ms) 로 여유가 작았다"
    why_human: "체감 동기와 실기기 시계 오프셋은 사람 눈으로 본다"
  - test: "연결이 끊긴 채 30초를 기다린다"
    expected: "30초 뒤 포기 화면 [다시 시도]/[처음으로] 가 나온다 (A17)"
    why_human: "실제 망 상태·타이머 체감"
  - test: "화면을 잠그고 2분 뒤 다시 켠다 (역할 확인 도중과 낮 단계에서)"
    expected: "같은 자리·같은 역할로 돌아온다. 좀비 소켓이 남지 않는다 (A3, Open Question 7)"
    why_human: "iOS 백그라운드 소켓 동작은 실기기에서만 확인된다"
  - test: "게임 중 wrangler deploy 로 재배포한다"
    expected: "소켓이 끊겼다가 자동 재접속되고 같은 자리·역할이다 (A5)"
    why_human: "배포 중 소켓 끊김은 운영 환경에서만 확인된다"
  - test: "@2x 와 @4x 그림 중 폰이 어느 쪽을 받는지 네트워크 탭으로 본다"
    expected: "srcset 이 화면 밀도에 맞게 선택된다 (A11)"
    why_human: "기기 DPR 의존"
  - test: "느린 망에서 첫 대기실 채움 시간과 첫 화면의 버전 글자를 본다"
    expected: "체감상 문제 없고 버전 글자가 배포본 버전과 같다"
    why_human: "체감 성능"
deferred: []
---

# Phase 1: 걷는 뼈대 검증 보고서 (재검증)

**Phase Goal:** As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다. (Mode: mvp)
**Verified:** 2026-10-23
**Status:** human_needed (코드 gap 없음, 실기기 UAT 10건 남음)
**Re-verification:** 예 — 갭 클로저 plan 01-15 이후

## 한 줄 요약

이전 검증의 유일한 gap(GAP-1, CR-01 닉네임 비교 우회)이 코드에서 닫혔다. 직접 재현 입력으로 확인했고, 전체 테스트 40파일 617개(이전 588개)와 타입 검사가 통과한다. 이전 검증 이후 코드 변경은 `shared/nickname.ts` 하나뿐이라 이전에 통과한 항목에 회귀는 없다. gap 이 없으므로 상태는 `gaps_found` 에서 `human_needed`(실기기 UAT)로 내려갔다.

## GAP-1 재검증

| 확인 | 방법 | 결과 |
| --- | --- | --- |
| `철` + U+200D + `수` 가 `철수` 와 같은 키 | `validateNickname` 직접 실행 (임시 테스트, 실행 뒤 삭제) | key === `"철수"` |
| `철` + U+FE0F + `수`, `철` + U+0301 + `수` 도 같은 키 | 같음 | key === `"철수"` |
| U+3164, U+2800, U+115F, U+1160, U+FFA0 단독 | 같음 | 전부 `INVALID_CHARS` |
| 채움 문자가 글자 사이에 섞인 `철` + U+3164 + `수` | 같음 | `INVALID_CHARS` |
| U+FF9E(키가 비는 값) 및 9회 반복 | 같음 | `INVALID_CHARS` (TOO_LONG 이 아님, 검사 순서 유지) |
| 정상 입력 회귀: 민수, 김 민수, 8글자 한글, NFD 한글, 가족 이모지, 하트(U+2764 U+FE0F), 무지개 깃발 | 같음 | 전부 `ok:true`, 표시 닉네임은 정규화 결과 그대로 |
| 기존 키 동등성: 전각 `ＭＩＮＳＵ` → `minsu`, NFD·NFC 한글 같은 키 | 같음 | 통과 |
| 서버 판정 경로 | `shared/game/room.ts:96-98` joinRoom 이 `validateNickname(...).key` 로만 `NICKNAME_TAKEN` 판정, `createRoomState` 도 `checked.key` 저장. `worker/room.ts` 가 joinRoom 호출 | 규칙 한 곳 수정이 서버·클라이언트 양쪽에 적용됨 |
| 서버 쪽 테스트 | `test/unit/gameRoom.test.ts` (CR-01 4건), `test/worker/join.test.ts` (CR-01 3건: 409 NICKNAME_TAKEN, 400 NICKNAME_INVALID) | 통과 |
| IN-07 | `shared/nickname.ts` 에 눈에 보이지 않는 리터럴 문자 없음(비ASCII 중 투명 문자 범위 grep 결과 비어 있음). ZWJ 는 `"\u{200D}"` | 해결 |

구현 확인: `nicknameKey` 는 NFKC → `KEY_IGNORED_CHARS`(채움 문자, ZWJ, U+FE00-FE0F, `\p{M}`) 제거 → NFKC → 소문자. `validateNickname` 은 EMPTY → (금지 문자·채움 문자·보이는 글자 없음) INVALID_CHARS → 빈 키 INVALID_CHARS → TOO_LONG 순서다. `INVISIBLE_FILLER` 는 비전역 정규식, `KEY_IGNORED_CHARS` 는 replace 전용 전역 정규식이라 `lastIndex` 문제가 없다.

## Goal Achievement

### Observable Truths (로드맵 성공 기준)

이전 검증에서 코드와 배포본으로 확인한 5개 기준은 그대로다. 이번에는 회귀만 확인했다. `git diff 59caa32 HEAD`(이전에 배포된 코드 커밋 이후)가 `src`, `worker`, `shared`, `index.html`, `public`, `scripts`, `wrangler.jsonc` 에서 `shared/nickname.ts` 한 파일(+22 -5)만 보여 준다. 이 파일은 `shared/game/room.ts` 와 클라이언트 입력 검사가 쓰며 역할 배정·시계·재접속·공유 경로에는 닿지 않는다.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cloudflare 배포 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다 | VERIFIED (실기기는 human) | 이전 검증의 배포본 스모크 `SMOKE OK full players=6`. 이후 변경은 닉네임 규칙뿐. 전체 테스트 통과 |
| 2 | 방 만들기에 4자리 코드와 참가 링크, 공유, 링크·코드로 닉네임만 입력해 대기실 진입 | VERIFIED (공유·카카오는 human) | join.test, preview.test, joinByLink.test, share.test 통과. 닉네임 입력 규칙은 더 엄격해졌고 정상 입력(한글·영문·이모지)은 회귀 없이 통과 |
| 3 | 4명 이상 시작, 인원 구성표대로 배정, 자기 카드만, 마피아는 동료도, 남의 역할은 네트워크에 없음 | VERIFIED | roles.test, view.test, leak.test 통과(코드 변경 없음) |
| 4 | 배정 약 3초, 역할 확인 15초, 마감에 맞춰 낮 전환, 새로고침·재접속에도 같은 자리·역할 | VERIFIED (동기 체감·잠금 복귀는 human) | tick/alarm/reconnect/start 테스트 통과(코드 변경 없음) |
| 5 | 재배포해도 주소 그대로, 새 버전 표시 | VERIFIED (이번에도 재배포 안 함) | `scripts/prod-url.txt`·`wrangler.jsonc` 변경 없음 |
| P | 01-03 플랜 truth: 같은 이름으로 보이는 입력은 같은 키, 보이는 글자 없는 값은 INVALID_CHARS (D-06) | VERIFIED (이전 FAILED) | 위 GAP-1 표 |
| P | 01-15 플랜 truth 7개 (ZWJ·FE0F·결합 문자 → NICKNAME_TAKEN, 채움 문자 → INVALID_CHARS, 빈 키, 정상 입력 회귀, 키 동등성, 이스케이프) | VERIFIED | 위 GAP-1 표, 테스트 `CR-01` 케이스 |

**점수:** 로드맵 성공 기준 5/5, 플랜 truth 전부 성립, PRESENT_BEHAVIOR_UNVERIFIED 0건. 상태·정리 불변식은 이전과 같이 워커 통합 테스트가 직접 실행한다.

### Behavioral Spot-Checks

| 동작 | 명령 | 결과 | 상태 |
| --- | --- | --- | --- |
| CR-01 재현 입력 전수 | 임시 vitest 로 `validateNickname`/`nicknameKey` 단언 (삭제함) | 위 표의 모든 단언 통과 | PASS |
| 전체 테스트 | `npx vitest run` (한 번) | 40 files, 617 tests passed | PASS |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 | PASS |
| 디버트 마커 | `shared/nickname.ts`, `test/unit/nickname.test.ts` 에서 TBD/FIXME/XXX | 없음 | PASS |

이번에는 프로덕션 호출(스모크)을 다시 하지 않았다. 변경이 서버 규칙 한 파일이고 로컬 워커 통합 테스트(join.test, miniflare 기반)가 같은 규칙을 HTTP 경로로 실행한다.

### Probe Execution

SKIPPED. 선언된 `probe-*.sh` 없음.

### Requirements Coverage

ROOM-02 가 이번 갭 클로저의 대상이다. 닉네임 중복 방어 결함이 닫혀 SATISFIED 로 올라갔다. 나머지 7개 요구사항(ROOM-01, ROOM-03, CONN-01, DEPLOY-01, GAME-01, ROLE-01, ROLE-02)은 이전 판정 그대로이고 관련 코드 변경이 없다. ORPHANED 요구사항 없음. 참고: REQUIREMENTS.md Traceability 상태 열은 이 검증이 갱신하지 않았다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/screens/Lobby.tsx` | 168-176 | WR-01: 연결 끊김 중 [나가기]가 서버에 안 가는데 입장 정보는 삭제 | WARNING (이월) | 유령 자리, 같은 이름 재참가가 NICKNAME_TAKEN |
| `src/net/useRoomConnection.ts` | 194-214 | WR-02: 종료 상태에서도 pong 대기 타이머가 연결을 다시 엶 | WARNING (이월) | 두 창이 서로 쫓아낼 수 있음 |
| `src/net/linkReducer.ts` / `Lobby.tsx` | 55-57 / 39-47 | WR-03: epoch 가 첫 state 보다 먼저 올라 낡은 비교로 토스트 재생 | WARNING (이월) | 지난 입장 토스트 재생 |
| `src/screens/RoleReveal.tsx` / `useRoomConnection.ts` | 31-33 / 76-77 | WR-04: 첫 pong 전 오프셋 0 으로 카드 초기 면 결정 | WARNING (이월) | 시계가 5초 이상 빠른 폰은 역할이 앞면으로 열릴 수 있음(본인 역할, 서버 누출 아님) |
| `worker/index.ts`, `worker/allocate.ts` | 43-96 | WR-05: 방 만들기·참가 HTTP 속도 제한 없음 | WARNING (이월) | 코드 공간·8석 점유 가능 |
| `worker/room.ts` | 80-98 | WR-06: 만료 전 방 코드를 `createRoom` 이 덮어씀 | WARNING (이월) | 죽은 연결 잔존 |
| 여러 파일 | - | IN-01~IN-06, IN-08, IN-09 | INFO (이월) | 코드 리뷰 문서 참조 (IN-07 은 닫힘) |
| 이번 변경 파일 | - | `TBD`/`FIXME`/`XXX` 마커 | 없음 | - |

WR-01~06 은 이전 검증과 같은 이월 항목이고 이번 변경과 무관하다. 로드맵 성공 기준을 깨지 않는다. 2페이즈가 같은 연결 계층을 얹으므로 WR-01~04 는 2페이즈 전에 고치는 편이 안전하다. 처분은 `01-REVIEW-DISPOSITION.md` 참조.

### Human Verification Required

프런트매터 `human_verification` 의 10건(360×640 레이아웃, iOS Safari 시트 포커스, 공유·복사 제스처, 카카오톡 미리보기, 실기기 시계 동기 체감, 30초 포기, 잠금화면 2분 복귀, 배포 중 끊김, srcset, 느린 망·버전 글자)은 그대로다. `/gsd-verify-work 1` 의 사람 확인 대상이다.

### Gaps Summary

코드 gap 없음. GAP-1 닫힘.

주의할 점 두 가지.

- **프로덕션 미재배포:** 배포본(`…+59caa32`)에는 닉네임 수정이 들어 있지 않다. 01-15 plan 이 재배포를 범위 밖으로 두었다. 실기기 UAT 전에 `wrangler deploy` 로 재배포해야 사람 확인이 수정된 규칙 위에서 이뤄진다(재배포는 이 검증이 하지 않았다).
- 배포본 스모크의 낮 도착 편차가 이전에 467ms 로 상한(500ms)에 가까웠다. 실기기 시계 동기 항목에서 다시 본다.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
