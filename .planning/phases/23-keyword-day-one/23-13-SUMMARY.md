---
phase: 23-keyword-day-one
plan: "13"
subsystem: docs-phase-gate
tags: [decision-record, docs, phase-gate, handoff]
requires: ["23-12"]
provides:
  - "docs/decisions/0091-v3-keyword-day-one.md: 23 의 위임 선택 24개(0091-1~24) — 단계 id·keyword 스위치·금지어·거절 응답·공개 순서·조기 진행·D1 열·24 첫 단계 명령 순서·알려진 한계"
  - "0090-4 에 0091 개정 표시(전원 투표 뒤 1.5초에 일찍 넘어감)"
  - "docs/product.md·architecture.md·screen-map.md 의 첫날 키워드·정답 공개·조기 진행·D1 판 기록 반영"
  - "HANDOFF.md: 23 완료(미배포)·24 의 D1 첫 단계·키워드 목록 검토 대기"
affects: [24]
actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: c305c6138904d51ea07454c31c001bc6043330bb
plan_head_after: 865df2e7512183c2326349ef4f6cbd3638f3458b
key-files:
  created:
    - docs/decisions/0091-v3-keyword-day-one.md
  modified:
    - docs/decisions/0090-v3-single-flow-day-vote-will.md
    - docs/product.md
    - docs/architecture.md
    - docs/screen-map.md
    - HANDOFF.md
decisions:
  - "0091 은 번호를 0091-1~24 로 24개 적었다(계획 최소 12). 한계 다섯 줄과 24 첫 단계 명령(0091-18)을 별도 줄로 분리했다"
  - "0091-20 에 마피아 떠보기 거절의 storage.put 한 번 더 타이밍 미세 차이를 한 줄로 남겼다(23-06 이 23-12·13 에 권한 항목)"
status: complete
---

# Phase 23 Plan 13: 결정 0091·문서 셋·페이즈 게이트·HANDOFF Summary

**23 을 닫았다: 위임 선택을 결정 0091 한 파일로 기록하고, 기획서·구조 문서·화면 지도를 새 첫날 흐름으로 고쳤고, 페이즈 끝 게이트(전체 시험·typecheck·스크립트 시험·번들 가드)가 전부 초록이며, HANDOFF 가 "23 완료·미배포, 다음 24 와 D1 첫 단계"를 넘긴다.**

## 커밋

| Task | 커밋 | 내용 |
|------|------|------|
| 1 | 5d5a2549 | `docs(23-13): 결정 0091 첫날 키워드·D1 판 기록·조기 진행` (0091 신규 + 0090-4 개정 표시) |
| 2 | cd2eab70 | `docs(23-13): 기획서·구조·화면 지도 — 첫날 키워드와 판 기록` |
| 3 | 865df2e7 | `docs(23-13): HANDOFF — 23 완료, 24 의 D1 첫 단계` |

`commits: 3` 은 `git rev-list --count c305c613..HEAD`(이 SUMMARY 커밋 제외)로 센 값이다. 단계 3은 문서·게이트라 코드 변경이 없다.

## 한 일

- **결정 0091**: 0090 모양(상태 채택(위임)·날짜·근거·대전제·결정 목록·끝 문장). 묶음: 첫날 흐름·단계(1~3), 키워드 목록(4), 답 판정(5~8), 공개(9), 일찍 넘어가기(10~12), D1 판 기록(13~17), 24 첫 단계(18), 알려진 한계(19~24). 사용자가 요구한 항목을 모두 넣었다: 단계 id·길이, keyword 키 스위치, 거절 응답 같은 두 프레임, `keywordProbed`, 채팅 무필터, D1 열·판 uuid, 조기 진행 정책(연장은 찬반만), 마피아 거절 storage.put 타이밍 메모, 3글자 초성 겹침(고양이↔가을이), `left_count` 정의, `note_count`·`tutorial` 24 전 0 고정, 로컬 D1 상태 폴더 공유 미확인(A1), 배포 가드와 24 의 정확한 명령 여섯 단계, 마감 자동 확정 경로 E2E 없음, 664 이하 키보드 한계, 자동 열린 시트, 빈 확정 불가.
- **0090-4**: 줄 끝에 "(0091 에서 개정: 전원 투표 뒤 1.5초에 일찍 넘어가고 번복하면 1.5초 연장, 원래 마감 이내)" 를 붙였다.
- **product.md**: 진행 흐름 표에 "키워드 문제(첫날만)"·"정답 공개(첫날만)" 행, 찬반·밤 행에 조기 진행, 판 하나 문단에 첫날 답 기록 카드·D1 판 기록 한 줄, 낮부터 시작 문단의 23페이즈 예고를 사실 문장으로.
- **architecture.md**: 상태 공개 원칙에 첫날 키워드 줄(서버 전용 키와 공개 경로·거절 프레임·조기 마감 방송), "판 기록 (23페이즈, 결정 0091)" 절(바인딩·표·삽입 위치·실패 격리·`npm run games`·`database_id` 가드·24 첫 단계).
- **screen-map.md**: "첫날 키워드·모두의 답·정답 공개" 절(영역 높이 표·컴팩트 카드 윗변·입력줄·표식 표·알려진 한계)과 자동 검사 절에 `keyword`·`keyword-sizes`·`early` 흐름과 바뀐 기대.
- **HANDOFF.md**: 5153 → 5564 바이트(≤ 6144). 세 구역 유지. 지금 상태에 23 완료(미배포, 가드), 확인 대기에 키워드 목록 초안 검토(0089-23)·0071~0091 검토·22·23 눈 확인, 다음 할 일 1 을 24 로, 2 에 D1 첫 단계 순서. 22 눈 확인 한 줄은 23 줄과 합쳤다.

