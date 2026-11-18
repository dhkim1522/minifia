# 미니피아 Codex 작업 지침

## 세션 시작

1. `CLAUDE.md`를 읽는다. 프로젝트 규칙, 문서 지도, GSD 작업 원칙은 이 문서를 기준으로 삼는다.
2. `HANDOFF.md`, 현재 브랜치와 최근 커밋, 해당 페이즈의 `*-PLAN.md`와 `*-SUMMARY.md`를 확인한다. 인계 문서보다 현재 브랜치에 구현 기록이 앞서 있으면 남은 계획부터 이어간다.
3. 작업 범위에 해당하는 `docs/`와 승인된 `design/` 사본을 읽는다. GSD 응답과 `.planning/` 문서는 한국어로 작성한다.

## Codex에서 GSD 사용

- 기존 `.planning/`에서 이어간다. 현재 페이즈 확인은 `$gsd-progress`, 화면 계약은 `$gsd-ui-phase`, 계획은 `$gsd-plan-phase`, 실행과 검증은 `$gsd-execute-phase`와 `$gsd-verify-work`를 사용한다. UI가 있는 새 페이즈는 계획보다 UI-SPEC을 먼저 확정한다.
- 기존 계획의 `@~/.claude-personal/gsd-core/…` 실행 참조는 Codex에서 `.codex/gsd-core/…`의 같은 상대 경로를 읽는다. 계획 파일에 저장된 원래 경로는 Claude에서 사용한다.
- 계획의 의존성과 테스트 기준을 따른다. TDD가 지정된 계획은 실패 시험 → 구현 → 통과 확인 순으로 진행한다. 완료 범위와 검증 결과를 GSD 요약과 인계 문서에 남긴다.
- UI 설계·구현·검토에는 [디자인 참고 자료 스킬](.agents/skills/minifia-design-refs/SKILL.md)을 적용한다. Claude Design 아티팩트로 승인된 내용은 저장소의 `design/` 사본으로 확인한다.
- 게임 규칙과 판정은 서버가 정한다. 다른 사람의 역할은 살아 있는 플레이어에게 보내지 않는다. UI는 장면·아이콘·숫자와 대상을 직접 누르는 조작을 우선한다.
- 개발은 `npm run dev`, 타입 검사는 `npm run typecheck`, 시험은 `npm test`를 사용한다. 로컬 브라우저 E2E는 `npm run e2e -- --url http://localhost:5173`로 실행한다. 배포를 진행할 때는 해당 페이즈에 기록된 검증 순서와 `npm run deploy`의 계정·대상 가드를 따른다.

Codex용 GSD 설치와 확인 명령은 [환경 설정 문서](docs/setup.md#codex에서-gsd-사용)에 있다.
