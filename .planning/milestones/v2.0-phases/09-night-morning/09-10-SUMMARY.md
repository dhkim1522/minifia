---
phase: 09-night-morning
plan: "10"
subsystem: world-renderer
tags: [chalk, night-lighting, self-light, ring-kind, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: DayView.chalk 타입 (09-07), 밤 서버 위치 비공개 (09-03·09-09)
provides:
  - lightingFor(view) — 밤 산 비마피아 nightCitizen, 산 마피아 night, 유령 nightGhost
  - 밤·산 시민 편 장면 표는 내 좌석 하나뿐 (시민·경찰·의사 같은 값)
  - SceneLook.chalk(월드 단위) → runtime → WorldRenderer.setChalk? → BarScene.setChalk 분필 메시 + 이름표 층 data-chalk
  - LIGHT_TUNE.nightCitizen·nightGhost 행, PhaseTune.self, BarScene.lights.self, setSelfLight (WorldRenderer optional)
  - RingKind "mafiaAlly"(crimson-400), data-ring-kind="mafia-ally", ringKindAttr()
affects: [09-13, 09-14, 09-15, 09-22]

actuals:
  tokens: 9600
  tasks: 3
  commits: 6
plan_head_before: 9f17750aca326b7cc4cd4171c6e0278957f1856b
plan_head_after: ad81de0ac84408bc7a2686855426e10b0c981adc

tech-stack:
  added: []
  patterns:
    - "새 렌더러 기능은 WorldRenderer 의 optional 메서드(setChalk?·setSelfLight?)로 더해 가짜 렌더러와 호환"
    - "광원은 bar 를 만들 때 세기 0 으로 선생성하고 조명 단계는 세기만 바꾼다 (점광원 수 불변, Pitfall 7)"
    - "분필 그려짐은 runtime 이 '장면이 있는 프레임에서 분필이 없던 적이 있는가' 로 첫 장면과 새 출현을 가른다"

key-files:
  created: []
  modified:
    - src/world/presence.ts
    - src/world/renderer.ts
    - src/world/threeRenderer.ts
    - src/world/maps/bar.ts
    - src/world/runtime.ts
    - src/components/WorldStage.tsx
    - test/unit/presence.test.ts
    - test/unit/barScene.test.ts
    - test/unit/ladder.test.ts
    - test/client/worldStage.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/atmosphere.test.tsx
    - test/client/characterAudit.test.tsx

key-decisions:
  - "분필 메시 점 21개의 K 는 캐릭터 배율 CHAR_SCALE(0.83) — 블록아웃 MFChar.SCALE 과 같다"
  - "내 캐릭터 빛은 예산 core 에서도 visible 을 끄지 않는다(끄면 점광원 수가 변해 셰이더 재컴파일). core 의 보이는 점광원은 1 → 2"
  - "nightGhost = night 행에 vote 그룹 emissive·glow 만 0.4 배 (가정 A3), nightCitizen 하늘·안개는 night 보다 어둡게"
  - "역할이 없는(role 미정) 산 viewer 의 밤은 마피아가 아니므로 nightCitizen — 비마피아를 기본으로 둔다"

requirements-completed: []  # MORN-01 은 서버가 day.chalk 를 채우는 09-14, NIGHT-10 은 비네트를 장착하는 09-15 에서 완료 처리 (이월 메모)

metrics:
  duration: 약 55분
  completed: 2026-11-03
---

# Phase 9 Plan 10: 분필·시민 편 어둠·내 캐릭터 빛·동료 고리 Summary

presence 가 보는 사람별 조명 단계와 밤 좌석 표·분필을 장면에 싣고, runtime·renderer·bar 가 분필 메시(블록아웃 TubeGeometry 한 개)·내 캐릭터 빛·두 조명 행(nightCitizen·nightGhost)을 그리며, 이름표 층에 `data-chalk` 를 단다. 동료 선택 고리 종류 `mafiaAlly` 도 더했다.

## 한 일

- **Task 1 (트레이서)**: `day.chalk`(고정소수점)를 UNIT 으로 나눠 `sceneLook.chalk` 로 싣고 → runtime 이 바뀔 때만 `renderer.setChalk?` → bar 가 처음부터 만들어 숨겨 둔 분필 메시를 (x, 0.015, z) 에 보임. `mf-world__tags` 에 `data-chalk="x,z"`(소수 둘째 자리). 가짜 렌더러(setChalk 없음)에서도 예외 없음.
- **Task 2**: `lightingFor`, 밤 시민 편 좌석 표(내 좌석 하나), `LIGHT_TUNE.nightCitizen`(반구 0.05π·달빛 0.08π·노출 0.75·무대/펜던트/실내 0·내 빛 1.4×4), `nightGhost`, 내 캐릭터 빛 선생성(세기 0)과 `setSelfLight`, runtime 이 nightCitizen 에서 내 캐릭터를 따라감. 조명 전환 전후 점광원 수 불변을 두 예산 단계에서 시험.
- **Task 3**: `RingKind` `mafiaAlly`(crimson-400 `#e0344b`), `data-ring-kind="mafia-ally"`(`ringKindAttr`), 분필 그려짐 800ms(0 → 0.85). 모션 줄이기·첫 장면(재접속)은 첫 호출부터 0.85, 분필이 사라졌다 다시 생기면 다시 그려진다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 고유 재질 수 상한 13 → 14**
- **Found during:** Task 1
- **Issue:** `barScene.test` "고유 재질 수는 13 이하" 가 분필 재질 하나(MeshBasicMaterial) 때문에 14 가 됨
- **Fix:** 상한을 14 로 올리고 주석에 사유(08-10 선례와 같은 방식). 시험 의미(박스마다 새 재질 아님)는 그대로
- **Commit:** e1e64dd

**2. [Rule 3 - Blocking] 광원 개수·밤 조명 기대값 갱신 (ladder·barScene·atmosphere·characterAudit)**
- **Found during:** Task 2
- **Issue:** 점광원 3 → 4(전체)·보이는 1 → 2(core)·광원 수 5 → 6, 시민 편 밤 조명이 `night` → `nightCitizen`(4역할 시험은 시민 편 셋 / 마피아 night / 유령 nightGhost), 8명 밤 이름표 시험이 시민 viewer 의 "산 좌석 전부"를 가정
- **Fix:** 기대값만 새 사실로 고침. 8명 이름표 시험은 viewer 를 마피아로 바꿈(산 좌석 전부를 보는 신분)
- **Commit:** c916423

**3. [Rule 4 경계 - 계획이 직접 낳은 충돌] 8페이즈 밤 임시 틀의 지도 이름표 선택 시험 6건 skip**
- **Found during:** Task 2
- **Issue:** 계획이 정한 대로 밤·산 시민 편 장면 표가 내 좌석 하나뿐이 되자, 지도 이름표로 경찰·의사가 대상을 고르는 임시 틀(08-18) 시험 6건이 성립하지 않음. 서버는 이미 09-03 부터 남의 위치를 보내지 않는다. 09-15 계획이 이 시험을 얼굴 목록(NIGHT-09)으로 바꿔 쓰고 임시 틀을 지운다
- **Fix:** 6건을 `it.skip` 하고 사유 주석을 달았다. 나머지 3건(조명 `nightCitizen`, 아침 직전 이름표 `[3]`, 경찰 고리가 마피아 고리 아님·지도 고리 없음)은 새 사실로 고침. `.planning/WINDOWS.md` 에 skipped-test 로 기록
- **Commit:** c916423

## Known Stubs

없음. 분필 값은 09-07 타입만으로 view 가짜 값에 시험했다 — 서버가 `day.chalk` 를 채우는 일은 09-14 몫이라, 그때까지 실제 방에서는 분필이 나타나지 않는다(스텁이 아니라 입력 대기).

## 검증

- `npm run typecheck`(tokens:check 포함) 통과, `npx vitest run --project unit --project client` 117 파일 통과(3549 통과·7 skip: 이 계획 6건 + 기존 1건)
- `--project worker`: 이 계획은 worker·shared 를 건드리지 않음. 부하 때 `testTools` ended 시험(기존 불안정)과 한 번 `봇 chat` 시험이 타임아웃으로 실패했다가 재실행에서 통과
- 트레이서 게이트: auto 모드 아님·human_verify 는 end-of-phase·검증이 자동뿐이라 `<verify>` 재실행 통과 후 확장

## Threat Flags

없음 (새 네트워크·인증·파일 접근 표면 없음). T-09-21(밤 시민 편 좌석 표 내 좌석만, 세 역할 같은 값 시험), T-09-22(광원 선생성, 전환 전후 점광원 수 불변 시험)을 시험으로 닫았다.

## 가정 현황

- A1 조명 값은 환산만 했고 읽힘은 실기기 몫(999.6). A2 내 캐릭터 빛 1개 비용은 09-22 크롬 4× 스로틀 측정이 확인한다. A3 nightGhost "0.4"는 night 행 vote 그룹 emissive·glow ×0.4 로 옮겼다(night 의 vote 빛 무리는 0 이라 emissive 만 실제로 줄어든다).

## Self-Check: PASSED

- 파일 존재: src/world/presence.ts, renderer.ts, threeRenderer.ts, maps/bar.ts, runtime.ts, src/components/WorldStage.tsx — 확인됨
- 커밋 존재: 7095fb4(test), e1e64dd(feat), bf62eb9(test), c916423(feat), 0ab0c84(test), ad81de0(feat) — 확인됨
