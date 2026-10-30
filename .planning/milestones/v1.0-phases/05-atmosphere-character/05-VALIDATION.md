---
phase: "5"
slug: atmosphere-character
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-30"
---

# Phase 5 — 검증 전략 (분위기와 캐릭터)

## 시험 인프라

| 항목 | 값 |
|------|----|
| **프레임워크** | vitest 4 (projects: unit / client / worker), E2E 순수 판정은 `node --test` |
| **설정 파일** | `vitest.config.ts` |
| **빠른 실행** | `npx vitest run test/unit/scenes.test.ts test/unit/dayTable.test.ts test/client/guide.test.tsx test/client/useWakeLock.test.tsx test/client/atmosphere.test.tsx test/client/characterAudit.test.tsx test/unit/nyquist-05-seats-fit.test.ts` |
| **전체 실행** | `npx vitest run` 및 `node --test scripts/e2e/lib.test.mjs` |

## 요구사항별 검증 지도

| 요구사항 | 동작 | 시험 파일 | 상태 |
|----------|------|-----------|------|
| LOOK-01 | 밤 비네팅·아침 밝아짐 상수, 층 렌더 조건, CSS 규칙 | `test/unit/scenes.test.ts`, `test/client/atmosphere.test.tsx`, `test/unit/atmosphereCss.test.ts` | ✅ green |
| CHAR-01 | 8종 서로 다른 외형, 닉네임 이름표 | `test/client/characterAudit.test.tsx`, `test/unit/assets.test.ts` | ✅ green |
| CHAR-01 | 입장·나가기·강퇴가 섞여도 앉은 사람 전원 외형 중복 없음 | `test/unit/nyquist-05-seats-fit.test.ts` | ✅ green (신규) |
| UX-01 | 단계별 안내 문장·타이머, 상수 동일성 | `test/client/guide.test.tsx`, `test/unit/scenes.test.ts`, `test/unit/e2eContract.test.ts` | ✅ green |
| UX-02 | 짧은 장면 압축, 299 이상 불변 | `test/unit/dayTable.test.ts`, `test/client/dayTable.test.tsx`, `test/client/testToolsCompact.test.tsx`, `test/client/joinByLink.test.tsx` | ✅ green |
| UX-02 | 빈 자리 번호 × 모든 내 자리 시점에서 넘침 없음 | `test/unit/nyquist-05-seats-fit.test.ts` | ✅ green (신규) |
| CONN-03 | Wake Lock 요청·재요청·해제·거부·미지원 | `test/client/useWakeLock.test.tsx`, `test/client/roomScreen.test.tsx` | ✅ green |

## 수동 전용 검증

| 동작 | 요구사항 | 이유 | 방법 |
|------|----------|------|------|
| 비네팅·아침 밝아짐 체감, iOS Wake Lock 실효, 짧은 폰·링크 참가 7명 | LOOK-01, CONN-03, UX-02 | 배포본 E2E·실기기 | `05-UAT.md` ⑨~⑮ 사용자 승인 완료 (2026-10-30) |

## 검증 감사

## Validation Audit

감사일: 2026-10-30

| 항목 | 수 |
|------|----|
| 발견된 갭 | 2 (PARTIAL) |
| 해결 | 2 |
| 에스컬레이션 | 0 |

- 갭 1: 좌석 배정이 `lowestFreeSeat` 라서 중복 없음이 보장된다는 점이 입장·퇴장 섞임 상태에서 시험되지 않았다. 해결: 무작위 500단계 × 20 시드.
- 갭 2: 짧은 장면 압축 시험이 연속 자리 번호·내 자리 0 만 다뤘다. 해결: 빈 자리 번호 4조 × 모든 내 자리 × 높이 240~298 × 폭 4종.
- 구현 결함 없음.
