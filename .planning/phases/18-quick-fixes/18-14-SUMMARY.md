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
