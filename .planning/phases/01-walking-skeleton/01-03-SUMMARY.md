---
phase: 01-walking-skeleton
plan: 03
subsystem: game-rules
tags: [tdd, nickname, roles, seat-layout, clock-sync, web-share, intl-segmenter, vitest]

requires:
  - phase: 01-walking-skeleton
    provides: "01-01 의 vitest unit 프로젝트, 앱·워커 분리 tsconfig(shared/ 는 양쪽 컴파일)"
provides:
  - "shared/nickname.ts: NFC·공백 정리, grapheme 1~8, 제어·영폭·방향 문자 거부, NFKC+소문자 중복 키 (서버·클라이언트 공용)"
  - "shared/game/roles.ts: ROLE_TABLE(4~8명 구성표 한 곳)과 주입 난수 Fisher–Yates assignRoles"
  - "shared/seatLayout.ts: 내 자리를 맨 아래 가운데로 돌린 원근 타원 좌표(퍼센트)"
  - "src/net/clock.ts: 최소 왕복 표본 서버 시계 오프셋, 0 하한 남은 시간"
  - "src/net/share.ts: Web Share → 클립보드 → 수동 3단 공유, buildRoomLink, buildShareText"
  - "test/helpers/seededRandom.ts: 테스트용 mulberry32 seededRandInt"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09]

actuals:
  tokens: 5900
  tasks: 3
  commits: 6
plan_head_before: 2d4c64028e7fa9af6bf5a8f0a951f41f5d85e4e0
plan_head_after: 3c0c721aea8bc38cba903450d88a5fcd15c76b26

tech-stack:
  added: []
  patterns:
    - "규칙은 DOM·workerd 와 무관한 순수 함수로 shared/ 와 src/net/ 에 두고 단위 테스트로 고정한다"
    - "난수·navigator 는 인자로 주입한다(전역을 직접 읽지 않음) — 서버는 cryptoRandInt, 테스트는 seededRandInt, 공유는 nav 객체"
    - "RED 커밋은 시그니처만 있는 자리표시 구현과 함께 올려 모듈 없음이 아니라 단언 실패로 빨갛게 한다"

key-files:
  created:
    - shared/nickname.ts
    - shared/game/roles.ts
    - shared/seatLayout.ts
    - src/net/clock.ts
    - src/net/share.ts
    - test/helpers/seededRandom.ts
    - test/unit/nickname.test.ts
    - test/unit/roles.test.ts
    - test/unit/seatLayout.test.ts
    - test/unit/clock.test.ts
    - test/unit/share.test.ts
  modified: []

key-decisions:
  - "normalizeNickname 은 안쪽 공백을 \\p{Zs} 연속만 하나로 줄이고 탭·줄바꿈(Cc)은 그대로 둬 검증에서 INVALID_CHARS 로 거부한다 (\\s+ 로 줄이면 'a\\nb' 가 'a b' 로 통과한다)"
  - "assignRoles 는 인원 범위 밖뿐 아니라 중복 플레이어 ID 도 RangeError (Map 이 조용히 줄어드는 것을 막는다)"
  - "shareRoom 은 공개 함수를 'export function' 으로 두고 내부 async 구현에 위임한다 (수용 기준의 grep 형태 유지)"

patterns-established:
  - "서버가 넘기는 randInt(k) 의 반환값을 [0,k) 정수로 검사해 잘못된 난수원을 거부한다"
  - "공유 데이터는 title·text·url 만, url 은 buildRoomLink 형식뿐 — 토큰은 어디에도 들어가지 않는다"

requirements-completed: [ROOM-01, ROOM-02, ROLE-01, GAME-01]

