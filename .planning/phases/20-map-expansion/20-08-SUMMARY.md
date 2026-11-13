---
phase: 20-map-expansion
plan: "08"
subsystem: e2e
tags: [map, town, e2e, tm1-tm10, roof-tap, door-fade, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-03 서버 시야·문 프레임 / 20-05 __mfTown·__mfMap 훅 / 20-06 문 연출·지붕 두 번 누르기·data-door / 20-07 확장판 방장 줄([맵] 없음)·railMapsOn"
provides:
  - "scripts/e2e/town.mjs — town-walk(폰 6종)·town-room·town-sight·town-ghost·town-reduced 와 방 들어가기·나오기·걷기 도우미"
  - "scripts/e2e/lib.mjs — townChecks(map·room·exit·sight·roof·owners·ghost·walk·reduced, TM1~TM10)와 TOWN_E2E 사본"
  - "test/unit/e2eContract.test.ts — TOWN_E2E 가 TOWN_ROOMS·TOWN_ROOM_OUTER·panBoxOf(town)·CUTAWAY_MS·DOOR_FADE_MS 와 같음을 고정"
  - "flows.mjs openGame 의 beforeStart 훅(시작 직전 대기실 화면 읽기)"
affects: [20-09, 20-10]

actuals:
  tokens: 11300
  tasks: 3
  commits: 4

plan_head_before: 3720677f9cc7e14e0a26148a688ab808bbbf1813
plan_head_after: cb13d9ff638e15760d941a5cc22f5a34e917f3ca
commits: 4

tech-stack:
  added: []
  patterns:
    - "방 들어가기 도우미는 지붕(높이 2.36) 위 점을 시선 방향으로 민 바닥 점의 화면 좌표로 눌러 두 번 누르기(문 앞 링 → 방 안)를 재현한다. 지붕이 화면 밖이면 문 앞에서 광장 쪽으로 2.5 나간 자리(staging)까지 먼저 걷는다"
    - "문 연출 감시는 밖 탭의 DOM(data-door)·seats() 를 MutationObserver + 4ms 간격으로 따로 재서 시각을 순수 판정(townChecks sight)에 넘긴다"

key-files:
  created:
    - scripts/e2e/town.mjs
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - test/unit/e2eContract.test.ts

key-decisions:
  - "TM5 의 「seats() 에서 빠지기 전에 vanish」는 같은 프레임 안(허용 100ms) 시작 + 길이 0.15~0.4초로 판정한다 — seats() 는 서버 프레임으로 정해지는 저장소 값이라 좌석이 빠지는 프레임에 연출이 시작되기 때문이다"
  - "TM6(지붕 한 번 누름 → 링이 문 앞)은 누를 때 내 자리가 문 앞에서 1.0 보다 멀 때만 잰다. 방마다 staging 자리에서 시작해 이 전제를 항상 만든다"

requirements-completed: [D-10, D-11, D-14, D-15, D-19, D-21, D-22]

coverage:
  - id: E1
    description: "TM1~TM3·TM6·TM7: 확장판 대기실은 bar, 시작 뒤 두 페이지 모두 town 이고 서버 view.map 도 town. 방 넷 모두 지붕 두 번 누르기로 들어가면 zone·open 이 그 방, 0.3초 뒤 roofs 가 그 방 0·나머지 1, 나오면 plaza·open 빔·roofs 전부 1. 첫 누름의 링은 문 앞 칸, owners 는 좌석 수"
    requirement: "D-10"
    verification:
      - kind: e2e
        ref: "town-room 390x844 26/26 (로컬)"
        status: pass
    human_judgment: false
  - id: E2
    description: "TM4·TM5: 방장이 우체국에 들어가면 밖 탭에서 data-door=vanish 가 좌석이 빠지는 프레임(+12ms)에 시작해 203ms 간 가고 그 뒤 seats()·이름표에 없다. 같은 방 두 탭은 서로 보이고 나올 때 appear"
    requirement: "D-14"
    verification:
      - kind: e2e
        ref: "town-sight 390x844 7/7 (로컬)"
        status: pass
    human_judgment: false
  - id: E3
    description: "TM8: 유령 화면과 결과 화면(방장·참가자)에서 open 길이가 4(방 네 개 모두)"
    requirement: "D-11"
    verification:
      - kind: e2e
        ref: "town-ghost 390x844 8/8 (로컬)"
        status: pass
    human_judgment: false
  - id: E4
    description: "TM9: 폰 6종에서 우체국 문 앞까지 한도(10초) 안에 걸어 도착하고 내 이름표가 스테이지 안, 이름표 겹침 0쌍(참고)"
    requirement: "D-21"
    verification:
      - kind: e2e
        ref: "town-walk 폰 6종 각 7/7 (로컬)"
        status: pass
    human_judgment: false
  - id: E5
    description: "TM10: 모션 줄이기에서 방에 들어가면 zone 이 바뀐 틱에 그 방 roofs 0, 들어갈 때·나올 때 door 연출 0"
    requirement: "D-15"
    verification:
      - kind: e2e
        ref: "town-reduced 390x844 5/5 (로컬)"
        status: pass
    human_judgment: false
  - id: E6
    description: "확장판이 마을이 된 뒤 기존 아홉 흐름이 390x844 로컬에서 통과한다(실패 0)"
    requirement: "D-21"
    verification:
      - kind: e2e
        ref: "아래 영향 흐름 표 — 흐름 12개(아홉 + --only 부분 일치로 함께 돈 셋) 모두 통과"
        status: pass
    human_judgment: false
  - id: E7
    description: "사본 상수(방 윤곽·안쪽·문 앞·방 안 자리·마을 PAN·CUTAWAY_MS·DOOR_FADE_MS)가 앱 상수와 대조된다"
    requirement: "D-22"
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#마을 E2E 사본 상수 TOWN_E2E 와 앱 값 (3건)"
        status: pass
    human_judgment: false
---

# Phase 20 Plan 08: 마을 E2E Summary

**마을 판정 TM1~TM10 을 순수 함수(townChecks)로 고정하고, 지붕 두 번 누르기로 방 넷을 드나드는 마을 흐름 다섯을 로컬에서 돌려 전부 통과시켰으며, 확장판이 마을로 바뀐 뒤의 기존 아홉 흐름도 390×844 에서 회귀 없이 통과함을 확인했다. 앱은 고치지 않았다.**

## Performance

- Duration: 약 1.5시간 (판정·흐름 작성, 지붕 누르기 좌표 조사, 회귀 실행 포함)
- Tasks: 3 (Task 1 TDD)
- Commits: 4 (아래), 문서 커밋은 별도

## 마을 흐름 결과 (로컬 개발 서버, `node scripts/e2e/run.mjs --url http://localhost:5173 --only town` 한 번에 121초)

| 흐름 | 크기 | 통과/전체 | 판정 |
|---|---|---|---|
| town-walk | 360x640 · 390x664 · 430x932 · 360x560 · 390x844 · 402x874 | 각 7/7 | TM1w·TM9·TM9s·TM9i·TM9t(참고) |
| town-room | 390x844 | 26/26 | TM1·TM1v·TM0·TM7·방 넷 × (TM6·TM2·TM3·시간 참고 둘) |
| town-sight | 390x844 | 7/7 | TM4·TM4s·TM5·TM5a·TM5t(참고) |
| town-ghost | 390x844 | 8/8 | TM8m·TM8(유령)·TM8(결과 방장·참가자 둘) |
| town-reduced | 390x844 | 5/5 | TM10·TM10d·TM10x |

실패 0, 재시도 0. 처음 통과하기까지는 흐름 도우미의 문제(아래 "구현이 정한 것")를 세 번 고쳤고, 앱 결함은 없었다.

실측 참고값(390x844): 방에 드는 데 5.4~7.3초(걷기 포함), 나오는 데 0.4초, 밖 탭 문 연출 vanish 203ms(좌석이 빠진 뒤 12ms 에 시작), 이름표 겹침 모든 폰 0쌍.

## 영향 흐름 결과 — 확장판이 마을로 바뀐 뒤 (`--sizes 390x844`, 흐름 id 부분 일치)

`--only` 는 id 부분 문자열 일치라 아홉 흐름과 함께 이름이 겹치는 흐름도 돌았다. 모두 통과했다.

| 묶음 | 흐름 | 크기 | 통과/전체 |
|---|---|---|---|
| A (38초) | errand | 390x844 | 27/27 |
| | witness | 390x844 | 13/13 |
| | trace | 390x844 | 53/53 |
| B (96초) | world | 390x844 | 23/23 |
| | day | 390x844 | 116/116 |
| | ghost | 390x844 | 94/94 |
| | town-ghost(이름 겹침) | 390x844 | 8/8 |
| C (123초) | night | 390x844 | 147/147 |
| | night-sizes(이름 겹침) | 390x844 | 50/50 |
| | sound-night-parity(이름 겹침) | 390x844 | 20/20 |
| | avatar-phases-night(이름 겹침) | 390x844 | 5/5 |
| | tutorial-together | 390x844 | 34/34 |
| D (53초) | result | 390x844 | 27/27 |
| | result-reveal(이름 겹침) | 390x844 | 34/34 |
| | sound-result(이름 겹침) | 390x844 | 17/17 |
| | result-rematch(이름 겹침, 고정 크기) | 360x560 | 19/19 |

알려진 간헐 실패(errand·perfbudget)는 이번 실행에서 나타나지 않았다. 흐름을 고치거나 판정 문턱을 낮춘 곳은 없다.

## RED 증거

- **Task 1 RED** (`6a5b08c7`): `node --test --test-reporter=tap scripts/e2e/lib.test.mjs` → `# fail 1`, `SyntaxError: The requested module './lib.mjs' does not provide an export named 'TOWN_E2E'`(townChecks·TOWN_E2E 없음). `npx vitest run test/unit/e2eContract.test.ts --reporter=tap-flat` → **not ok 20·21·22**(`TypeError`, 마을 사본 상수 대조 3건 — TOWN_E2E 가 없어 읽을 수 없음).
- **GREEN** (`b45ec428`): lib.test 465건 통과·실패 0, e2eContract 101건 통과.

## Task Commits

1. `6a5b08c7` test(20-08): 마을 E2E 판정 실패 시험
2. `b45ec428` feat(20-08): 마을 E2E 판정·사본
3. `edd4b2e3` feat(20-08): 마을 E2E 흐름 다섯 (TM5 판정 보정·extraSizes 목록 시험 포함)
4. `cb13d9ff` refactor(20-08): 방 들어가기 도우미의 쓰지 않는 줄 정리

## Deviations from Plan (계획과 달라진 점)

### 판정을 현실에 맞춘 것

1. **TM5 「seats() 에서 빠지기 전에 vanish」** — `__mfWorld.seats()` 는 서버 프레임으로 정해지는 저장소 값(`store.seats()`)이라 좌석이 빠지는 프레임에 연출이 시작된다. 「빠지기 전」을 문자 그대로 비교하면 같은 프레임이라 앞뒤가 정해지지 않는다. 처음 구현은 이 비교를 `vanishAt ≤ goneAt` 로 했는데 `goneAt` 을 vanish 가 보인 뒤에만 재서 늘 참이 되는 약한 판정이었다. 감시를 둘로 나눠(좌석이 빠진 시각·vanish 시작·끝) 판정을 **vanish 가 좌석이 빠진 뒤 100ms 안에 시작 + 길이가 DOOR_FADE_MS 의 0.75~2배**로 바꿨다(실측 12ms 뒤 시작·203ms 길이). 팝 아웃(연출 없이 사라짐)이나 연출이 한참 늦는 경우는 이 판정이 잡는다. lib.test 에 지연·길이 이상·미종료 사례를 고정했다.
2. **TM6 전제** — 첫 누름의 링은 누를 때 내 자리가 문 앞에서 1.0 보다 멀 때만 문 앞 칸이다(가까우면 곧바로 방 안). 흐름은 지붕이 안 보이면 문 앞에서 광장 쪽으로 2.5 나간 자리(staging)까지 걸어 이 전제를 만든다. 전제가 안 맞으면 TM6 을 조용히 건너뛰지 않고 실패로 적는다.

### 구현이 정한 것

3. **방 들어가기 도우미** — 계획은 「닫힌 방 지붕 가운데의 화면 점」이라 했으나 390x844 낮 토론 카메라는 내 몸 둘레 약 ±4 월드 단위만 보여 광장 한복판에서는 어느 방 지붕도 화면에 없다(진료소 지붕은 문 앞에서 2.5 나가야 아래쪽 입력 패널 위로 보인다). 그래서 지붕 점 후보(방 바깥 윤곽을 0.4 간격, 가운데부터)를 시선 방향으로 민 바닥 점의 화면 좌표로 바꿔 **보이는 첫 점**을 누르고, 링이 문 앞(또는 방 안)이 아니면(시계탑 등에 막힘) 다음 후보를 누른다.
4. **방에서 나오기** — 카메라가 방 안 내 몸을 따라가 문 앞 쪽 광장이 화면 가장자리라, 우체국·경찰서(앞벽 걷힘)는 문 앞 0.5 지점, 술집·진료소(문이 뒷벽)는 시선이 벽 위로 지나는 2.5 이상 나간 지점을 보이는 대로 누르고 링이 그 점이 아니면(벽을 눌러 링이 방 안) 다음 점을 쓴다.
5. **걷기 도우미** — 보이는 바닥 점 중 목표에 가장 가까운 점을 누르고 「목표 도착 또는 멈춤」까지만 기다린다. 처음에는 목표 도착만 기다려 중간 점으로 걷는 동안 6초씩 낭비했다(진료소가 12초 한도를 넘음). 같은 자리에서 세 번 멈추면 포기한다.
6. **town-walk 한도** — 계획의 「걷는 속도 1.8 × 거리 + 여유」 대신 문 앞까지 10초 고정 한도를 썼다(실측 수 초 이내 — TM9t 참고 줄). 한도 숫자는 흐름 파일 한 곳(WALK_LIMIT_MS)이고 판정은 townChecks 가 한다.
7. **openGame 에 `beforeStart`** — 시작 직전 대기실의 `__mfMap` 을 두 페이지에서 읽으려고(TM1: 대기실 bar) 선택 인자를 더했다. 다른 흐름에는 영향이 없다.
8. **town-ghost 가 결과까지** — 유령 화면(TM8) 뒤 봇 지목을 other 로 바꿔 결과까지 넘겨 결과 화면(방장·참가자)도 같은 판정으로 본다.
9. **extraSizes 목록 시험** — lib.test 의 FLOWS 폰 6종 목록에 town-walk 를 더했다(`run.mjs` 가 그 목록을 FLOWS 원문과 대조한다).

### 앱 수정

없음. 마을 화면(방·집·지붕·간판, 컷어웨이, 이름표)이 시안과 크게 어긋나거나 진행에 지장이 있는 곳은 이번 E2E 와 확인용 스크린샷(저장소 밖 scratchpad)에서 보이지 않았다. 헤드리스 소프트웨어 GL 이라 프레임 끊김은 판단하지 못한다(20-09 몫).

## 화면에서 본 것

- 390x844 낮 토론의 카메라는 내 몸 둘레만 보여 준다(광장 가운데의 시계탑·석상 의자, 가로등, 집·방 모서리). 방 지붕은 광장 가장자리 쪽으로 걸어가야 화면에 들어온다 — 지붕을 눌러 들어가는 길이 「걸어가서 누르기」 두 번이다.
- 우체국 안: 컷어웨이로 지붕·앞벽이 걷히고 카운터·상자·불빛이 보이며 내 이름표만 있다. 문 쪽 광장이 화면 왼쪽 가장자리라 나올 때는 문 앞 0.5 지점을 누르는 편이 잘 보인다.

## 20-09 (성능 측정)가 알아야 할 것

- `perf-run.mjs --map town` 은 판 종류를 바꾸지 않는다(확장판 = 마을). 낮 토론 마을 카메라는 가까이 비춘다 — 방 지붕이 화면에 들어오는 위치(문 앞에서 광장 쪽 2.5)에서 측정하면 방·집·시계탑이 함께 그려지는 장면을 본다.
- 이 계획의 E2E 는 소프트웨어 GL 헤드리스라 끊김·fps 의 근거가 되지 못한다.

## 20-10 에 넘기는 것 (폰 6종 전체 회귀)

- 마을 흐름은 `--only town` 한 명령(121초)이면 다섯이 모두 돈다. town-walk 만 폰 6종(`--sizes` 를 주지 않으면 6종 자동)이고 나머지는 390x844 고정이다. 폰 6종 전체 회귀에서 town-walk 와 아래를 보면 된다.
- 영향 흐름 아홉은 390x844 만 확인했다. 폰 6종 확인이 필요한 것은 errand·witness·trace·world·day·ghost·night-sizes·result-reveal·tutorial-solo(extraSizes). 360x560 은 알려진 한계(방장 대기실 접힌 줄과 위 알림 겹침 fold-toast)가 그대로다.
- `--only` 는 id 부분 문자열 일치라 `ghost` 가 `town-ghost` 도, `night` 가 `night-sizes`·`sound-night-parity`·`avatar-phases-night` 도, `result` 가 `result-reveal`·`result-rematch`·`sound-result` 도 같이 고른다(시간이 늘 때 유의).
- 알려진 간헐(errand·perfbudget B2·M1)은 이번 실행에서 재현되지 않았다. 재현되면 해당 흐름만 다시 돌려 가른다.
- 지붕 누르기 도우미(`town.mjs` enterRoom)는 화면 크기에 의존한다. 390x844 밖에서 방 들어가기를 보려면 staging 자리(문 앞에서 광장 쪽 2.5)에서 지붕 점이 스테이지 안에 드는지 먼저 본다.

## 검증 결과

| 명령 | 결과 |
|---|---|
| `node --test scripts/e2e/*.test.mjs` | 603 통과 · 실패 0 |
| `npx vitest run test/unit/e2eContract.test.ts` | 101 통과 |
| `node scripts/e2e/run.mjs --url http://localhost:5173 --only town` | 위 마을 흐름 표, 실패 0 |
| 영향 흐름 네 묶음 (`--sizes 390x844`) | 위 영향 흐름 표, 실패 0 |
| 원격 레포 위생 git grep (바뀐 파일) | 결과 0 |

배포본은 쓰지 않았다(로컬 개발 서버만).

## Threat Flags

없음 — T-20-26(결과 줄에 닉네임·토큰 없음: 좌석·방 id·숫자만)·T-20-27(로컬 개발 서버만)·T-20-28(문턱은 townChecks 한 곳, 흐름은 낮추지 않음)을 지켰다. 새 끝점·인증 경로·파일 접근 없음.

## Known Stubs

없음.

## Self-Check: PASSED

- `scripts/e2e/town.mjs` 존재, 커밋 4개(`6a5b08c7`·`b45ec428`·`edd4b2e3`·`cb13d9ff`) 모두 HEAD 의 조상.
