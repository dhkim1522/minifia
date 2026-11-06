---
phase: 09-night-morning
plan: "20"
subsystem: scene-transition-fx
tags: [curtain, kill-fx, police-card, reduced-motion, tdd, night-morning]
status: complete

requires:
  - phase: 09-night-morning
    provides: 결과 알림 아이콘·localCards·policeResultOf (09-18), useDayFx·GameMap 장착 (09-17·09-18), 밤·아침 위치 snap (09-09)
provides:
  - SceneCurtain — 장면 전환 막(공개 마감 − 420ms 덮기, 다음 단계 view 에서 800ms 걷기, holdUntil, 모션 줄이기)
  - KillFx — 암살당한 본인의 붉은 번쩍임(한 번)·흰 베기
  - PoliceResultCard — 경찰 본인 화면의 조사 결과 카드(0~2.4초)
  - useDayFx 신호 killFx { nonce, at }·policeResult { id, seat, isMafia }, WorldStage surprise 속성, runtime surprise(seat)
affects: [09-21, 09-22, 09-23]

actuals:
  tokens: 12617
  tasks: 3
  commits: 6
plan_head_before: 778801337a176048115fb34e6a0bd66a3cf7ed27
plan_head_after: 8307862cc3b4df7b4fe139cda2bbd8625da162ff

tech-stack:
  added: []
  patterns:
    - "막 덮기는 view.phaseEndsAt − offset − 420ms 만의 함수 — 비공개 정보(피해자·경찰 결과)를 읽지 않아 모든 역할이 같은 시각 (Pitfall 8, T-09-43)"
    - "피해자 신호는 useDayFx 의 렌더 중 상태 갱신(ghostEnter 와 같은 방식)으로 아침 view 와 같은 렌더에 세워, 같은 렌더의 막 holdUntil 이 읽는다"
    - "일회성 연출 부품은 nonce 가 바뀔 때만 재생하고 처음 마운트 때의 nonce 는 지난 일로 본다(deny·ghostEnter 와 같은 규칙)"

key-files:
  created:
    - src/components/SceneCurtain.tsx
    - src/components/KillFx.tsx
    - src/components/PoliceResultCard.tsx
    - test/client/killFx.test.tsx
  modified:
    - src/net/useDayFx.ts
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/components/WorldStage.tsx
    - src/world/runtime.ts
    - src/styles/night.css
    - test/client/nightMap.test.tsx
    - test/client/worldStage.test.tsx

key-decisions:
  - "막을 붙잡는 동안(피해자, SceneCurtain .is-held) 결과 알림 '암살당했습니다'(z-toast+5)가 막(+8) 아래에 가려지므로, 막 뒤에 오는 .mf-announce 를 +10 으로 올린다(CSS 형제 선택자)"
  - "KillFx 루트(.mf-killfx, data-kill-fx)는 자리·z 만 갖고 번쩍임 면은 자식 .mf-killfx__flash — 흰 베기가 번쩍임 불투명도 애니메이션에 묻히지 않게 분리"
  - "모션 줄이기에서는 피해자 surprise 표정 연출도 하지 않는다('바로 유령 상태')"
  - "PoliceResultCard 글자는 계획대로 16px 700(UI-SPEC 245행의 22px 는 363행 카드 치수 예외로 덮임)"

patterns-established:
  - "SceneCurtain 은 DOM 에서 ResultAnnounce 앞에 둔다(.mf-curtain.is-held ~ .mf-announce 형제 선택자)"

requirements-completed: [NIGHT-11]