coverage:
  - id: D1
    description: "닉네임이 NFC·공백 정리 후 grapheme 1~8 만 받고, 빈 값 EMPTY·9글자 TOO_LONG·제어/영폭/방향/줄바꿈/보이는 글자 없음 INVALID_CHARS 이며 이모지 ZWJ 시퀀스는 글자 1개로 센다"
    requirement: ROOM-02
    verification:
      - kind: unit
        ref: "test/unit/nickname.test.ts (정상 입력 7, 거부 8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "닉네임 중복 키가 NFKC+소문자라 Minsu·minsu·전각 ＭＩＮＳＵ 와 NFD/NFC 한글이 같은 키가 된다"
    requirement: ROOM-02
    verification:
      - kind: unit
        ref: "test/unit/nickname.test.ts#nicknameKey"
        status: pass
    human_judgment: false
  - id: D3
    description: "4~8명 각각에서 assignRoles 역할 수가 구성표와 정확히 같고 모두 역할을 받으며, 3·9·0명은 RangeError, 구성표는 ROLE_TABLE 한 곳뿐이다"
    requirement: ROLE-01
    verification:
      - kind: unit
        ref: "test/unit/roles.test.ts#assignRoles - 구성표, #범위 밖 인원"
        status: pass
      - kind: other
        ref: "grep -rln 'const ROLE_TABLE' shared src worker → shared/game/roles.ts 하나"
        status: pass
    human_judgment: false
  - id: D4
    description: "배정이 주입된 randInt 로만 섞이고 같은 시드는 같은 결과, 5명 2000회 마피아 비율이 0.15~0.25, 범위 밖 난수원은 RangeError, 모듈에 Math.random 이 없다"
    requirement: ROLE-01
    verification:
      - kind: unit
        ref: "test/unit/roles.test.ts#assignRoles - 난수"
        status: pass
      - kind: other
        ref: "! grep -rn Math.random shared/game/roles.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "seatLayout 이 내 자리를 (50, 72) scale 1 z 10 으로, 맞은편을 (50, 28) scale 0.62 z 0 으로 놓고 모든 폰에서 둘러앉은 순서와 좌우 대칭이 같다"
    requirement: ROOM-01
    verification:
      - kind: unit
        ref: "test/unit/seatLayout.test.ts (mySeat 0~7 전부)"
        status: pass
    human_judgment: true
    rationale: "좌표 공식은 테스트로 증명했지만 타원 크기(rx 40, ry 22)·스케일 범위가 보기에 자연스러운지는 01-06 테이블 화면에서 눈으로 판단한다"
  - id: D6
    description: "estimateOffset 이 최소 왕복 표본으로 serverNow + rtt/2 − t1 을 돌려주고 표본 없으면 0, remainingMs 는 0 아래로 내려가지 않는다"
    requirement: GAME-01
    verification:
      - kind: unit
        ref: "test/unit/clock.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "shareRoom 이 shared / cancelled(AbortError) / copied / manual 을 정해진 순서로 돌려주고 공유 데이터는 title·text·url 뿐이며 링크는 {origin}/r/{코드}, 문구는 방장 닉네임과 코드뿐이다"
    requirement: ROOM-01
    verification:
      - kind: unit
        ref: "test/unit/share.test.ts"
        status: pass
    human_judgment: true
    rationale: "실제 카카오톡 공유 시트와 HTTPS 환경의 navigator.share 동작은 배포 주소에서 실제 폰으로 확인하는 수동 UAT 다(리서치 Pitfall 6)"

duration: 3min
completed: 2026-10-22
status: complete
---

# Phase 1 Plan 03: 방·역할 순수 규칙 5묶음 Summary

**닉네임(NFC·grapheme·NFKC 중복 키), 4~8명 역할 구성표와 주입 난수 Fisher–Yates 배정, 내 자리가 맨 아래로 오는 원근 타원 좌표, 최소 왕복 시계 오프셋, Web Share→클립보드→수동 3단 공유를 RED→GREEN 으로 만든 DOM 비의존 순수 함수 모듈**

## Performance

- **Duration:** 약 3분 (2026-10-22T01:26:39Z ~ 01:29:14Z)
- **Tasks:** 3 (모두 `tdd="true"`)
- **Files modified:** 11 (신규 11, 수정 0)
- **Commits:** 6 (태스크당 test → feat)

## Accomplishments

- 닉네임 규칙(D-06)이 `shared/nickname.ts` 한 파일에 모였다. 서버(01-04)와 입장 화면(01-05)이 같은 검증을 쓴다. 이름 위장에 쓰이는 영폭 공백·방향 제어 문자는 거부하고, 이모지를 잇는 U+200D 만 예외로 둔다.
- 역할 구성표(ROLE-01)가 `ROLE_TABLE` 한 곳에만 있고, 배정은 주입된 `randInt` 로만 섞인다. 5명 2000회 시드 실행에서 각 플레이어의 마피아 비율이 0.15~0.25 안에 들어온다.
- 자리 배치(D-09, D-24)가 `slot = (seat − mySeat + 8) mod 8` 공식으로 모든 폰에서 같은 둘러앉은 순서를 보장한다. 01-06 테이블 부품이 반환값을 그대로 `left/top` 에 쓰면 된다.
- 시계(GAME-01 표시)와 공유(ROOM-01)가 전역 `Date.now` 기본값 외에는 전역을 읽지 않는 순수 함수라 node 단위 테스트로 증명된다.
- `npm run typecheck` 통과: `shared/` 파일이 앱·워커 두 구성 모두에서 컴파일된다. unit 프로젝트 전체 9 파일 92 테스트 통과(이 계획 5 파일 77 테스트).

