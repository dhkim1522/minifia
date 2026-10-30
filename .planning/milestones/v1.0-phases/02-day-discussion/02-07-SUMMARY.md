---
phase: 02-day-discussion
plan: 07
subsystem: client-ui
tags: [table, seat-float, claim-tag, chip, icon, motion, reduced-motion, tdd, client]

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 Claim·EmojiId 타입, 02-06 의 BUBBLE_MS·EMOJI_MS·useSeatFloats(수명 규칙과 elapsedMs)
provides:
  - Icon 11개(plus·skip·chat + 임시 형태 이모티콘 smile·grin·surprised·suspicious·angry·sad·heart·exclaim)
  - SeatFloat·SeatFloatProps — 머리 위 말풍선(3초)·이모티콘 원(2초)·공개 연출 말풍선(팝+흔들림, 말 안 함은 흐림)
  - ClaimTag·claimName — 이름표 아래 주장 알약("· 말 바꿈" 포함)
  - Chip — aria-pressed 토글 칩, .mf-chips 줄(줄바꿈, 가로 스크롤 없음)
  - Table 확장 — TableSeat.done·claim({job, changed})·float, TableFloat 유니온, 자리 라벨 접미 3종
  - seat.css·chip.css
affects: [02-08, 02-09, 02-10, 02-11]

tech-stack:
  added: []
  patterns:
    - "머리 위 층 위치는 --mf-float-left 변수로 넘기고 CSS 가 left 에 쓴다 — clamp() 를 인라인 left 에 쓰면 happy-dom 이 값을 버려 테스트가 읽을 수 없다"
    - "한 요소에 팝·흔들림·유지 애니메이션을 겹칠 때 팝은 개별 속성 scale, 흔들림은 translate, 흐림은 filter opacity() 로 transform·opacity 다툼을 피한다"
    - "축소 모션: 전역 규칙이 길이를 0.01ms 로 줄이므로 사라짐을 (수명 − 지난 시간) 만큼 미룬 순간 전환(mf-float-vanish)으로 쓴다"
    - "key 가 바뀌면 층이 다시 마운트되어 애니메이션이 새로 시작된다(`f{seat}:{float.key}`)"

key-files:
  created:
    - src/components/SeatFloat.tsx
    - src/components/ClaimTag.tsx
    - src/components/Chip.tsx
    - src/styles/seat.css
    - src/styles/chip.css
    - test/client/chip.test.tsx
  modified:
    - src/components/Icon.tsx
    - src/components/Table.tsx
    - test/client/table.test.tsx

key-decisions:
  - "공개된 주장의 props 이름은 job 이다 — Table 소스에 역할 필드(role 키)가 없다는 grep 게이트와 타입 테스트로 지킨다"
  - "완료 알약은 .mf-float 가 아닌 .mf-done-layer 층에 같은 좌표로 그린다 — .mf-float 개수가 '떠 있는 것' 개수로만 읽히게 한다"
  - "자리 라벨 접미 순서는 연결 끊김, 선택 완료, 직업 주장 {직업}, 말 바꿈; 'none' 주장은 '직업 주장 말 안 함'"
  - "말 안 함 흐림은 opacity 가 애니메이션에 쓰이므로 filter: opacity(.6) 으로 낮춘다"

patterns-established:
  - "RED 가 import 오류(모듈 없음)가 되지 않도록 빈 자리표시자(Chip=null, 빈 chip.css)를 test 커밋에 함께 담는다 — 02-06 은 작업 트리에만 뒀으나 신규 파일이 import 되는 테스트라 커밋에도 필요"

requirements-completed: [DAY-02, COMM-01, COMM-02]

actuals:
  tokens: 7952
  tasks: 3
  commits: 6
plan_head_before: ffacfa038fba09e7055215fcfded8ba9f0db81c3
plan_head_after: 50885944a25a05c52da7223875583cb604bffaa1
commits: 6

coverage:
  - id: G1
    description: "Icon 11개가 24×24 svg 로 그려지고, Table 자리마다 말풍선·이모티콘·공개 말풍선이 머리 위 층에 aria-hidden 으로 뜨며 위치(clamp 가둠, 앞 headTop−1%·뒤 headTop−8%)·z 순서(이름표 25 위)·재접속 음수 delay 가 규격대로다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/client/table.test.tsx#Icon 11개 추가, SeatFloat 층"
        status: pass
    human_judgment: false
  - id: G2
    description: "완료 알약과 주장 알약(말 바꿈 포함)이 규격 위치·순서로 그려지고 자리 접근성 이름에 상태가 반영되며, 끊긴 자리도 그대로 보이고, 뒤쪽 이름표가 5% 더 올라가며, 진홍·역할 키가 없다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/client/table.test.tsx#완료 알약, ClaimTag 주장 알약"
        status: pass
    human_judgment: false
  - id: G3
    description: "Chip 이 aria-pressed·체크 아이콘·disabled·type button 으로 동작하고 칩 줄은 줄바꿈하며 가로 스크롤을 쓰지 않는다"
    requirement: "COMM-02"
    verification:
      - kind: unit
        ref: "test/client/chip.test.tsx"
        status: pass
      - kind: command
        ref: "npm run typecheck && npx vitest run --project client"
        status: pass
    human_judgment: false
  - id: G4
    description: "말풍선·이모티콘·공개 연출의 실제 모션(등장·퇴장 180ms, 팝 360ms 뒤 흔들림 400ms, 2000ms 유지), 축소 모션에서 사라지는 시각, 실기기 폭 360px 에서 가장자리 자리 말풍선 잘림·겹침은 jsdom 계열 테스트로 볼 수 없다"
    requirement: "COMM-01"
    verification: []
    human_judgment: true
    rationale: "CSS 키프레임 타이밍과 화면 겹침은 happy-dom 이 계산하지 않는다. 02-11 의 실기기 UAT(backstop)가 확인한다."

