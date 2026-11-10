---
phase: 18-quick-fixes
plan: "14"
subsystem: deploy
tags: [deploy, smoke, gap-closure, g-18-1, g-18-3, sc-2, sc-5]
status: in_progress
---

# Phase 18 Plan 14: gap 수정 배포·배포본 재검증 요약

## 진행

- [x] 단계 1 배포: `2026-11-10T02:35:10Z+6ea0749c` → `2026-11-10T10:31:13Z+722eb565` · 범위 diff 6개(허용 안) · 개인 계정 확인 · tutorial-solo 폰 6종 통과
- [x] 단계 2 배포본 smoke full 4/5 통과(고친 유형 0회)

## 단계 1 — 로컬 검증·배포

- 로컬 검증: typecheck 통과, `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 588 통과. `npm test` 는 첫 실행에서 2건 실패(대량 병렬 실행 중, 파일 1개)했으나 같은 작업 트리에서 두 번 다시 돌려 모두 통과(279 파일 통과·8032 시험 통과). 코드 변경 없이 사라졌으므로 시간 경쟁 간헐로 보고 원인 미확정으로 남긴다.
- 18-12 판정: complete/통과 — 18-12-SUMMARY status complete, `perf/light-390x844.json` 두 맵 rows 6개 모두 ok. colors: 광장 talk blueLead −21.6·sat 0.152, 광장 morning sat 0.251, 바 talk blueLead −32.4 (모두 문턱 안).
- 배포 전 version: v3 `2026-11-10T02:35:10Z+6ea0749c`, v1 `2026-10-29T14:52:03Z+cb6979c`, v2 `2026-11-06T13:49:18Z+e51942c6`.
- 배포 범위 `git diff --name-only 6ea0749c..HEAD -- src shared worker public index.html wrangler.jsonc package.json package-lock.json` (6개, 모두 허용 목록 안):
  - public/weather/weather-day.svg
  - public/weather/weather-dusk.svg
  - public/weather/weather-morning.svg
  - public/weather/weather-night.svg
  - src/world/maps/bar.ts
  - src/world/maps/plaza.ts
- `grep -rn "weather/" src index.html` 결과 0줄(날씨 SVG 는 화면에서 참조되지 않는다). 코드 변경 없는 작업 트리.
- 개인 계정 확인(`node scripts/check-account.mjs` 종료 0). 이후 `npm run deploy`(계정·배포 대상 가드 그대로)가 0 으로 끝남.
- 배포 후 version: v3 `2026-11-10T10:31:13Z+722eb565`. v1·v2 health 는 배포 전과 같음.
- 배포본 `npm run e2e -- --only tutorial-solo`(서버 0) E2E OK: 430x932 217/217 · 360x640 219/219 · 390x664 217/217 · 360x560 219/219 · 390x844 218/218 · 402x874 217/217. 머리 글자 대비 H1(4.5:1) 장면 2·3·5·6 통과. 재실행 필요 없었음.

## 단계 2 — 배포본 smoke full 반복

- 망 상태: `tcp 0.14s tls 0.50s ttfb 2.76s`(첫 호출, 배포 직후 콜드 스타트 포함. 18-10 의 0.15·0.5·0.9초와 tcp·tls 는 같고 ttfb 만 큼).
- 실행: `SMOKE_STACK=1 node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-10T02:35:10Z+6ea0749c` 를 한 번에 하나씩 5회. 출력은 작업 트리 밖 임시 파일.

| 회차 | 결과 | serverSpread | arrivalSpread | 분류·첫 실패 메시지 |
|------|------|--------------|---------------|---------------------|
| R1 | 통과 | 0ms/0ms | 14ms/1248ms | - |
| R2 | 실패 | - | - | (라) `SMOKE FAIL: fetch failed` — smoke 의 HTTP 요청이 전송 단계에서 실패(서버 응답·상태 코드 없음, 500/1101 아님, 소켓 닫힘 연결 보고 줄 없음). 출력상 errand 확인 직후(40초 대기 뒤 낮 토론 진입 무렵)에 끊김. 정확한 호출 위치는 오류 스택을 찍지 않아 확정 못 함 |
| R3 | 통과 | 0ms/0ms | 0ms/544ms | - |
| R4 | 통과 | 0ms/0ms | 769ms/35ms | - |
| R5 | 통과 | 0ms/0ms | 813ms/604ms | - |

- 통과 비율 4/5. 목표(5회 중 4회 이상) 달성. 경계(3/5)가 아니라 추가 회차는 돌리지 않음.
- 분류별: (가) 18-13 이 고친 유형 0회(옷 look 역할 문자열·`day.morning`·`Cannot read properties of undefined` 모두 없음) · (나) 연결 소켓 0회 · (다) 서버 시각 편차 500ms 이상 0회(serverSpread 전 회차 0ms) · (라) 그 밖 1회(R2 `fetch failed`).
- R2 해석(추정): 서버 시각 편차 0 인 다른 4회와 달리 이 회차는 서버 판정에 도달하기 전에 HTTP 전송이 실패했다. 서버 결함 증거는 없다. 문턱은 그대로 둔다. 같은 `fetch failed` 가 반복되면 smoke 의 HTTP 요청(특히 40초 대기 뒤 첫 요청) 오류 원인 출력(`cause`)을 더하는 것을 다음 후보로 둔다. 이 계획에서는 고치지 않는다.
- 도착 편차(망 포함, 정보용)는 최대 1248ms 까지 나오지만 판정에 쓰지 않는다(18-13 근거).
- DO 쓰기 한도: 500/1101 없음.
