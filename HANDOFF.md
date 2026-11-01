# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 시작(2026-10-30~31)**: 팀 피드백 → 범위(결정 0044) → 리서치(`.planning/research/`) → 요구사항 45개 → 로드맵 6~12페이즈 승인. 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 역할·승패 규칙은 그대로.
- **6페이즈 "월드 뼈대" 완료(2026-11-01, 실행 21/21, 페이즈 검증 대기)**: 로비 = 재즈 바 3D 맵·3D 캐릭터·서버 권위 이동(탭해서 걷기), 두 폰에서 서로 보임. 렌더 게이트 **통과**(결정 0057, 사다리 0단계·자동 강등 1~3): iPhone 16 Pro(iOS용 Chrome) vote 5분 59.98fps·열감 차갑다, 크롬 CPU 4배 60fps·끊김 0, Fast 4G 입장→조작 760ms. 숫자는 `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md`.
- **캐릭터(결정 0047·0048)**: 1번 시안의 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). 의상 9종, 모자는 머리를 덮는다. `design/v2.0/3d/mf3d.js` 의 캐릭터는 0048 이전 방식이라 쓰지 않는다.
- **맵(결정 0050)**: 캐릭터 비율로 새로 짓는다. v2.0 은 ① 지하 재즈 바(6~9페이즈 기준 맵) + ③ 시계탑 광장, 방장이 로비에서 고르고 기본 랜덤(MAP-06, 11페이즈). ②법정 ④만찬 ⑤룰렛은 나중 업데이트. 모이는 장치(서는 자리 8·가운데 변론 무대·단계별 조명)는 공통 부품. 블록아웃 캔버스 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`: 엔진 `blockout.js` + 맵별 파일). 기존 응접실·광장(0046, `design/v2.0/3d/`·`backgrounds/`)은 대체됨.
- **지목 표시(결정 0049)**: 손가락 지목 + 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 메시지, 선두(배지 맥박·빛 모임)·과반("유력" 도장·조명 낮춤·카메라 다가감) 연출. 맵에 투표 장치·바닥 선 없음.
- **브랜치**: 작업은 **`v2`** 브랜치. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다(v1 브랜치에서만 배포). v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24, 마지막 배포 `350b7fb`). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- **화면설계서 승인(2026-10-31)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs (사본 `design/v2.0/screens/`, 21화면, 로비는 재즈 바 고정). 묶음 A 로비~처형(결정 0051·0053), B 밤·암살·아침·유언·유령(마피아는 걸어가 고르고 둘이 같으면 "확정", 경찰 결과는 밤 끝에 본인만, 유언 깃펜은 채팅 입력줄 감정표현 옆), C 결과·시상식·다시 하기·방장 이양(결정 0054: 장면 위 직업 공개, 한 명씩 무대 시상식, 채팅 [전체][마피아][유령] 탭, 준비 4명↑이면 방장 시작). 칭호 8개는 초안. 디자인 시스템 9판(부품 16종).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다.
- **이름표 폭**: 내 이름표 + 이모지 8자 202.4px > `NAMETAG_MAX_W` 180 — 사용자가 "일단 허용"(2026-11-01), 나중에 다시 본다.
- **deployhold 미확인**: 맵 로비 위치가 배포를 가로질러 이어지는지 모른다(DO 하이버네이션이라 배포가 소켓을 끊지 않았다). 다음 v2 배포 때 `npm run e2e -- --only deployhold`. CONN-04 는 이 경로가 미확인인 채 완료 표시됐으니 검증이 판단한다.
- **iPhone 미확인(사용자가 건너뜀)**: talk·WebGL 복구·LTE 입장·두 기기 로비·8명 읽힘은 갈음 근거와 함께 9페이즈 팀 테스트(저가 Android·구형 iPhone·카카오톡 인앱)로, `?chat-mock=1` 채팅 확인표는 7페이즈로 이월.
- 결정 0056 완화(D9·D3b·G2·D2·P10)는 8~9페이즈에 v1.0 고정 테이블을 지울 때 함께 지운다.
- `npm audit` 기존 의존성 취약점 6건(중간 3·높음 3), three 무관. 따로 볼 것.
- 정리 후보: 안 쓰는 `DayTableSeat.onPress`, `public/characters/host/host_badge.svg`, 로비 `preloadRoleAssets()` "preloaded but not used" 경고(06-18 deferred-items.md).

## 다음 할 일

1. 6페이즈 검증(`/gsd-verify-work 6`) 뒤 **7페이즈 자유 채팅**: `/gsd-ui-phase 7` 먼저 → `/gsd-plan-phase 7` (입력: 06-PERF-RESULTS 의 채팅 확인표).
2. three `0.186.1` 고정, 로비는 재즈 바 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
3. v1.0 산출물 링크는 `CLAUDE.md`.