duration: 6min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 07: 테이블 위 완료·주장·말풍선·칩 부품 Summary

**Table 이 자리마다 머리 위 말풍선·이모티콘·공개 연출 말풍선과 완료 알약, 이름표 아래 주장 알약(말 바꿈 포함)을 역할 없이 그리고, aria-pressed 토글 Chip 과 Icon 11개를 더했다.**

## Performance

- **Duration:** 약 6분 (벽시계 기준, 2026-10-23T18:03Z ~ 18:09Z)
- **Tasks:** 3 (트레이서 1 + 자동 2, 모두 TDD)
- **Files:** 신규 6, 수정 3
- **Commits:** 6 (test 3 + feat 3)

## Accomplishments

- **트레이서(Task 1):** Icon 에 plus·skip·chat 과 이모티콘 여덟 개(임시 형태 시안 주석, `ICONS` 항목만 바꾸면 교체)를 더했다. `SeatFloat` 이 말풍선(3초)·이모티콘 원(2초)·공개 연출 말풍선을 그리고, Table 이 자리마다 이름표 층(25)보다 위(26 + z)에 크기 변환 바깥 층을 둔다. 앞쪽 자리 `headTop − 1%`, 뒤쪽 `headTop − 8%`, 가로는 `clamp(70px, x%, calc(100% − 70px))` 로 장면 안에 갇힌다. 재접속 `elapsedMs` 는 음수 `animation-delay` 로 이어 붙는다. 트레이서 검증(table.test.tsx 40개)을 확장 작업 전에 다시 돌려 통과를 확인했다.
- **완료·주장 알약(Task 2):** `ClaimTag` 가 이름표 안 방장 배지 다음 줄에 직업 이름(굵게)과 `· 말 바꿈`(보통, `--gray-300`)을 한 알약에 담는다(최대 112px, 진홍 없음). 완료 알약은 같은 머리 위 좌표에 180ms 팝으로 뜬다. 자리 라벨에 `, 선택 완료`·`, 직업 주장 {직업}`·`, 말 바꿈` 이 붙고 끊긴 자리도 알약이 그대로다. 뒤쪽 자리는 주장 줄이 늘면 이름표가 5% 더 올라간다.
- **Chip(Task 3):** `type="button"`·`aria-pressed`·`disabled` 토글 버튼. 선택되면 체크 아이콘 18px 이 글자 앞에 오고 면이 반전된다. `.mf-chips` 줄은 `flex-wrap: wrap` 이고 가로 스크롤이 없다. 꺼짐은 1페이즈 공통 opacity .6.
- **축소 모션:** 전역 규칙이 모든 애니메이션 길이를 0.01ms 로 줄이면 말풍선이 나타나자마자 사라지는 문제가 생겨, 축소 모션에서는 `(수명 − 지난 시간)` 지연 뒤 순간 전환하는 `mf-float-vanish` 로 바꿨다. 팝·흔들림·등장 이동은 없다.

## Task Commits

| 작업 | RED | GREEN |
|------|-----|-------|
| 1 트레이서 말풍선·이모티콘·Icon | `ae71535` test | `6d3487f` feat |
| 2 완료·주장 알약 | `481e6eb` test | `11eee71` feat |
| 3 Chip | `26c26f4` test | `5088594` feat |

## TDD Gate Compliance

플랜 유형은 `execute` 이고 작업 단위로 `tdd="true"` 다. 세 작업 모두 `test(02-07)` → `feat(02-07)` 순서의 커밋이 있다. REFACTOR 커밋은 없다. 플랜이 `type: tdd` 가 아니라 구조화된 RED 증거 레코드 분류기(`check tdd-red-evidence`)는 돌리지 않고 단언 실패를 직접 확인했다.

- **Task 1:** 신규 19개가 값 단언 실패(예: `Unable to find an element with the text: …`, `expected '' to match …clamp…`), 기존 21개 통과. 존재하지 않는 Icon 이름은 렌더 오류로 실패한다.
- **Task 2:** 신규 11개 중 8개가 단언 실패, 3개는 이미 성립하는 회귀 보호(알약 없음, 말 바꿈 글자 없음, 진홍 없음, 역할 키 없음)로 통과.
- **Task 3:** 모듈이 없으면 import 오류라 RED 가 아니므로 `Chip`(null 반환)·빈 `chip.css` 자리표시자를 test 커밋에 함께 담아 8개 중 7개가 단언 실패하는 것을 확인했다.