## 페이즈 게이트 결과

| 검사 | 명령 | 결과 |
|------|------|------|
| 전체 시험 | `npx vitest run` | 255 파일 통과(+ 5 건너뜀) · 7528 통과 · 238 건너뜀 · 0 실패, 72초 |
| HANDOFF | `test/unit/handoff.test.ts`(위 전체에 포함) | 통과, 5564 바이트 |
| 타입 | `npm run typecheck` | 종료 0, `error TS` 0건 |
| 스크립트 시험 | `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 654 통과 · 0 실패 |
| 빌드 | `npm run build` | 성공(database_id 없이도 통과, D-30 확인 유지) |
| 번들 가드 | `grep -l "Harry Potter" dist/client/assets/*.js` | 일치 0(11개 파일). 서버 번들 `dist/worker/index.js` 에는 있다(서버 전용, 기대) |
| basicDay 간헐 | 단독 재실행 2회 | 6/6 통과 ×2, 전체 실행에서도 통과(이번엔 간헐이 나오지 않았다) |

`npm test` 는 `vitest run` 과 같은 명령이라 `npx vitest run` 으로 돌렸다.

## 위생 검사 (저장소 위생 금지어 git grep)

- 이 계획이 바꾼 파일(0091·0090·product·architecture·screen-map·HANDOFF)과 23 페이즈 디렉터리: **결과 없음**.
- 저장소 전체: 남은 일치는 모두 이전 계획·보관본의 것이다 — `docs/portfolio-request.md` 의 규칙 문장 한 건, `.planning/milestones/v2.0-phases/*` 보관본의 일반 용례, 13~22 페이즈 VERIFICATION·SUMMARY 가 위생 검사 결과를 적으며 검사 낱말을 인용한 줄들. 이 계획이 만든 것은 없고 고치지 않았다(보관 문서·범위 밖). 검사 패턴 원문은 이 SUMMARY·0091·HANDOFF 어디에도 적지 않았다.

## Deviations from Plan

### Auto-fixed Issues

없음 — 계획대로 실행했다. 다만 두 가지 작은 사항:

1. `npm test` 대신 `npx vitest run`(동일 명령)을 썼다.
2. `answerOpenOf`·`Keyword.tsx` 등 코드 이름을 문서에 적을 때 실제 파일(`shared/game/room.ts` 의 서버 전용 키 `answerSubmits`·`Player.answerDraft`·`keywordProbed`·`startedAt`·`gameId`)을 읽고 맞췄다. `keywordAnswers` 는 서버 전용이 아니라 공개 값이라 구조 문서에서 공개 쪽에 적었다.

## 하지 않은 것 · 확인하지 못한 것

- 배포·원격 D1(`wrangler d1 create`·원격 마이그레이션·`--remote`)·폰 6종 전체 회귀·실기기 확인은 하지 않았다(24, D-19·0089-25). 24 가 돌릴 명령 순서는 0091-18 과 HANDOFF 에 있다.
- 브라우저 E2E 는 이 계획에서 다시 돌리지 않았다(23-12 의 로컬 결과를 문서에 옮겼다).
- 문서의 숫자(영역 높이·컴팩트 카드 윗변)는 UI-SPEC 표를 그대로 옮긴 값이고 이 계획에서 화면으로 재측정하지 않았다.

## Known Stubs

없음. 문서 변경뿐이다.

## Threat Flags

없음. 새 코드·표면 없음. T-23-46(위생)은 위 검사로, T-23-47(비밀값)은 0091·HANDOFF 가 명령 순서만 적고 `database_id`·토큰 값을 적지 않아 닫았다.

## Self-Check: PASSED

- 파일: docs/decisions/0091-v3-keyword-day-one.md, docs/product.md, docs/architecture.md, docs/screen-map.md, HANDOFF.md 모두 존재.
- 커밋 5d5a2549·cd2eab70·865df2e7 모두 HEAD 의 조상.
- 수용 기준: 0091 결정 줄 24 ≥ 12, 0090 에 0091 1줄, "d1 create" 1줄, product "정답 공개" 2줄, architecture·screen-map 0091 각 4·3줄, "23페이즈가 토론 앞에 끼운다" 0줄, HANDOFF 5564 ≤ 6144·0091 4줄.
