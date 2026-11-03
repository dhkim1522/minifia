# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 진행 중**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 범위 결정 0044, 요구사항·로드맵은 `.planning/`. 역할·승패 규칙은 그대로.
- **6페이즈 "월드 뼈대"(2026-11-01)·7페이즈 "자유 채팅"(2026-11-02) 완료**: 재즈 바 3D 맵·3D 캐릭터·서버 권위 이동(결정 0057·0059), 로비·낮·밤 채널 채팅은 서버 audience 로만 전달·재접속 30줄 복원(결정 0058). 상세는 각 페이즈 SUMMARY.
- **8페이즈 "낮 처형과 유령" 완료(2026-11-03, 28계획, 결정 0060, 검증 passed)**: 낮 = 토론 끝내기 → 지목 → 최후 변론(무대 `STAGE_SPOT`) → 찬반(수만 공개) → 처형이 맵 위에서 돌고, 처형된 사람은 유령(불투명도 0.6)으로 끝까지 관전한다. 산 사람의 위치만 전원에게, 유령의 위치는 유령에게만 간다. v1.0 고정 테이블 화면·시험·E2E 흐름은 지웠다. 밤·아침은 맵 위 **임시 틀**(9페이즈가 대체). 역할 배정 화면은 테이블 상자만 뺀 임시 처리(사용자 확정 2026-11-02, 다듬기는 뒤 페이즈). 배포 커밋 `86b9d06`(코드 리뷰 수정 CR-01·WR-01~03 은 아직 미배포)(health `2026-11-02T18:25:46Z+86b9d06`). 배포본 smoke full과 새 E2E 흐름(day·ghost·noexec·night-roles·result·chat-game) 초록(`08-DEVICE-CHECKS.md` 표 A).
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). `design/v2.0/3d/mf3d.js` 의 캐릭터는 옛 방식이라 쓰지 않는다.
- **맵(결정 0050)**: v2.0 은 ① 지하 재즈 바(6~9페이즈 기준) + ③ 시계탑 광장, 방장이 고르고 기본 랜덤(11페이즈). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(v1.0). 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`, `--only 흐름1,흐름2`). CSS `backdrop-filter` 는 비접두 한 번만.
- **화면설계서 승인(2026-10-31)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs (사본 `design/v2.0/screens/`, 21화면). 마피아는 걸어가 고르고 둘이 같으면 "확정", 채팅 [전체][마피아][유령] 탭(결정 0054).
- 2026-11-02 원격 이력 재작성(강제 push): 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 게임 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **실기기 확인은 모든 개발이 끝난 뒤 한꺼번에(사용자 결정 2026-11-02)**: 페이즈마다 하지 않는다. 기기 없이 되는 검사는 Claude 가 직접 돌린다. 쌓인 목록은 ROADMAP 백로그 999.1~5(7페이즈 채팅 부하·`?chat-mock=1`·Android·삼성·카카오톡·로비 이동, 8페이즈 낮 5분 55fps·조명·지목 버튼·키보드 열림 찬반 줄). 절차는 `07-DEVICE-CHECKS.md`, `08-DEVICE-CHECKS.md`.
- **유령 이름표 글자 대비**: 불투명도 0.6 에서 약 1.9~2.5:1(근사). 앱은 안 바꿨다. 실기기에서 읽기 어려우면 값을 정한다(08-DEVICE-CHECKS B3).
- **8페이즈 남은 것**: 코드 리뷰 Info 7건(IN-01~07) open(`08-REVIEW-DISPOSITION.md`). WR-03(E2E 재시도 시 실패 보존)은 다음 배포 뒤 배포본 E2E 로 확인. 08-21 은 TDD 모드 끔 구간이라 TDD 점검이 RED 커밋 없음으로 표시한다(사용자 결정, 갭 아님).
- **7페이즈 코드 리뷰 경고 3건(open)**: WR-01 로비 좌석 재사용 시 입장 전 `all` 줄 복원·옛 줄 이름 바뀜, WR-02 로비 시스템 줄 시각 보정 없음, GR-WR-01 150ms 안 둘째 탭을 서버가 버리면 1.5초 뒤 거짓 알림·되돌림(`07-REVIEW-GAPS.md`).
- **알려진 한계**: 작은 폰(방 높이 640 이하)에서 키보드가 열리면 스테이지가 128 미만. 8자 이름표는 폭 360 에서 가장자리가 잘릴 수 있다(내 이름표 + 이모지 8자 202.4px > `NAMETAG_MAX_W` 180, "일단 허용").
- `npm audit` 기존 의존성 취약점 6건, three 무관. 정리 후보: `public/characters/host/host_badge.svg`, `scripts/uat-vote.mjs`·`uat-night.mjs` 의 옛 처형 상수, `src/styles/day.css` 옛 `.mf-dayscene` 규칙(ROADMAP 999.5), 배포본 전체 E2E 가 900초 제한을 넘길 수 있음(reconnect 단독 311초, `--only` 로 나눠 돌림), `design/design-system/components/PhaseCards/README.md` 5행의 옛 낮 보조줄(디자인 시스템은 메인 세션에서만 고침).

## 다음 할 일

1. **`/gsd-ui-phase 9` → `/gsd-plan-phase 9`** (밤과 아침, 밤·아침 임시 틀 교체, 결정 0044-22, 아침 시작 위치는 9페이즈 논의에서 확정).
2. three `0.186.1` 고정, 로비는 재즈 바 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
3. v1.0 산출물 링크는 `CLAUDE.md`.
4. v2.0 마무리 뒤 이력서용 포트폴리오(GitHub Pages): `docs/portfolio-request.md`.
