---
phase: 17-tutorial-first-case
plan: "11"
subsystem: docs
tags: [requirements, roadmap, decision-record, tutorial]
status: complete

requires:
  - phase: 16
    provides: REQUIREMENTS 의 DEPLOY-04·추적 표 형식, 결정 0079 문체
provides:
  - REQUIREMENTS.md 의 TUT-01~05·DEPLOY-05 요구사항 줄과 Phase 17 Pending 추적 행 6개
  - ROADMAP Phase 17 의 Requirements 줄(여섯 ID)
  - docs/decisions/0080-v3-tutorial-first-case.md (계획 단계 결정 0080-1~19, 위임 기본값, 17-10 이 채울 세 절 머리)
affects: [17-02, 17-03, 17-04, 17-05, 17-06, 17-07, 17-08, 17-09, 17-10, 17-12]

actuals:
  tokens: 1600
  tasks: 2
  commits: 2
plan_head_before: 08b27f44bca8d2a6c5f7bbe2344811096303ca76
plan_head_after: 081f472c6a2f527fde30c4dbc224bf670e71e81b

tech-stack:
  added: []
  patterns:
    - "결정 문서 번호 표기는 0079 와 같은 `0080-N.` 접두"

key-files:
  created:
    - docs/decisions/0080-v3-tutorial-first-case.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "결정 0080-1~19 를 계획 context 문장 그대로 결정 기록으로 고정(번호는 17-02~17-09·17-12 가 가리킨다)"
  - "TUT-01~05·DEPLOY-05 는 등록만 하고 Pending 으로 둔다(완료 처리는 페이즈 단위 검증에서)"

requirements-completed: []

duration: 약 6분
completed: 2026-11-09
---

# Phase 17 Plan 11: 요구사항 등록과 결정 0080 Summary

17페이즈 요구사항 여섯(TUT-01~05·DEPLOY-05)을 REQUIREMENTS 추적 표와 ROADMAP 에 등록하고, 계획 단계 결정 0080-1~19 를 결정 기록 0080 으로 저장소에 남겼다.

## Accomplishments

- REQUIREMENTS.md: "튜토리얼 첫 사건 (TUT)" 절 다섯 줄, DEPLOY-05 한 줄, 추적 행 여섯 개(모두 Phase 17 Pending), Coverage 39 total·Mapped 39·Unmapped 0, 마지막 갱신 줄.
- ROADMAP.md: Phase 17 `**Requirements**` 줄 한 줄만 바꿨다(numstat `1 1`). 계획 목록·다른 페이즈 절은 그대로다.
- 결정 0080: 머리·배경·결정(0080-1~19)·위임 기본값(바꾼 네 줄 T-9·T-12·T-19·#25 와 값을 바꿀 상수 위치)·세 절 머리("실행 중 달라진 곳"·"알려진 한계"·"정하지 않은 것" — 각 "17-10 이 실행 결과로 채운다." 한 줄뿐, 목록 줄 0)·근거.

## Task Commits

| 태스크 | 커밋 | 내용 |
|--------|------|------|
| 1 | `8923fdad` | docs(17-11): 17페이즈 요구사항 6개 등록 |
| 2 | `081f472c` | docs(17-11): 결정 0080 계획 단계 기록 |

## Verification

- Task 1 automated 통과: TUT·DEPLOY-05 언급 12줄(기준 12 이상), `Phase 17 | Pending` 6줄, `v3.0 requirements: 39 total` 1줄, ROADMAP 요구사항 줄 1줄, ROADMAP numstat `1 1`.
- Task 2 automated 통과: 서로 다른 `0080-N` 19개, 절 머리 3개, '실행 중 달라진 곳' 절의 `- ` 줄 0, T-9·T-12·T-19·#25 언급 8줄(기준 4 이상).
- 위생 검사(개인 작업 공통 지침의 패턴)를 세 파일에 돌려 결과 없음 확인.
- plan-level: `git log --grep "(17-11)"` 에 태스크마다 커밋 하나씩(둘). 17-01~17-03 과 수정 파일 겹침 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 결정 번호 표기를 `0080-N.` 로 맞춤**
- **Found during:** Task 2 verify
- **Issue:** 처음 번호 목록을 `1.`~`19.` 로 썼더니 verify 의 `0080-N` 고유 개수가 5(본문 인용)에 그쳐 실패했다. 결정 0079 도 `0079-N.` 접두를 쓴다.
- **Fix:** 결정 절의 번호를 `0080-N.` 로 바꿨다(문장은 그대로).
- **Files modified:** docs/decisions/0080-v3-tutorial-first-case.md
- **Commit:** `081f472c`(커밋 전에 고쳐 한 커밋에 포함)

**Total deviations:** 1 auto-fixed. **Impact:** 없음(내용 변화 없이 번호 표기만).

## Authentication Gates

없음.

## Known Stubs

없음. 문서 계획이라 코드 스텁이 없다. 결정 0080 의 세 절은 17-10 이 채우도록 의도된 자리표시이고 그 계획이 해결한다.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다. 위협 T-17-26(위생)·T-17-27(ROADMAP 한 줄 편집)은 계획대로 완화됐다.

## Notes

- `.planning/milestone.lock`·`.planning/state.json` 의 기존 미커밋 변경과 `Claude outputs/` 는 건드리지 않았다.
- 이 계획은 요구사항을 등록만 했고 완료 처리(`requirements.mark-complete`)는 하지 않았다. 페이즈 단위 완료가 추적을 맡는다.

## Next

Ready for 다음 계획(wave 의 나머지 17-xx).

## Self-Check: PASSED

- FOUND: docs/decisions/0080-v3-tutorial-first-case.md
- FOUND: 8923fdad, 081f472c (HEAD 의 조상)
