# Phase 13: 기본판 낮 흐름 — Context

**Gathered:** 2026-11-07 (사용자 확정 결정에서 옮김, discuss 생략 — 결정 0071)
**Source:** `docs/playtest-v2.0-feedback.md` "v3.0 세부 결정" 5·6·7, 결정 0071

<domain>
낮 흐름을 기본판 하나로 줄인다: 토론 → 투표(동시) → 최후 변론 → 찬반 → 처형. 정치 장치는 설정으로 끈다(코드 삭제 안 함).
사회자 자막·도구 이름표는 14페이즈, 심부름·흔적은 15페이즈다. 이 페이즈는 흐름과 그 흐름에 필요한 최소 화면만 바꾼다.
</domain>

<decisions>
## Locked (사용자 확정 2026-11-07)

- D-01 판 종류는 나누지 않는다. 기본판 하나(판 이름·고르기 화면 없음).
- D-02 낮 흐름: 토론(90초, 과반 토론 끝내기 그대로) → 투표 → 최후 변론(20초) → 찬반(10초) → 처형.
- D-03 투표는 산 사람 모두 동시에 한 명을 고른다. 최다 득표 1명이 변론자. 동점(둘 이상)·0표면 처형 없이 밤으로(결선 없음).
- D-04 찬반 기록 카드는 유지(모두가 확인하는 사실).
- D-05 끄는 것: 직업 주장 배지(0066), 귓속말(0066), 순차 지목(0063-1), 동점 결선 runoff(0066-4), 마지막 3인 결전 showdown(0066-5). 코드는 지우지 않고 한 곳의 설정(예: `shared/game/` 의 기본판 설정 상수)으로 끈다. 꺼진 장치의 메시지는 서버가 조용히 거절하고 view 에 키를 싣지 않는다.
- D-06 "마지막 지목자 조명·판결 순간 연출"(0066-6·7)처럼 단계를 늘리지 않는 연출은 유지해도 된다(추천: 유지).
- D-07 화면은 결정 0051(글 최소, 대상 직접 누르기)을 따른다. 투표는 이름표를 직접 누른다.

## Claude's Discretion (추천안으로 진행)

- 투표 단계 길이: 8페이즈 동시 지목 15초를 기본값으로 쓴다(phases.ts 한 줄).
- 단계 id 는 기존 `nomination` 을 그대로 쓰고(와이어 이름 유지), 동시 모드로 되돌린다. 8페이즈 동시 지목 구현(결정 0060-3, `tallyPoints`·`pointLinesOf`)과 v2.0 git 기록을 참고한다.
- 투표 중 표 공개 범위: 8페이즈와 같이 지목 줄(누가 누구를) 실시간 공개를 기본으로 한다 — 공개 사실이 증거가 된다(피드백 문서 기준).
- 시안: 새 화면이 없어 캔버스 시안은 만들지 않는다(투표 화면은 8페이즈 동시 지목 화면을 되살림).

## Deferred
- 정통 판(장치 켜기) 고르기 — Future Requirements.
</decisions>

<canonical_refs>
- `docs/playtest-v2.0-feedback.md` — 피드백·세부 결정
- `docs/decisions/0060-v2-day-execution-ghost.md` — 동시 지목·찬반·처형 규칙
- `docs/decisions/0063-v2-play-feedback-b.md`, `0066`, `0067` — 끄는 장치들
- `docs/decisions/0071-v3-milestone-scope.md`
- `shared/game/phases.ts`, `tick.ts`, `nomination.ts`, `runoff.ts`, `showdown.ts`, `whisper.ts`, `badge.ts`, `bots.ts`
- `.planning/milestones/v2.0-phases/08-day-execution-ghost/` — 동시 지목 UI-SPEC·계획
- `.planning/milestones/v2.0-phases/09.1*`, `09.1.1*` — 순차 지목·정치 장치 UI-SPEC
</canonical_refs>
