---
phase: 11-result-rematch
plan: "14"
subsystem: verification-docs
tags: [decision-0069, device-checks, regression, nightload, plaza, handoff]
requires: ["11-01", "11-02", "11-03", "11-04", "11-05", "11-06", "11-07", "11-08", "11-09", "11-10", "11-11", "11-12", "11-13"]
provides:
  - "결정 기록 0069(0069-1~12)와 0053-1 개정 표시, UI-SPEC 확정 표시"
  - "architecture·screen-map·product 갱신, HANDOFF 6KB 이하 바꿔치기"
  - "11-DEVICE-CHECKS.md 표 A(자동 확인·회귀·성능)·표 B(실기기 14항목, 전부 미확인)"
  - "폰 6종 전 흐름 회귀와 두 맵 성능 측정(perf/)"
affects: ["12-*"]
key-files:
  created:
    - docs/decisions/0069-v2-result-rematch-plan-values.md
    - .planning/phases/11-result-rematch/11-DEVICE-CHECKS.md
    - .planning/phases/11-result-rematch/perf/ (JSON·PNG 8개)
  modified:
    - docs/decisions/0053-v2-verdict-rules.md
    - .planning/phases/11-result-rematch/11-UI-SPEC.md
    - docs/architecture.md
    - docs/screen-map.md
    - docs/product.md
    - HANDOFF.md
decisions:
  - "광장 5분 nightload 가 합격선 안(평균 59.93fps·끊김 1)이라 PLAYABLE_MAPS = [bar, plaza] 를 열린 채로 둔다"
metrics:
  tasks: 3
  completed: 2026-11-06
status: complete
actuals:
  tokens: 28000
  tasks: 3
  commits: 4
plan_head_before: 58377514e7c1ed6648526eed374768ba3a93fae2
plan_head_after: c001edcfe1b1a4739e4cdf01e5be7f688cb6cdd4
---

# Phase 11 Plan 14: 결정 0069·문서·최종 검증 Summary

11페이즈 값 결정 기록 0069 와 지도 문서·인계·실기기 목록을 마무리하고, 폰 6종 전 흐름 회귀·5분 nightload 두 맵·전체 시험을 모두 통과로 확인했다.

## 한 일

- 이 실행기는 네트워크 오류로 끊긴 이전 실행을 이어받았다. 이전 실행이 남긴 문서(0069·0053 개정·UI-SPEC 표시·architecture·screen-map·product·HANDOFF)와 성능 측정 JSON 은 내용을 검토해 그대로 썼고 0069 에 광장 결론·보조 칭호 아이콘 항목만 더했다.
- 커밋 `2724326f`·`52b01590`(광장 개방 뒤 낡은 시험 기대값 맞춤)은 이전 실행의 것이다.
- 남아 있던 개발 서버(pid 27451)를 끄고 내 서버로 다시 돌렸고, 끝난 뒤 껐다.

## 검증 결과

| 검사 | 결과 |
|------|------|
| `npm run typecheck`·`npm run build`·`check:character` | 통과(캐릭터 68/68) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 401/401 |
| 전체 `npx vitest run` | 6570 통과·1 건너뜀·2 실패(`continuity` 옛 방장 복귀·`testTools` ended testReset, 알려진 간헐). 두 파일만 다시 돌리면 49/49 통과 |
| `check ui.safety-gate 11`·`check verify.schema-drift 11` | 둘 다 `block: false` |
| 정적 그림 | `public/maps` 2·`public/outfits` 9 |
| E2E 묶음 (a)~(i), 폰 6종 | 전부 `E2E OK`·실패 0(흐름 × 크기 표는 `11-DEVICE-CHECKS.md` 표 A5) |

묶음: (a) lobby·world·chat-lobby·chat-ime·chat-keyboard 71초 · (b) day·ghost·noexec 172초 · (c) night·night-sizes·result 계열·chat-game 278초 · (d) politics 네 흐름 148초 · (e) politics-runoff·showdown 204초 · (f) avatar 58초 · (h) result-rematch·host-handoff 38초 · (i) map-select 65초. 알려진 간헐 실패(night-sizes 360x640 PK3, ghost G2·GH13)는 이번에 나오지 않았다.

### 성능 (CPU 4배·390×844·DPR 2, 기준 코드 `2724326f` — 이후 커밋은 시험·문서뿐)

| 측정 | 맵 | 평균 fps | 끊김 | p95 ms | 최장 ms | calls 안정/최대 | 점광원 |
|------|----|---------|------|--------|---------|-----------------|--------|
| nightload 5분 | 재즈 바 | 59.92 | 1 | 16.8 | 66.6 | — | — |
| nightload 5분 | 광장 | 59.93 | 1 | 16.7 | 50.1 | — | — |
| 8명 의상×박수 4, 2분 | 재즈 바 | 60.00 | 0 | 16.7 | 16.8 | 61/67 | 4 |
| 8명 의상×박수 4, 2분 | 광장 | 59.99 | 0 | 16.7 | 33.4 | 44/68 | 3 |

- 끊김 1회는 두 맵 모두 `mafia:execution` 장면(합격선 5회 이하). 합격선은 낮추지 않았다. 광장은 합격이라 되돌리지 않고 `PLAYABLE_MAPS = ["bar", "plaza"]` 로 둔다.
- 재즈 바 점광원 4>3 은 `perfbudget` B2 로 10페이즈 이전부터 있던 알려진 항목이다.
- nightload JSON 의 `renderer` 는 대기실 월드 스냅샷이라 두 맵이 같다(대기실은 항상 재즈 바, 맵은 시작 때 적용). 광장의 draw call·점광원은 talk 시나리오 열이 실제 값이다.
- T-11-03(채팅 줄마다 `room` 키 재저장): 봇 7명 판 5분에서 두 맵 모두 프레임에 드러나지 않았다(평균 59.9fps·끊김 1). 서버 쪽 저장 시간은 이 도구가 따로 재지 않는다.

## Deviations from Plan

없음 — 계획대로 실행. 다만 이전 실행기가 끊겨 Task 1·2 문서와 성능 측정은 이어받아 검토 후 채택했다. 코드 결함은 발견하지 않았다.

## Known Stubs

없음(이 계획은 문서와 검증).

## 이월 메모

- 실기기·팀 테스트 14항목은 `11-DEVICE-CHECKS.md` 표 B(전부 미확인), 999.6 묶음에 합친다.
- 배포와 배포본 스모크·새 흐름 6개(result-reveal·result-awards·result-rematch·host-handoff·map-select·result)는 오케스트레이터 몫이다.
- 광장 조명·맵 카드 그림·아이콘·`AWARD_MIN` 은 기본값이다(0069).

## Self-Check: PASSED

- `docs/decisions/0069-v2-result-rematch-plan-values.md`·`11-DEVICE-CHECKS.md`·`perf/` 존재 확인.
- 커밋 `3b22481e`·`c001edcf`·`2724326f`·`52b01590` 이 HEAD 의 조상임을 확인.
- `HANDOFF.md` 5627 바이트(6144 이하), handoff 시험 통과.
