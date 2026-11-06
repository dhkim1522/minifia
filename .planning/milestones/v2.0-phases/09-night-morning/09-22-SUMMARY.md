---
phase: 09-night-morning
plan: "22"
subsystem: e2e-perf
tags: [e2e, night, morning, perf, nightload, screen-map, night-morning]
status: complete

requires:
  - phase: 09-night-morning
    provides: 밤·아침 화면 표식(09-10~09-20), E2E 검사 도우미(09-21), smoke 갱신(09-19)
provides:
  - scripts/e2e/flows.mjs 의 night 흐름(암살·구출·불일치·처형 유언·경찰·피해자 + 시민 편 DOM + G/H)과 night-sizes 흐름(폰 6종 기하)
  - scripts/perf-run.mjs --mode nightload (낮·밤·아침 장면별 fps) 와 결과 JSON
  - docs/screen-map.md E2E 지도(night·9페이즈 표식·밤 패널 높이)
  - src/net/useChat.ts 카드 공개 타이머 경쟁 수정
affects: [09-23]

actuals:
  tokens: 18000
  tasks: 3
  commits: 5
plan_head_before: 772c0bf5347a4f9b24e94760b84f16d3ae69e6a0
plan_head_after: 8eea37434d09eb8b5e4cd658571aee6c6e64a03a

tech-stack:
  added: []
  patterns:
    - "시나리오마다 새 방: nightScenario 가 준비 실패(SetupError)를 그 시나리오만 다시 돈다(앞 시나리오 결과 보존)"
    - "짧은 연출은 MutationObserver 로 센다(armSeenWatch: 번쩍임·막·경찰 카드)"
    - "봇 마피아는 seat 0(방장)을 노린다 — 방장 의사 구출·4명판 피해자 시나리오가 의사 봇 없이 결정적"

key-files:
  created:
    - .planning/phases/09-night-morning/perf/nightload-390x844-x4.json
    - .planning/phases/09-night-morning/perf/nightload-390x844-x4.png
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/perf-run.mjs
    - scripts/uat-night.mjs
    - docs/screen-map.md
    - src/net/useChat.ts
    - test/client/useChat.test.tsx

key-decisions:
  - "night 는 승인 보드 폭 390×844 한 번(시나리오 + 시민 편 DOM + G/H), 폰 6종 기하는 별도 흐름 night-sizes(extraSizes)가 맡는다 — 흐름 하나를 6배로 돌리면 900초 한도에 닿는다(가정 A1 의 나눔)"
  - "줄바꿈된 얼굴 목록 + 스테이지 188 미만(360×560 경찰)의 이름표 위치만 UI-SPEC '알려진 한계(UI Considerations 45)' 참고 줄(SZ4k)로 남기고, 그 밖은 전부 판정이다. 문턱은 그대로"
  - "마피아 다가가기는 맵 탭이 아니라 일반 move 라 목적지 링(data-ring)이 안 생긴다 — 내 구간 도착 + 위치가 0.5 단위 넘게 옮겨짐으로 확인한다"

requirements-completed: []

coverage:
  - id: D1
    description: "첫 밤 마피아 방장이 다가가 봇 마피아와 확정('확정' 도장)·[쪽지] 활성 → 쪽지 저장 → 아침 분필·'{닉네임} 님이 당했습니다'·유언 카드 → 쪽지 카드 순서"
    requirement: "NIGHT-08, NIGHT-12, MORN-01, MORN-02"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only night (night/assassin NA1~NA12·MA1~MA4)"
        status: pass
  - id: D2
    description: "의사가 막은 밤 '누군가 살아났습니다'(분필·카드·번쩍임 없음), 마피아 둘 불일치 '아무 일도 없었습니다', 처형된 방장의 유언 카드(처형 단계), 경찰 결과 카드·채팅 eye 카드"
    requirement: "MORN-03, WILL-01, NIGHT-09"
    verification:
      - kind: e2e
        ref: "night/saved SV1~SV9, night/mismatch MM1~MM5, night/will WL1~WL4, night/police PL1~PL7"
        status: pass
  - id: D3
    description: "시민 편 DOM: 시민·경찰·의사 data-night-dark 같은 값, 맥박 1·이름표 내 것 하나·직업 칩 0·채팅 패널 0, 얼굴 칸 8자 이름 faceNameFits, 패널 높이 식 ±2"
    requirement: "NIGHT-07, NIGHT-09, NIGHT-10"
    verification:
      - kind: e2e
        ref: "night/dom L6, sideChecks L1~L5, faceListChecks FL1~FL3, night/victim VC11 맥박 큐 2~4"
        status: pass
  - id: D4
    description: "폰 6종에서 내 이름표 tagInStage·마피아 이름표 버튼 44×44·밤 패널 높이; 밤 마피아·시민·경찰·의사·피해자·유령·아침 화면에 G·H"
    requirement: "NIGHT-07, NIGHT-09"
    verification:
      - kind: e2e
        ref: "night-sizes 6 크기 SZ1~SZ6·PK1~PK3, night 의 gameGH 7곳"
        status: pass
  - id: D5
    description: "피해자 화면 [data-kill-fx] 한 번·'암살당했습니다'·유령 화면, 막 [data-curtain] 이 밤·아침 진입 때 나타났다 사라짐(자연 타이머)"
    requirement: "NIGHT-11"
    verification:
      - kind: e2e
        ref: "night/victim VC1·VC6~VC10"
        status: pass
  - id: D6
    description: "perf-run --mode nightload: 마피아 판·시민 판 낮·밤·아침 장면별 fps·끊김·p95 JSON(baseline 칸 55fps·끊김 5회, 판정 없음)"
    requirement: "결정 0055"
    verification:
      - kind: manual
        ref: "node scripts/perf-run.mjs --mode nightload --url http://localhost:5173 --minutes 5 --throttle 4 --size 390x844 → 평균 60.0fps·끊김 0"
        status: pass
  - id: D7
    description: "산 사람 2~8명 어느 경우에도 얼굴 칸 수·마피아 이름표 버튼·확정 판정·아침 길이가 맞다 (E10 #47)"
    requirement: "NIGHT-08, NIGHT-09"
    verification:
      - kind: backstop
        ref: "E2E 는 4명판(시민 피해자)·6명판(마피아·경찰·의사)만 돈다. 2~8명 전 범위는 worker·단위 시험이 맡는다(09-07·09-15)"
        status: not-covered-here
