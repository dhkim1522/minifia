---
phase: 18-quick-fixes
plan: "12"
subsystem: world-lighting
tags: [lighting, albedo, vertex-color, tracer, tdd, gap-closure, g-18-1, sc-2]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: "18-07 이 조명 표·렌더 측정 도구(perf-run --mode light)를 만들고 남긴 세 문제(광장 talk 남색 바닥·두 맵 vote < night·바 morning 1.53배)"
provides:
  - PhaseTune.albedo(AlbedoGrade)·ALBEDO_NONE·albedoGrader — 단계가 바뀔 때만 정점 색·plate 재질 color 를 tint 쪽으로 mix 만큼 섞어 다시 쓴다
  - 두 맵 talk·morning·vote 행의 재질 보정 값과 시간대별로 나뉜 하늘·방향광 색(낮 회백~따뜻, 아침 서늘한 회청, 저녁 노을), 밤 쪽 네 행은 ALBEDO_NONE 으로 18-07 그대로
  - perf-run light JSON 의 maps.*.colors(맵·단계별 아래쪽 절반 평균 sRGB·채도·blueLead)와 colorStats·readLowerHalfColor
  - 개정된 조명 허용 범위 시험(3 개정·6 새)
affects: [18-14]

actuals:
  tokens: 11200
  tasks: 3
  commits: 6

plan_head_before: 1914edb4b1d3ec867784e7e32d8275e46e7dba3c
plan_head_after: ffc10aca6b071950af8345cccc3b9e97d0aaf417
commits: 6

tech-stack:
  added: []
  patterns:
    - "재질 보정 = 정점 색 복사본(base) 위에서 out = base × (1 − mix) + tint × mix 를 다시 쓴다(선형, 누적 없음). 단계가 바뀔 때만(gradedFor !== phase) 쓰므로 긴장·핀·같은 단계 예산 변경은 비용이 없다"
    - "밤 쪽 행 불변은 ALBEDO_NONE(mix 0 → 복사본을 그대로 되돌림) + NIGHT_ROWS 고정 단언 + 정점 색 왕복 시험 + 렌더 night 평균 5% 비교의 4중으로 지킨다"

key-files:
  created:
    - .planning/phases/18-quick-fixes/perf/light-390x844-18-07.json
  modified:
    - src/world/maps/bar.ts
    - src/world/maps/plaza.ts
    - test/unit/lighting.test.ts
    - test/unit/plazaScene.test.ts
    - test/unit/barScene.test.ts
    - scripts/perf-run.mjs
    - scripts/perf-run.test.mjs
    - .planning/phases/18-quick-fixes/perf/light-390x844.json
    - .planning/phases/18-quick-fixes/perf/light-plaza-talk.png
    - .planning/phases/18-quick-fixes/perf/light-plaza-morning.png
    - .planning/phases/18-quick-fixes/perf/light-plaza-vote.png
    - .planning/phases/18-quick-fixes/perf/light-plaza-night.png
    - .planning/phases/18-quick-fixes/perf/light-bar-talk.png
    - .planning/phases/18-quick-fixes/perf/light-bar-morning.png
    - .planning/phases/18-quick-fixes/perf/light-bar-vote.png
    - .planning/phases/18-quick-fixes/perf/light-bar-night.png

key-decisions:
  - "재질 보정 방식은 정점 색 CPU 재작성(계획대로). 메시·재질·광원 수가 그대로라 draw call 상한과 perfbudget 에 영향이 없다"
  - "광장 morning mix 를 시작값 0.35 에서 0.5 로 한 번 올렸다: 첫 측정은 순서·배율을 통과했지만 화면이 채도 높은 파랑 슬레이트로 보였다(렌더 채도 0.298, 문턱 0.30 아슬아슬). 0.5 에서 채도 0.251 의 옅은 회청색이 되었다"
  - "그 밖의 값(두 맵 talk·vote, 바 morning)은 시작값 그대로 첫 측정에서 모든 판정을 통과해 조정하지 않았다"

requirements-completed: [SC-2]

duration: 약 60분
completed: 2026-11-10
---

# Phase 18 Plan 12: 시간대별 재질·하늘 조명 Summary

**PhaseTune 에 재질 보정 칸(albedo)을 더하고 albedoGrader 가 단계 전이 때만 정점 색·연장 판 색을 tint 쪽으로 섞어 써서, 광장·재즈 바의 낮·아침·저녁이 장면만 보고 구분되게 했다(밤 쪽은 18-07 그대로, 렌더 night 평균 오차 0.8% 이내).**

## 결과 한눈에

