# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 진행 중**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 범위 결정 0044, 요구사항·로드맵은 `.planning/`. 역할·승패 규칙은 그대로.
- **6페이즈 "월드 뼈대" 완료(2026-11-01)**: 로비 = 재즈 바 3D 맵·3D 캐릭터·서버 권위 이동. 렌더 게이트 통과(결정 0057), 숫자는 `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md`.
- **7페이즈 "자유 채팅" 완료(2026-11-02, 27계획, UAT·검증 통과)**: 로비·낮 자유 채팅, 밤 마피아·탈락자 채널은 서버 audience 로만 전달(다른 편 폰으로는 네트워크로도 안 감), 머리 위 "…", 서버 D5 제한·막힘 알림, 재접속 채널별 30줄 복원(결정 0058), 순차 주장·빠른 메시지·이모티콘 삭제. 배포 `22ca18d`(health `2026-11-02T05:46:59Z+22ca18d`). 갭 수정(07-23~07-27): 로비 이동은 내 캐릭터 예측 + 구간 교체 150ms 섞기(결정 0059, G-07-9 — 배포본 E2E W11·W12 6개 크기 통과), 낮 시작 문구 정리(WR-03, 07-UAT 8, N8 통과). 단위 3897·smoke·배포본 E2E 통과. 실기기 항목은 ROADMAP 백로그 999.1~4 로 이월.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). `design/v2.0/3d/mf3d.js` 의 캐릭터는 옛 방식이라 쓰지 않는다.
- **맵(결정 0050)**: v2.0 은 ① 지하 재즈 바(6~9페이즈 기준) + ③ 시계탑 광장, 방장이 고르고 기본 랜덤(11페이즈). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **지목 표시(결정 0049)**: 손가락 지목 + 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 메시지, 선두·과반 연출.
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(v1.0). 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만.
- **화면설계서 승인(2026-10-31)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs (사본 `design/v2.0/screens/`, 21화면). 마피아는 걸어가 고르고 둘이 같으면 "확정", 채팅 [전체][마피아][유령] 탭(결정 0054).
- 2026-11-02 원격 이력 재작성(강제 push): 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 게임 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **실기기 확인은 모든 개발이 끝난 뒤 한꺼번에(사용자 결정 2026-11-02)**: 페이즈마다 하지 않는다. 기기 없이 되는 검사는 Claude 가 직접 돌린다. 쌓인 목록: ROADMAP 백로그 999.1~4(07-UAT 5 iPhone 5분 채팅 부하·열감, 6 `?chat-mock=1` 다섯 줄, 7 Android Chrome·삼성 인터넷·카카오톡 인앱(CHAT-05), 9 로비 이동 체감). 절차는 `07-DEVICE-CHECKS.md`.
- **7페이즈 코드 리뷰 경고 3건(open)**: WR-01 로비 좌석 재사용 시 입장 전 `all` 줄 복원·옛 줄 이름 바뀜, WR-02 로비 시스템 줄 시각 보정 없음, GR-WR-01 150ms 안 둘째 탭을 서버가 버리면 1.5초 뒤 거짓 알림·되돌림(`07-REVIEW-GAPS.md`). WR-03 은 07-23 에서 닫힘. `07-REVIEW-DISPOSITION.md`.
- **알려진 한계**: 작은 폰(방 높이 640 이하)에서 키보드가 열리면 스테이지가 128 미만, 테이블 화면은 올라온 패널이 아래 인물을 가린다(8페이즈에서 테이블 틀 삭제).
- **UI-SPEC D1 이월**: 처형 여부 투표·후보 선택·공개 연출·아침 화면의 채팅 입력줄은 8·9페이즈가 붙인다(서버는 이 단계 채팅을 이미 받는다).
- **이름표 폭**: 내 이름표 + 이모지 8자 202.4px > `NAMETAG_MAX_W` 180 — "일단 허용"(2026-11-01), 나중에 다시 본다.
- 결정 0056 완화(D9·D3b·G2·D2·P10)는 8~9페이즈에 v1.0 고정 테이블을 지울 때 함께 지운다.
- `npm audit` 기존 의존성 취약점 6건, three 무관. 정리 후보: `DayTableSeat.onPress`, `public/characters/host/host_badge.svg`, `scripts/e2e` reconnect RC1 병렬 실패·gallery citizen(`deferred-items.md`), 배포본 전체 E2E 가 900초 제한을 넘김(reconnect 단독 311초, 흐름을 나눠 돌리면 통과), `design/design-system/components/PhaseCards/README.md` 5행의 옛 낮 보조줄(디자인 시스템은 메인 세션에서만 고침).

## 다음 할 일

1. **`/clear` 후 `/gsd-plan-phase 8`** (낮 처형과 유령). UI-SPEC 승인(`08-UI-SPEC.md`, 2026-11-02). 사용자 확정: A1 테이블 삭제 + 밤·아침은 맵 위 임시 틀(9페이즈가 대체, 8·9 합치지 않음), A2 [역할 카드]는 시간 링 왼쪽, A3 지목 과반이어도 마감까지, A4 유령은 모든 단계 이동 가능.
2. three `0.186.1` 고정, 로비는 재즈 바 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
3. v1.0 산출물 링크는 `CLAUDE.md`.
4. v2.0 마무리 뒤 이력서용 포트폴리오(GitHub Pages): `docs/portfolio-request.md`.