coverage:
  - id: D1
    description: "장면 전환 막: 처형·밤·단독 선두 없는 지목은 공개 마감 420ms 전 덮기, 다음 단계 view 에서 800ms 걷기, 단독 선두 있는 지목·토론은 안 덮음, 첫 렌더 아침은 막 없음, 모션 줄이기는 즉시, 세 신분 같은 시각"
    requirement: "NIGHT-11"
    verification:
      - kind: unit
        ref: "test/client/killFx.test.tsx 장면 전환 막"
        status: pass
  - id: D2
    description: "피해자 화면에서만 0.05초 번쩍임·베기(한 번, 반복 1), 0.7초 surprise, 막 2.8초 유지 뒤 800ms 걷기; 의사가 살린 사람·다른 시민·재접속·모션 줄이기는 없음"
    requirement: "NIGHT-11"
    verification:
      - kind: unit
        ref: "test/client/killFx.test.tsx 피해자 암살 이펙트, test/client/worldStage.test.tsx surprise"
        status: pass
  - id: D3
    description: "경찰 화면에서만 조사 결과 카드(얼굴·마피아/마피아 아님·0~2.4초), 안 골랐거나 다른 신분이면 카드·문구 없음"
    requirement: "NIGHT-09"
    verification:
      - kind: unit
        ref: "test/client/killFx.test.tsx 경찰 조사 결과 카드"
        status: pass
  - id: D4
    description: "분필이 막이 진할 때 놓이고 막이 걷히며 그려진다(MORN-01)"
    requirement: "MORN-01"
    verification:
      - kind: manual
        ref: "실기기·배포본 육안 확인 이월(분필 설치·그려짐은 09-10·09-14, 막 타이밍은 이 계획) — 자동 시험은 막/분필 시각 순서를 따로 단언하지 않음"
        status: deferred
---

# Phase 9 Plan 20: 장면 전환 막·암살 이펙트·경찰 결과 카드 Summary

**공개 마감만으로 덮는 night-950 장면 전환 막과, 암살당한 본인 화면에서만 도는 붉은 번쩍임·베기·놀란 표정, 경찰 본인 화면에서만 뜨는 조사 결과 카드를 만들었다.**

## 수행 내용

- **SceneCurtain (Task 1, 트레이서)**: 처형·밤·단독 선두 없는 지목 단계에서 `phaseEndsAt − offset − 420ms` 에 덮기 시작하고 마감에 불투명 100%. 다음 단계(밤·아침) view 가 오면(첫 렌더 제외) `holdUntil` 이 지난 뒤 800ms 에 걷고 요소가 사라진다. 상태는 `is-covering → is-covered → is-lifting` 클래스, 표식 `data-curtain="true"`. 재접속 첫 view·같은 단계 안에서 단독 선두가 생긴 경우는 덮지 않는다. 모션 줄이기는 마감 시각에 즉시 덮고 다음 view 에서 즉시 사라진다.
- **KillFx + surprise (Task 2)**: `useDayFx.killFx` 가 같은 연결에서 밤(산 사람) → 아침(탈락)이 되는 렌더에서 `{ nonce, at }` 를 세운다. KillFx 는 nonce 가 바뀌면 50ms 뒤 번쩍임(0 → 0.8@15% → 0, 900ms, 반복 1)과 베기(-28°, scaleX 0 → 1, 700ms)를 그리고 950ms 에 치운다. GameMap 이 700ms 에 `WorldStage.surprise {seat: 내 좌석, nonce}` → `runtime.surprise(seat)`(놀란 표정만), 막에는 `holdUntil = at + 2800` 을 준다.
- **PoliceResultCard (Task 3)**: `useDayFx.policeResult` 가 `policeResultOf` 로 같은 연결 view 차이에서만 값을 만들고 2.4초 뒤 비운다. 카드는 얼굴 140(`faceSrc`) + 16px 700 한 줄(마피아 = `roleMafia` + 마피아, `is-mafia`; 아니면 `check` + 마피아 아님). 다른 신분 화면에는 이 부품이 그려지지 않아 문구가 DOM 에 없다.

## TDD 게이트