- G-18-1 닫힘: 두 맵 L4a·L4b·L4c 모두 통과, 광장 talk 남색 벗어남(재질 값·렌더 둘 다) 통과, night 불변 통과. 측정 2번(한도 6번 중), 값 조정은 광장 morning mix 한 칸뿐.
- status: complete. 계획 Task 3 verify(측정 JSON 판정 스크립트 + 세 시험 파일)가 통과했다.
- 로컬 E2E `--only day,tutorial-solo` 통과(H1 포함, 아래).

## 완료한 일

| Task | 내용 | 커밋 |
|------|------|------|
| 1 (tracer, TDD) | PhaseTune.albedo·AlbedoGrade·ALBEDO_NONE·albedoGrader. 두 장면 applyLook 에서 단계가 바뀔 때만 grade(t.albedo). 정점 색 왕복·version·남색 벗어남·진홍 없음·밤 쪽 불변 시험 | RED `783037b1` → GREEN `a3f369d0` |
| 2 (TDD) | 허용 범위 3 개정(아침 서늘·옅게)·6 새(albedo 범위), morning moonColor #e2e8ee, perf-run colorStats·readLowerHalfColor 와 light JSON colors | RED `83803d77` → GREEN `cbc1b264` |
| 3 | 렌더 측정 2번, 광장 morning mix 조정, PNG 눈 확인, E2E, 판정 | `a1e9eb1e`(fix) · `ffc10aca`(perf) |

## TDD 증거

RED 1 (`783037b1`, 자리 함수 + 전 행 ALBEDO_NONE): `npx vitest run test/unit/lighting.test.ts test/unit/plazaScene.test.ts test/unit/barScene.test.ts` 단언 실패 8건(임포트 오류 아님).

```
× (a) 만든 직후(talk) 바닥 정점 색은 팔레트 바닥색과 다르고 그 색보다 talk tint 에 가깝다   (광장·바)
    AssertionError: expected 6.38e-10 to be greater than 0.001
× (c) talk → night → talk → night 왕복 …  AssertionError: expected true to be false
× (d) 조명 단계가 바뀔 때만 color 속성 version 이 는다 …  AssertionError: expected 0 to be greater than 0   (광장·바)
× (h) 남색 벗어남 …  AssertionError: 바닥 정점 채도 {"r":18,"g":26,"b":48,"sat":0.625}: expected 0.625 to be less than or equal to 0.2
× grade({tint:#fff, mix:0.5}) 뒤 정점 성분은 base × 0.5 + 1 × 0.5 …  AssertionError: expected 0.1000000015 to be close to 0.55
Tests  8 failed | 88 passed (96)
```

GREEN 1 (`a3f369d0`): `lighting + plazaScene + barScene + palette` 4 파일 100 통과, typecheck 통과.

RED 2 (`83803d77`): vitest `AssertionError: morning B ≥ R: expected 216 to be greater than or equal to 224`(두 맵), `node --test scripts/perf-run.test.mjs` 의 colorStats 단언 3건 실패(`actual: { r: 0, g: 0, b: 0, sat: 0, blueLead: 0 }` vs `expected: { r: 22, g: 26, b: 45, sat: 0.511, blueLead: 19 }` 등).

GREEN 2 (`cbc1b264`): 세 시험 파일 98 통과, `node --test` 23 통과, typecheck 통과.

## 최종 조명 표 (talk·morning·vote, 두 맵)