---

# Phase 9 Plan 22: 밤·아침 화면 E2E 와 렌더 부하 측정 Summary

**실제 Chrome 에서 첫 밤 암살→아침 분필·알림·유언·쪽지 카드, 구출·불일치·처형 유언·경찰 결과·피해자 연출과 시민 편 DOM 누설을 확인하는 night 흐름 + 폰 6종 기하 night-sizes 흐름, 낮·밤·아침 렌더 부하를 4× 감속으로 재는 perf-run nightload 모드(평균 60fps·끊김 0).**

## 수행 내용

- **Task 1 (트레이서)**: 8페이즈 밤 임시 틀 흐름(`night-roles`, NightPanel 알약 단언 포함)을 `nightFlow`(id `night`)로 바꿔 썼다. 마피아 방장 + 봇 5명(6명판)에서 봇 유언을 기다린 뒤(4.5초) 밤으로 가, 가장 낮은 seat 의 이름표를 눌러 확정·쪽지 저장·아침 분필/알림/카드 순서까지 확인한다.
- **Task 2**: 시나리오 여섯 판 — 암살(`assassin`) · 구출(방장 의사가 자기 칸, 봇 마피아가 seat 0 을 노림) · 불일치(`nightTally` 로 봇 선택을 확인한 뒤 방장이 다른 대상) · 처형 유언(방장 유언 저장 → 봇이 처형 → 손님 화면 카드) · 경찰(결과 카드와 채팅 eye 카드가 같은 결과) · 피해자(4명판 시민, 처형→밤→아침 자연 타이머로 막·번쩍임·유령 화면). 시민 편 DOM(L1~L5)은 시민·경찰·의사 세 역할에서, 역할 간 `data-night-dark` 값 동일(L6)은 흐름 끝에 비교한다. G·H 는 밤 마피아·의사·경찰·시민, 아침, 피해자 아침, 유령에 건다. `night-sizes`(폰 6종)는 마피아·경찰·시민 밤 한 장씩에서 tagInStage·이름표 버튼 44×44(PK1~3)·faceNameFits·패널 높이를 잰다.
- **Task 3**: `perf-run.mjs --mode nightload` — 방장 마피아 판, 이어서 시민 판(어둠·맥박)을 한 바퀴 50초(토론 10 · 지목 6 · 변론 6 · 찬반 6 · 처형 4 · 밤 14 · 아침 4)로 돌며 장면별 rAF 간격을 JSON(`scenes`·`passes`·`frames`)에 저장. 넘기기·시트 조작 구간은 기록을 멈춘다. `docs/screen-map.md` 는 night 흐름·표식 11개·밤 패널 세 종류 높이를 반영하고 `night-roles` 를 지웠다.
- **결과**: `npm run e2e -- --url http://localhost:5173 --only night` 가 반복 실행(최종 포함 5회 이상)에서 모두 `E2E OK`(약 155~160초, 의사 봇이 우연히 지킨 판은 새 방 재시도). `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 200건 통과, 클라이언트 1517·단위 2222 통과.
- **nightload 숫자(390×844 · CPU 4× · dpr 2 · 헤드리스 Chrome 156 · Mac arm64, 5분)**: 전체 평균 60.0fps · 끊김(>50ms) 0 · p95 16.7ms · 최장 33.4ms. 마피아 판·시민 판 모두 60.0fps/0, 장면별로도 최저 59.8fps(지목, 끊김 0). 점광원 4개(로비에서 잰 renderer 칸). 내 캐릭터 빛(PointLight) 비용은 이 환경에서 눈에 띄는 하락으로 나타나지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 두 번째 카드(쪽지)가 보이지 않던 간헐 결함**
- **Found during:** Task 1 (E2E 3회 중 2회 쪽지 카드 없음)
- **Issue:** `useChat` 이 다음 카드 공개 시각을 렌더 시각이 아니라 효과가 도는 시각(`Date.now()`)으로 비교했다. 유언·쪽지 두 카드의 공개 시각이 몇 ms 차이 나고 렌더와 효과 사이에 시계가 흐르면, 두 번째 카드는 목록에서 빠졌는데 타이머도 걸리지 않아 다음 갱신까지 안 보였다.
- **Fix:** 줄 목록을 만든 시각을 `renderedAt` ref 에 두고 `nextCardReveal` 을 그 시각으로 부른다. 렌더 시각 기준 회귀 시험을 추가(수정 전 실패 확인).
- **Files modified:** src/net/useChat.ts, test/client/useChat.test.tsx
- **Commit:** 6f9e410

**2. [Rule 1 - 계획 가정 오류] 다가가기에는 목적지 링(data-ring)이 없다**
- **Found during:** Task 1
- **Issue:** 계획은 "내 캐릭터가 움직이고([data-ring] 변화)" 라고 적었지만 마피아 다가가기(GameMap.approach)는 일반 move 만 보내고 링은 맵 탭에서만 생긴다.
- **Fix:** NA7 을 "move 전송 + 내 구간 번호 증가 + 위치 0.5 단위 넘게 이동"으로 바꾸고 링 값은 참고 줄(NA7k)로 남겼다. 앱은 의도대로라 고치지 않았다.
- **Commit:** 04e716b

**3. [Rule 3 - 막힘] 기존 시험이 새 흐름 목록과 어긋남**
- **Issue:** `scripts/e2e/lib.test.mjs` 가 extraSizes 를 갖는 흐름을 여섯 개로 고정해 두었다. `night-sizes` 를 더하면서 목록과 제목을 갱신했다.
- **Commit:** b8ea74a

**4. [범위 밖 이월 정리] uat-night.mjs 의 phrase 단언 삭제**
- 이월 메모(09-18·09-19)대로 서버가 채우지 않는 아침 `phrase` 단언만 지웠다(8·9페이즈 규칙에 안 맞는 나머지 — 낮 흐름 타이머, 동률 추첨, allyPicks — 는 그대로라 이 스크립트는 전체로는 낡았다. 아래 이월 항목).
- **Commit:** 8eea374

### 판단이 필요한 한 줄 (사용자 확인 대기)

- **360×560 경찰 밤(8자 이름이 줄바꿈된 얼굴 목록)**: 스테이지가 151px 로 줄어 내 이름표가 스테이지 위로 19.6px 올라간다. UI-SPEC 의 "알려진 한계로 둔다(UI Considerations 45, 약 152)" 에 적힌 바로 그 경우라 `SZ4k` 참고 줄(판정 아님)로만 남겼다. 같은 한계가 아닌 모든 크기·역할은 판정이고 문턱은 낮추지 않았다. 이 한계를 계속 받아들일지, 앱을 고칠지(얼굴 목록 이름 한 줄 말줄임 등)는 사용자 결정이다.

## 이월 (실기기·후속)

- **실기기 이월**: nightload 숫자는 Mac 헤드리스 Chrome 의 4× 감속이다(60fps·끊김 0). 폰 실기기 합격 판정은 사용자 결정대로 09-23 실기기 확인 목록으로 넘긴다. 맥박 비네트·막·번쩍임·베기·경찰 카드의 실제 모습, 카드 시간순 겹침은 육안 확인 미실시.
- **배포본 E2E(09-23)**: 로컬 night 흐름은 약 155초(마지막 시나리오가 자연 타이머로 밤 30초를 기다림). 지연이 큰 배포본에서는 밤 검사가 30초를 넘으면 `assertStillNight` 가 새 방 재시도를 한다. 전체 흐름이 900초에 닿으면 `--only night` 와 `--only night-sizes` 로 나눠 돈다.
- **uat-night.mjs 전체 갱신**: 낮 흐름 타이머(13초 처형 여부 투표 등), 마피아 둘 동률 추첨, `allyPicks` 단언이 8·9페이즈 규칙과 맞지 않는다. 이 계획은 phrase 만 지웠다.
- **E10 #47(산 사람 2~8명)**: E2E 는 4명판·6명판만 돈다. 전 범위는 worker·단위 시험 몫이라 backstop 로 둔다.
- 요구사항은 이 계획에서 새로 완료 처리한 것이 없다(시험·측정 계획). WILL-01·NIGHT-12 는 이월 메모대로 09-23 뒤 오케스트레이터가 완료 처리.

## Known Stubs

없음.

## Threat Flags

없음. (T-09-46 시민 편 DOM 누설은 L1~L5 로 E2E 가 확인한다.)

## Self-Check: PASSED

- 파일: scripts/e2e/flows.mjs · scripts/perf-run.mjs · docs/screen-map.md · perf/nightload-390x844-x4.json 존재 확인
- 커밋: 6f9e410 · 04e716b · b8ea74a · 53f9d5f · 8eea374 모두 HEAD 의 조상