## Decisions Made

key-decisions 참고. 계획 가정(뒤쪽 자리에 주장 줄이 더해지면 이름표가 한 줄(5%) 더 올라감)은 그대로 구현했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘] clamp() 를 인라인 left 에 쓰면 테스트에서 읽을 수 없다**
- **Found during:** Task 1 GREEN
- **Issue:** happy-dom 의 CSS 파서가 `left: clamp(...)`·`max(...)` 값을 통째로 버려 `style.left` 가 빈 문자열이 된다(`calc()` 만 살아남는다). 계획의 "style.left 가 clamp(70px, …%, calc(100% - 70px)) 꼴" 검증이 불가능했다.
- **Fix:** Table 이 `--mf-float-left` 사용자 정의 속성에 같은 clamp 문자열을 인라인으로 넣고 `.mf-float { left: var(--mf-float-left) }` 가 이어받는다. 브라우저 결과는 같다. 테스트는 `style.getPropertyValue("--mf-float-left")` 로 읽는다. 승인 기준 `grep "clamp(70px" Table.tsx` 는 그대로 통과한다.
- **Files modified:** src/components/Table.tsx, src/styles/seat.css, test/client/table.test.tsx
- **Commit:** `6d3487f`

**2. [Rule 1 - 버그] 내가 쓴 테스트의 잘못된 title 조회**
- **Found during:** Task 2 RED 직후
- **Issue:** 이름표 title 은 "서준 (나)" 가 아니라 닉네임 "서준" 인데 테스트가 후자로 찾아 의도와 다른 이유로 실패했다. 셸 `sed -i` 의 macOS 문법 오류로 수정이 RED 커밋보다 늦어졌다.
- **Fix:** 조회를 `getByTitle("서준")` 으로 고쳤고 수정은 Task 2 GREEN 커밋(`11eee71`)에 함께 담았다. RED 커밋(`481e6eb`)의 해당 한 테스트는 잘못된 조회로 실패했다(나머지 8개는 계획된 이유).
- **Files modified:** test/client/table.test.tsx
- **Commit:** `11eee71`

**3. [Rule 2 - 필수 누락] 축소 모션에서 말풍선이 바로 사라지는 문제**
- **Found during:** Task 1 seat.css 작성
- **Issue:** base.css 전역 축소 모션 규칙이 `animation-duration: 0.01ms !important`, `fill-mode: both` 인 애니메이션을 즉시 끝내 말풍선이 아예 보이지 않게 된다. 계획 truth("나타나고 정해진 시간 뒤 사라진다")와 어긋난다.
- **Fix:** 위 "축소 모션" 항목 참조. 수명·지난 시간은 `--mf-life`·`--mf-elapsed` 변수로 CSS 에 전달한다.
- **Files modified:** src/components/SeatFloat.tsx, src/styles/seat.css
- **Commit:** `6d3487f`

**Total deviations:** 3 (Rule 3 1건, Rule 1 1건, Rule 2 1건). **Impact:** 공개 인터페이스(`TableFloat`·`TableSeat`·`SeatFloat`·`ClaimTag`·`Chip`)는 계획과 같다.

## Known Stubs

없음. 이모티콘 여덟 개는 의도된 임시 형태 시안이며 `Icon.tsx` 의 `ICONS` 항목 위에 교체 주석(D-16)이 있다. 최종 그림은 캐릭터 톤에 맞춰 따로 만든다.

## Issues Encountered

없음. `npm run typecheck && npx vitest run --project client` 통과(15개 파일, 375개 테스트).

## Threat Flags

없음. T-02-23(역할 필드 없음 — `role[?]?:` grep 게이트와 타입 테스트), T-02-24(텍스트로만 렌더 — `<i>x</i>` 테스트), T-02-SC(새 패키지 없음) 모두 완화 확인.

## Next Phase Readiness

02-08(직업 공개 화면)·02-09(낮 토론 화면)·02-10(시트)이 `Table`·`Chip`·`.mf-chips` 를 조립할 수 있다. 화면은 공개 연출 중 `done` 을 끄고 `float: { kind: "reveal" }` 를 쓰며, 재접속 중 공개 연출은 `animate: false` 로 넘긴다. 실기기 폭 360px 에서의 가장자리 자리 말풍선 위치·겹침과 모션 타이밍은 02-11 UAT 가 확인한다.

## Self-Check: PASSED

- 신규 파일 6개(`SeatFloat.tsx`·`ClaimTag.tsx`·`Chip.tsx`·`seat.css`·`chip.css`·`chip.test.tsx`) 존재 확인
- 커밋 6개(`ae71535`·`6d3487f`·`481e6eb`·`11eee71`·`26c26f4`·`5088594`) 모두 HEAD 의 조상
- 승인 기준 전부 통과(Icon·SeatFloat·seat.css·ClaimTag·선택 완료·직업 주장·역할 필드 없음·crimson 없음·Chip·chip.css)