hemi·moon·exposure·stage·pendant·emissive·glow·self 는 18-07 값 그대로(바뀐 칸만 아래에 적는다). 밤 쪽 네 행(trial·night·nightCitizen·nightGhost)은 전부 그대로이고 albedo 만 ALBEDO_NONE(#808080 / 0).

| 맵 | 행 | albedo tint / mix | sky [하늘, 땅, 배경·안개] | moonColor | hemi / moon |
|----|----|-------------------|---------------------------|-----------|-------------|
| 광장 | talk | #9a948a / 0.45 | #c2beb6, #6a665e, #a29e96 | #eadfd0 | 1.05π / 0.9π |
| 광장 | morning | #8e98a6 / 0.5 (시작 0.35) | #aab4c2, #545c66, #8a94a2 | #e2e8ee | 1.05π / 0.7π |
| 광장 | vote | #8c766c / 0.30 | #a8968e, #3a2e2e, #6a585a | #d8b48a | 0.6π / 0.4π |
| 바 | talk | #9a948a / 0.30 | #aaa69e, #524e48, #46423e | #eadfd0 | 1.1π / 0.85π |
| 바 | morning | #8e98a6 / 0.25 | #9aa2b0, #444a54, #3c4048 | #e2e8ee | 1.0π / 0.55π |
| 바 | vote | #8c766c / 0.25 | #8e7e78, #2c2224, #241c20 | #d8b48a | 0.7π / 0.55π |

18-07 값 대비 바뀐 곳: 위 표의 albedo 열 전체(새 칸), 여섯 행의 sky 셋(광장 talk #aaa4b8·#5c566a·#807a8e → 회백, morning #9a96ae… → 서늘한 회청, vote #625e72… → 노을 쪽 따뜻한 회갈. 바 talk #908aa4·#4a4058·#38324a → 회백, morning #7e7a96… → 회청, vote #3c3a48·#1c1428·#100d19 → 회갈), morning moonColor #e0dad8 → #e2e8ee. 반구·방향광 세기·노출·점광원·발광·빛 무리는 그대로.

## 렌더 측정 (390x844, dpr 2, 같은 카메라 `?perf=1&shot=1&chars=6`)

평균 상대 휘도 — 18-07 값과 나란히(마지막 측정 = 측정 2번, 파일 `perf/light-390x844.json`):

| 맵 | 단계 | 18-07 | 18-12 | 
|----|------|-------|-------|
| 광장 | talk | 0.0172 | 0.2096 |
| 광장 | morning | 0.0118 | 0.1987 |
| 광장 | vote | 0.0044 | 0.0188 |
| 광장 | night | 0.0069 | 0.0069 |
| 바 | talk | 0.0201 | 0.1243 |
| 바 | morning | 0.0105 | 0.0714 |
| 바 | vote | 0.0044 | 0.0182 |
| 바 | night | 0.0069 | 0.0069 |

판정: 광장 L4a 통과(0.2096 > 0.1987 > 0.0188 > 0.0069), L4b 30.4배(문턱 2.0), L4c 28.8배(문턱 1.6). 바 L4a 통과(0.1243 > 0.0714 > 0.0182 > 0.0069), L4b 18.0배, L4c 10.4배. (18-07 기준선: 광장 L4a·바 L4a·바 L4c 실패.) 문턱·lightRankVerdict 는 바꾸지 않았다.

측정 1(광장 morning mix 0.35): 광장 morning 0.1367(L4c 19.8배), 채도 0.298 blueLead +25.2 — 모든 판정 통과, 눈으로 볼 때 채도 높은 파랑이라 mix 0.5 로 한 번 더 쟀다.

### 아래쪽 절반 평균 색(바닥·연장 판 영역, sRGB 0~255)

| 맵 | 단계 | r | g | b | 채도 | blueLead | 판정 |
|----|------|---|---|---|------|----------|------|
| 광장 | talk | 142.4 | 132.5 | 120.8 | 0.152 | -21.6 | blueLead ≤ 2·채도 ≤ 0.25 통과 (18-07 참고: 채도 0.50·blueLead +18.9) |
| 광장 | morning | 116.5 | 132.5 | 155.6 | 0.251 | +23.1 | 채도 ≤ 0.30 통과 (18-07 참고: 채도 0.61) |
| 광장 | vote | 47.8 | 29.9 | 23.3 | 0.514 | -24.6 | — |
| 광장 | night | 8.1 | 13.3 | 34.8 | 0.767 | +21.6 | — |
| 바 | talk | 116.4 | 101.1 | 84.0 | 0.279 | -32.4 | blueLead ≤ 2 통과 |
| 바 | morning | 74.9 | 78.4 | 91.1 | 0.178 | +12.7 | — |
| 바 | vote | 55.0 | 30.9 | 18.8 | 0.658 | -36.2 | — |
| 바 | night | 21.9 | 16.9 | 22.7 | 0.255 | +0.8 | — |

재질 값 판정(node 시험): 만든 직후(talk) 광장 shell 바닥 정점·plate 재질은 sRGB 채도 ≤ 0.20·B ≤ max(R,G), 같은 단언이 night 의 팔레트 남색(#121a30, 채도 0.63)에서는 거짓임을 같은 시험이 보인다.

### night 불변 비교

| 맵 | 18-07 night | 18-12 night | 오차 |
|----|-------------|-------------|------|
| 광장 | 0.006907 | 0.006901 | 0.1% |
| 바 | 0.006871 | 0.006891 | 0.3% (측정 1: 0.8%) |

5% 안. 정점 색 왕복 시험(night 로 돌아오면 첫 night 와 정확히 같다)과 lighting.test 의 밤 쪽 네 행 불변 단언도 통과.

## PNG 눈 확인 (마지막 측정 8장, perf/light-{plaza,bar}-{talk,morning,vote,night}.png)

1. 광장 talk: 건물·바닥·연장 판이 따뜻한 회갈색 한 톤의 흐린 낮, 남색 면 없음. 다만 전체가 꽤 밝고 흐릿해 대비가 약하다(그림자만 어두움).
2. 광장 morning: 옅고 서늘한 회청색 하늘·건물·바닥, talk 와 색온도로 구분된다. 밝기는 talk 와 거의 같다(0.1987 vs 0.2096).
3. 광장 vote: 어두운 노을 갈색 장면, 가로등 하나와 창이 따뜻하게 빛나 밤 달빛(푸른 남색)과 확실히 다르다.
4. 광장 night: 18-07 과 같은 짙은 남색 달빛 장면(변화 없음).
5. 바 talk: 따뜻한 회갈색 마룻바닥·벽, 벽등·탁자 촛불이 살짝 도드라진다. 갈색이 약간 탁하다.
6. 바 morning: 서늘한 회청 마루·벽, talk 보다 확실히 어둡다. 창 블라인드의 파랑이 조금 튄다(창유리는 이 계획이 건드리지 않음).
7. 바 vote: 어두운 갈색에 무대 쪽이 따뜻하게 남은 저녁, 밤과 헷갈리지 않는다.
8. 바 night: 18-07 과 같은 거의 깜깜한 보랏빛 방(변화 없음).

채도 높은 보라·주황 면은 보이지 않는다. 사람 눈 확인(낮이 낮답게, 마피아 분위기가 사는지)은 18-14 가 HANDOFF 확인 대기로 넘긴다.

## 로컬 E2E (`npm run e2e -- --url http://localhost:5173 --only day,tutorial-solo`)

E2E OK. day 111/111 × 6 크기, tutorial-solo 217~219 × 6 크기, 실패 0. H1(헤더 제목·타이머 글씨 대비 4.5:1)이 day 전 시나리오(nomination·nomination-guest·verdict·verdict-guest 등)에서 통과했다. scrim 은 바꾸지 않았다.

## 검증

- `npm run typecheck` 통과, `npm test` 279 파일 통과 / 6 skipped(8030 통과, 261 skipped — 기존 skip 그대로), `node --test scripts/perf-run.test.mjs` 23 통과.
- 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project"`(변경 파일 범위) 결과 0.
- 개발 서버는 이 계획이 띄웠고 끝에 껐다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 눈 확인 반영] 광장 morning mix 0.35 → 0.5**
- **Found during:** Task 3, 측정 1 PNG 눈 확인
- **Issue:** 판정은 모두 통과했지만 광장 morning 이 채도 높은 파랑 슬레이트(렌더 채도 0.298, 문턱 0.30 아슬아슬)로 보였다. 계획의 "채도 높은 파랑 면이 보이면 그 행을 회색 쪽으로" 규칙에 해당.
- **Fix:** morning albedo mix 를 0.5 로(조정 손잡이 mix 만, tint·sky 는 그대로). 측정 2번에서 채도 0.251, 모든 판정 통과.
- **Files modified:** src/world/maps/plaza.ts
- **Commit:** a1e9eb1e

그 밖에는 계획대로 실행했다. 계획의 "(a) 그 색보다 talk tint 에 가깝다" 는 "원래 바닥색보다 tint 에 가깝다"(|got − tint| < |floor − tint|)로 해석했다(mix 가 0.5 미만이라 반대 해석은 성립하지 않는다).

## 남은 문제 / 다음 손잡이

- 광장 talk·morning 의 평균 휘도가 거의 같다(0.2096 vs 0.1987, 순서는 지킴). 둘의 구분은 밝기가 아니라 색온도(따뜻한 회갈 vs 서늘한 회청)에 기대고 있다. 사람 눈에서 구분이 약하면 morning hemi 를 내리거나 mix 를 0.4 대로 되돌리는 것이 다음 손잡이다.
- 광장 talk 가 전체적으로 밝고 흐릿하다(휘도 0.21 로 18-07 의 12배). "낮은 명도·채도 유지" 취향에서 너무 밝다고 보이면 talk hemi·mix 를 낮춘다(순서·배율 판정은 30배라 여유가 크다).
- 바 morning 창 블라인드 파랑이 튀어 보인다. 재즈 바의 창유리(emissiveRoom 안 windowGlass)는 발광 묶음 하나에 배율 하나라 이 계획에서 바꾸지 않았다. 사람 눈 확인에서 바가 여전히 약하면 "창 빛"(묶음을 나눠 draw call 하나 증가)이 다음 손잡이다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 표면 없음). T-18-26(밤 쪽 행 ALBEDO_NONE·왕복 시험)과 T-18-27(단계가 바뀔 때만 다시 쓰기·version 시험) 완화는 시험으로 확인했다.

## Self-Check: PASSED

- 파일 존재: src/world/maps/bar.ts(albedoGrader), src/world/maps/plaza.ts(ALBEDO_NONE·gradedFor), scripts/perf-run.mjs(colorStats), perf/light-390x844.json·light-390x844-18-07.json, perf PNG 8장 확인.
- 커밋 존재: 783037b1, a3f369d0, 83803d77, cbc1b264, a1e9eb1e, ffc10aca 모두 HEAD 의 조상.
