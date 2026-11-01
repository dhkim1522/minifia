# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 진행 중**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 범위 결정 0044, 요구사항·로드맵은 `.planning/`. 역할·승패 규칙은 그대로.
- **6페이즈 "월드 뼈대" 완료(2026-11-01)**: 로비 = 재즈 바 3D 맵·3D 캐릭터·서버 권위 이동. 렌더 게이트 통과(결정 0057), 숫자는 `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md`.
- **7페이즈 "자유 채팅" 코드 완료·배포(2026-11-02, 22계획)**: 로비·낮 자유 채팅, 밤 마피아·탈락자 채널은 서버 audience 로만 전달(다른 편 폰으로는 네트워크로도 안 감), 머리 위 "…", 서버 D5 제한·막힘 알림, 재접속 채널별 30줄 복원(결정 0058), 순차 주장·빠른 메시지·이모티콘 삭제. 배포 `4147d32`(health `2026-11-01T18:04:02Z+4147d32`). 배포본 smoke·E2E chat 전부 통과, 채팅 부하 5분 평균 60.00fps·끊김 0(Mac Chrome CPU 4배). **iPhone 실기기 확인은 아직 안 됨** — 결과 문서 `.planning/phases/07-free-chat/07-DEVICE-CHECKS.md`.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). `design/v2.0/3d/mf3d.js` 의 캐릭터는 옛 방식이라 쓰지 않는다.
- **맵(결정 0050)**: v2.0 은 ① 지하 재즈 바(6~9페이즈 기준) + ③ 시계탑 광장, 방장이 고르고 기본 랜덤(11페이즈). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **지목 표시(결정 0049)**: 손가락 지목 + 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 메시지, 선두·과반 연출.
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(v1.0). 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만.
- **화면설계서 승인(2026-10-31)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs (사본 `design/v2.0/screens/`, 21화면). 마피아는 걸어가 고르고 둘이 같으면 "확정", 채팅 [전체][마피아][유령] 탭(결정 0054).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 게임 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **iPhone 16 Pro 실기기(Safari·iOS용 Chrome)**: 합격 검사 1~7·한글 IME·머리 위 "…"·5분 채팅 부하 체감·`?chat-mock=1` 다섯 줄. 절차는 `07-DEVICE-CHECKS.md` 맨 아래. 끝나기 전엔 성공 기준 3(CHAT-05)을 닫지 않는다.
- **이월 후보 기기**: Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android)은 미확인. 검증 때 9페이즈 팀 테스트로 이월할지 묻는다.
- **낮 시작 옛 직업 공개 문구**: `PHASE_INTRO.dayAnnounce.sub`·`PHASE_GUIDE_FILL.dayAnnounce.guide` 에 순차 주장 문장이 남아 있다. 안은 `.planning/phases/07-free-chat/deferred-items.md`. 고치면 `scenes.test.ts`·`scripts/e2e/lib.mjs` 가 같이 바뀐다.
- **7페이즈 코드 리뷰 경고 3건(open)**: WR-01 로비 좌석 재사용 시 입장 전 `all` 줄 복원·옛 줄 이름 바뀜, WR-02 로비 시스템 줄 시각 보정 없음, WR-03 위 문구. 추천은 `/gsd-code-review 07 --fix` 뒤 재배포(고치면 iPhone 확인 대상 빌드가 바뀐다). `07-REVIEW-DISPOSITION.md`.
- **알려진 한계**: 작은 폰(방 높이 640 이하)에서 키보드가 열리면 스테이지가 128 미만, 테이블 화면은 올라온 패널이 아래 인물을 가린다(8페이즈에서 테이블 틀 삭제).
- **UI-SPEC D1 이월**: 처형 여부 투표·후보 선택·공개 연출·아침 화면의 채팅 입력줄은 8·9페이즈가 붙인다(서버는 이 단계 채팅을 이미 받는다).
- **이름표 폭**: 내 이름표 + 이모지 8자 202.4px > `NAMETAG_MAX_W` 180 — "일단 허용"(2026-11-01), 나중에 다시 본다.
- 결정 0056 완화(D9·D3b·G2·D2·P10)는 8~9페이즈에 v1.0 고정 테이블을 지울 때 함께 지운다.
- `npm audit` 기존 의존성 취약점 6건, three 무관. 정리 후보: `DayTableSeat.onPress`, `public/characters/host/host_badge.svg`, `scripts/e2e` reconnect RC1 병렬 실패·gallery citizen(`deferred-items.md`).

## 다음 할 일

1. **7페이즈 검증**: 자동 검증은 끝남(검증 human_needed, 보안 56/56 closed, UI 20/24, 회귀 통과). `/gsd-verify-work 7` — `07-UAT.md` 8항목(iPhone 확인·이월 기기·문구)을 처리한다. 이어서 8페이즈 `/gsd-ui-phase 8`.
2. three `0.186.1` 고정, 로비는 재즈 바 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
3. v1.0 산출물 링크는 `CLAUDE.md`.