## TDD 사이클

### Task 1 닉네임
- **RED:** 17개 테스트. 자리표시 구현(입력을 그대로 돌려줌)에서 15개가 단언 실패(예: key 가 `Minsu` 대신 `minsu` 를 기대). 모듈 없음·문법 오류가 아니라 계획한 단언에서 실패. 의미 평가: 대상 테스트가 실제로 실행되고 계획된 규칙 위반 때문에 실패했다.
- **GREEN:** NFC → trim → `\p{Zs}+` 압축, `\p{Cc}\p{Zl}\p{Zp}\p{Cf}`(ZWJ 제외) 거부, 보이는 글자 검사, `Intl.Segmenter` grapheme 수, NFKC+소문자 키.
- **REFACTOR:** 없음.

### Task 2 역할
- **RED:** 22개 중 17개가 단언 실패(자리표시 `assignRoles` 가 빈 Map 반환). `seededRandInt` 테스트는 도우미가 실제 구현이라 통과(의도). 의미 평가: 구성표 개수·비율·RangeError·난수원 방어 단언에서 실패했다.
- **GREEN:** 구성표대로 풀을 만들고 Fisher–Yates(`j = randInt(i + 1)`) 후 입력 순서대로 짝짓기. 반환값 범위 검사 추가.
- **REFACTOR:** 없음.

### Task 3 자리·시계·공유
- **RED:** 38개 중 33개가 단언 실패(자리표시 구현은 0 좌표, 오프셋 0, 빈 문자열, `"manual"`). 의미 평가: 세 모듈 모두 계획된 값 단언에서 실패했다.
- **GREEN:** 리서치 Pattern 7 공식, Pattern 5 오프셋, Pitfall 6 순서(canShare 거짓/없음, AbortError 구분, 클립보드 실패 시 manual).
- **REFACTOR:** 없음.

## Task Commits

1. **Task 1: 닉네임** — RED `e2bfc70` (test) → GREEN `ae38bb2` (feat)
2. **Task 2: 역할** — RED `6bcf476` (test) → GREEN `d78c0e1` (feat)
3. **Task 3: 자리·시계·공유** — RED `f340eb2` (test) → GREEN `3c0c721` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신 커밋 (docs: complete plan)

## TDD Gate Compliance

세 태스크 모두 `test(01-03)` 커밋이 같은 태스크의 `feat(01-03)` 커밋보다 먼저 있다(`git log --grep` 으로 test 3개, feat 3개 확인). RED/GREEN 게이트 위반 없음. 계획 검증에 쓰인 RED 증거는 `gsd_run check tdd-red-evidence` 분류기가 아니라 vitest 콘솔 출력의 단언 실패를 직접 확인한 것이다(`gsd_run` 셸 함수가 이 환경에 없어 분류기를 돌리지 못했다). 의미 평가는 위 TDD 사이클에 기록했다.

## Files Created/Modified

- `shared/nickname.ts` - 닉네임 정규화·검증·중복 키
- `shared/game/roles.ts` - 역할 ID, ROLE_TABLE, assignRoles
- `shared/seatLayout.ts` - 원근 타원 자리 좌표
- `src/net/clock.ts` - 시계 오프셋과 남은 시간
- `src/net/share.ts` - 3단 공유와 링크·문구 빌더
- `test/helpers/seededRandom.ts` - mulberry32 시드 난수
- `test/unit/{nickname,roles,seatLayout,clock,share}.test.ts` - 단위 테스트 5개

## Decisions Made

