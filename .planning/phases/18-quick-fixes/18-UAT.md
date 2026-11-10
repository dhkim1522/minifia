---
status: complete
phase: 18-quick-fixes
source: [18-VERIFICATION.md]
started: 2026-11-10T03:20:59Z
updated: 2026-11-10T03:20:59Z
---

## Current Test

[testing complete]

## Tests

### 1. SC-2 낮·밤 조명 눈 확인
expected: talk·morning 이 night 와 구분되고 광장 talk 가 흐린 낮으로 읽힌다. vote 가 밤과 헷갈리지 않는다.
result: issue
reported: "재즈바, 광장이 밤엔 어두운데 아침, 낮이 전혀 안 느껴집니다. 아침·낮을 더 확실한 시간감이 느껴지도록 배경 에셋 변경이 필요할까요?"
severity: major

### 2. WR-01·WR-02 처리 방향 결정
expected: 코드로 고치거나(18-REVIEW.md 의 Fix 안) 결정 0081-1 의 알려진 한계로 기록한다. 한 판 안의 옷 유일성에는 영향이 없다.
result: pass
decision: "한계로 기록(코드 수정 없음). 사용자: 같은 옷이 보여 누군지 헷갈리는 것 자체가 재미 요소일 수 있어 중복 해소가 필수가 아니다. 21페이즈에서 단서에 옷이 남는지 정할 때 잠금·중복 해소 유지 여부를 같이 정한다."

### 3. 배포본 smoke full 재확인
expected: node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f 가 통과한다(도착 편차 500ms 미만, .msg 읽기 오류 없음, 소켓 유지).
result: issue
reported: "3회 실행 모두 실패: (1) 2일차 dayAnnounce·errand 다음 discussion 60초 초과, (2) Cannot read properties of undefined (reading 'msg'), (3) 판 완주 후 dayAnnounce 도착 편차 704ms ≥ 500ms. 1일차·재접속 복원은 3회 모두 통과."
severity: major

## Summary

total: 3
passed: 1
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-18-1
  truth: "talk·morning 이 night 와 장면만 보고 구분되고 광장 talk 가 흐린 낮으로 읽힌다. vote 가 밤과 헷갈리지 않는다."
  status: failed
  reason: "User reported: 재즈바, 광장이 밤엔 어두운데 아침, 낮이 전혀 안 느껴집니다."
  severity: major
  test: 1
  root_cause: "광장 talk 바닥·건물 재질이 짙은 남색이라 조명 값(hemi·moon)을 올려도 낮으로 읽히지 않는다. vote 는 따뜻한 방향광이 남색 재질에 반사돼 night 보다 어둡다(0.0044 < 0.0069). 재즈 바 morning 은 night 의 1.53배로 문턱 1.6 에 못 미친다. 18-07 이 조정 한도(맵당 3회)와 재질 변경 금지 범위에 막혀 남긴 문제다."
  artifacts:
    - path: "src/world/maps/plaza.ts"
      issue: "PLAZA_LIGHT_TUNE·재질 색: talk 바닥·건물이 남색, vote moonColor·sky"
    - path: "src/world/maps/bar.ts"
      issue: "재즈 바 morning hemi·moon 이 문턱 미달"
  missing:
    - "낮·아침·저녁 재질·하늘·방향광 색온도를 시간대별로 분리(채도는 낮게, 명도·색온도만)"
    - "vote 를 노을색 계열로, night 달빛(푸른색)과 다른 계열로"
  debug_session: ".planning/phases/18-quick-fixes/18-07-SUMMARY.md 의 '남은 문제'"

- gap_id: G-18-3
  truth: "배포본 smoke full 이 통과한다(도착 편차 500ms 미만, .msg 읽기 오류 없음, 소켓 유지)."
  status: failed
  reason: "User reported: 3회 실행 모두 실패(2일차 discussion 미도착 / reading 'msg' TypeError / dayAnnounce 도착 편차 704ms)"
  severity: major
  test: 3
  artifacts: []
  missing: []