- Task 1: RED `7428f18`(SceneCurtain 은 null 을 그리는 빈 틀 — import 오류가 아닌 단언 실패), GREEN `4d11728`. RED 증거 `RED_EVIDENCE_OK`(TAP, 대상: 밤 view 580ms 막).
- Task 2: RED `02b8502`, GREEN `5775749`. RED 증거 `RED_EVIDENCE_OK`(대상: 피해자 화면 0.05초 `data-kill-fx`), 의미 평가: 대상 시험이 실제로 실행되어 `[data-kill-fx]` 부재 단언에서 실패.
- Task 3: RED `e78cf0c`, GREEN `8307862`. RED 증거 `RED_EVIDENCE_OK`(대상: 경찰 화면 카드 한 장), 의미 평가: 카드 부재(`[]` 길이 0) 단언에서 실패.
- 각 RED 에서 이미 통과하던 시험(재접속·다른 신분·'덮지 않음' 같은 부정 단언)은 보호선이며 대상 시험이 아니다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 막을 붙잡는 동안 피해자 알림이 막 뒤에 가려짐**
- **Found during:** Task 2
- **Issue:** 결과 알림(z-toast+5)이 막(z-toast+8)보다 아래라 피해자의 '암살당했습니다'(0.7~2.7초)가 불투명 막 뒤에 가려짐 (UI-SPEC 은 어둠 위에 뜨는 것으로 설명).
- **Fix:** SceneCurtain 이 붙잡는 동안 `is-held` 를 달고, `.mf-curtain.is-held ~ .mf-announce { z-index: +10 }` 로 알림만 막 위로 올림. 막 일반 규칙(+8)은 계획대로.
- **Files modified:** src/components/SceneCurtain.tsx, src/styles/night.css
- **Commit:** 5775749

**2. [Rule 3 - Blocking] 기존 시험의 런타임 가짜에 `surprise` 없음**
- **Found during:** Task 2
- **Issue:** WorldStage 가 `runtime.surprise` 를 부르는데 `test/client/nightMap.test.tsx` 의 가짜 런타임에 함수가 없어 두 시험 실패.
- **Fix:** 가짜에 `surprise: () => {}` 추가.
- **Commit:** 5775749

**3. [계획 보정] 부품 클래스 이름·구조**
- `.mf-killfx` 를 번쩍임 면이 아닌 루트(자리·z)로 두고 면은 `.mf-killfx__flash` 자식으로 분리(베기가 번쩍임 불투명도에 묻히지 않게). 계획의 클래스 이름과 달라졌으나 동작·치수는 계획대로.
- 시험 정규식 하나(키프레임 추출)를 GREEN 커밋에서 바로잡음(RED 시험의 정규식 버그).

**Total deviations:** 3 (Rule 1 ×1, Rule 3 ×1, 계획 보정 ×1). 영향: 없음(범위 안).

## 알려진 한계 · 이월

- **패널·헤더가 막 위**: 토큰상 `--z-overlay`(50)가 막 `--z-toast + 8`(48)보다 높아 아래 패널(`.mf-game__panel`)이 막 위에 그대로 보인다. UI-SPEC 층 표도 같은 값이라 계획대로 두었다. 헤더(`--z-toast` 40)는 막 아래. 실기기 육안 확인 이월.
- **MORN-01 (분필 '막이 진할 때 놓임')**: 분필 설치는 서버 상태·09-10 장면, 막 타이밍은 이 계획이지만 둘의 순서를 직접 단언하는 자동 시험은 없다 — D4 로 deferred 표기, 요구사항은 09-14 에서 이미 완료 처리됨.
- 번쩍임·베기·막 색의 실제 모습(대비·위치)과 경찰 카드 위치는 happy-dom 으로 육안 확인 못 함(실기기 이월).

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·서버 메시지 없음. 위협 모델: T-09-43(막 시각이 역할별로 같음 — 세 신분 같은 시각 시험), T-09-44(번쩍임 한 번·반복 1·모션 줄이기 끔 — CSS·부품 시험), T-09-SC(패키지 설치 없음).

## Self-Check: PASSED

- 신규 파일 존재: SceneCurtain.tsx, KillFx.tsx, PoliceResultCard.tsx, test/client/killFx.test.tsx — FOUND
- 커밋 존재: 7428f18, 4d11728, 02b8502, 5775749, e78cf0c, 8307862 — FOUND
- 검증: `npm run typecheck` 통과, `--project client` 1516 통과, `--project unit` 2220 통과(1 skipped 는 기존), `npm run tokens:check` 통과, test 폴더 `.skip(`·`.todo(` 0건