- `normalizeNickname` 의 공백 압축은 `\s+` 가 아니라 `\p{Zs}+` 다. 계획 문구는 `\s+` 였지만 그대로 쓰면 줄바꿈·탭이 공백으로 바뀌어 `"a\nb"` 가 통과해 behavior(INVALID_CHARS)와 충돌한다. 탭·줄바꿈(Cc)은 그대로 두고 금지 문자 검사가 거부한다.
- 중복 플레이어 ID 는 `assignRoles` 에서 RangeError 로 막는다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 공백 압축을 `\s+` 로 하면 줄바꿈이 통과한다**
- **Found during:** Task 1 GREEN 설계
- **Issue:** 계획 action 의 "공백류 연속(`\s+`)을 공백 하나로"를 그대로 구현하면 `"a\nb"` 가 `"a b"` 로 정규화되어 INVALID_CHARS 가 되어야 할 입력이 통과한다.
- **Fix:** 압축 대상을 `\p{Zs}+`(일반 공백류) 로 좁혔다. 탭·줄바꿈은 정규화에서 건드리지 않고 금지 문자 검사가 거부한다. 앞뒤 공백은 `trim()` 이 지운다.
- **Files modified:** `shared/nickname.ts`
- **Commit:** `ae38bb2`

**2. [Rule 2 - Missing Critical] 중복 플레이어 ID 방어**
- **Found during:** Task 2 GREEN
- **Issue:** 입력에 같은 ID 가 두 번 있으면 결과 Map 이 조용히 줄어 "모든 플레이어가 역할을 받는다"는 불변식이 깨진다.
- **Fix:** `new Set(playerIds).size !== count` 이면 RangeError. 테스트 1개를 GREEN 커밋에 함께 추가했다.
- **Files modified:** `shared/game/roles.ts`, `test/unit/roles.test.ts`
- **Commit:** `d78c0e1`

**3. [Rule 3 - Blocking] 수용 기준 grep 형태에 맞춰 `shareRoom` 선언을 바꿈**
- **Found during:** Task 3 수용 기준 검증
- **Issue:** `async function shareRoom` 이라 `grep -q "export function shareRoom"` 가 실패했다.
- **Fix:** 공개 함수는 `export function shareRoom(): Promise<ShareOutcome>`, 내부 `runShare` 에 위임. 동작 변화 없음.
- **Files modified:** `src/net/share.ts`
- **Commit:** `3c0c721`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** 동작은 계획의 behavior 와 같거나 더 엄격하다. 범위 확대 없음.

## Issues Encountered

- `gsd_run` 셸 함수가 없어 TDD RED 증거 분류기(`check tdd-red-evidence`)와 `windows append` 를 쓰지 않았다. 상태 갱신은 `node gsd-tools.cjs` 직접 호출로 진행했다.
- `test/unit/seatLayout` 의 좌표 비교는 부동소수 오차 때문에 `toBeCloseTo` 를 썼다.

## Authentication Gates

없음.

## User Setup Required

없음.

## Known Stubs

없음. RED 커밋의 자리표시 구현은 모두 GREEN 커밋에서 실제 구현으로 교체되었다.

## Threat Flags

없음. 계획의 위협 모델(T-01-10 난수 주입·범위 검사, T-01-11 닉네임 위장 문자 거부와 NFKC 키, T-01-12 공유 데이터 title·text·url 한정, T-01-SC 새 패키지 없음)을 모두 코드와 테스트로 처리했다.

## Next Phase Readiness

- 01-04(대기실 규칙)가 `validateNickname`·`nicknameKey` 로 서버 쪽 중복 검사를, 01-05 가 같은 검증을 입력창에, 01-06 이 `seatLayout`·`shareRoom`·`buildRoomLink`·`buildShareText` 를, 01-07/01-08 이 `assignRoles`(+ `worker/random.ts` 의 `cryptoRandInt`)를, 01-09 가 `estimateOffset`·`remainingMs` 를 그대로 가져다 쓴다.
- 01-02 는 Task 1 트레이서까지 커밋되고 Task 2(Cloudflare 로그인 human-action)에서 멈춘 상태다. 이 계획은 01-02 파일을 건드리지 않았다.

## Self-Check: PASSED

- 신규 파일 11개 존재 확인, 커밋 6개(`e2bfc70`, `ae38bb2`, `6bcf476`, `d78c0e1`, `f340eb2`, `3c0c721`)가 HEAD 의 조상임을 확인했다.
- 수용 기준(`Intl.Segmenter`·`normalize("NFKC")` grep, 워커 구성 tsc, `ROLE_TABLE` 한 곳, `Math.random` 없음, 세 export 함수 grep, 전역 `navigator.` 없음, `--project unit` exit 0)과 계획 검증(5 파일 77 테스트, `npm run typecheck`)을 모두 통과했다.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-22*
