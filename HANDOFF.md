# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 시작(2026-10-30~31)**: 팀 피드백 → 범위(결정 0044) → 리서치(`.planning/research/`) → 요구사항 45개 → 로드맵 6~12페이즈 승인. 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 역할·승패 규칙은 그대로.
- **캐릭터(결정 0047·0048)**: 1번 시안의 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). 의상 9종, 모자는 머리를 덮는다. `design/v2.0/3d/mf3d.js` 의 캐릭터는 0048 이전 방식이라 쓰지 않는다.
- **맵(결정 0050)**: 캐릭터 비율로 새로 짓는다. v2.0 은 ① 지하 재즈 바(6~9페이즈 기준 맵) + ③ 시계탑 광장, 방장이 로비에서 고르고 기본 랜덤(MAP-06, 11페이즈). ②법정 ④만찬 ⑤룰렛은 나중 업데이트. 모이는 장치(서는 자리 8·가운데 변론 무대·단계별 조명)는 공통 부품. 블록아웃 캔버스 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`: 엔진 `blockout.js` + 맵별 파일). 기존 응접실·광장(0046, `design/v2.0/3d/`·`backgrounds/`)은 대체됨.
- **지목 표시(결정 0049)**: 손가락 지목 + 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 메시지, 선두(배지 맥박·빛 모임)·과반("유력" 도장·조명 낮춤·카메라 다가감) 연출. 맵에 투표 장치·바닥 선 없음.
- **브랜치**: 작업은 **`v2`** 브랜치. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다(v1 브랜치에서만 배포). v2 배포본 https://minifia-v2.dhplay.workers.dev (06-07 첫 배포, Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- **화면설계서 승인(2026-10-31)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs (사본 `design/v2.0/screens/`, 21화면, 로비는 재즈 바 고정). 묶음 A 로비~처형(결정 0051·0053), B 밤·암살·아침·유언·유령(마피아는 걸어가 고르고 둘이 같으면 "확정", 경찰 결과는 밤 끝에 본인만, 유언 깃펜은 채팅 입력줄 감정표현 옆), C 결과·시상식·다시 하기·방장 이양(결정 0054: 장면 위 직업 공개, 한 명씩 무대 시상식, 채팅 [전체][마피아][유령] 탭, 준비 4명↑이면 방장 시작). 칭호 8개는 초안. 디자인 시스템 9판(부품 16종).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다.
- **06-19 iPhone 16 Pro 실측(멈춰 있음)**: Task 1 끝(배포 350b7fb, Chrome 4× 조건 B·Fast 4G 반응 모두 통과, `06-PERF-RESULTS.md`). 실측 7항목 순서는 `06-19-PLAN.md` Task 2. 답을 받으면 조건 A 표를 채우고 Task 3 렌더 게이트 a/b/c 를 묻는다. 배포를 가로지르는 맵 로비 재접속(deployhold)은 미확인 — 재배포 때 확인할지 정할 것.
- **이름표 폭**: 내 이름표 + 이모지 8자 202.4px > `NAMETAG_MAX_W` 180 — 사용자가 "일단 허용"(2026-11-01). `camera.ts` 그대로, 나중에 다시 본다.
- `npm audit` 기존 의존성(zod 등) 취약점 6건(중간 3·높음 3), three 무관. 따로 볼 것.

## 다음 할 일

1. 디자인 단계 끝: 디자인 시스템·화면설계서 승인됨. three `0.186.1` 고정, 로비는 재즈 바 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
2. 6페이즈 실행 중(2026-11-01): 06-01~06-18·06-21 완료(19/21). 결정 0056 개정(G2·D2·P10 같은 범위 완화). 남은 것: 06-19 Task 2(iPhone 실측)·Task 3(렌더 게이트) → 06-20 → 페이즈 검증. 이어서 `/gsd-execute-phase 6`(06-19 는 Task 2 부터).
3. v1.0 산출물 링크는 `CLAUDE.md`.
