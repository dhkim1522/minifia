# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 시험판**(`v3`)에 [B안 달빛 누아르](docs/decisions/0093-v3-noir-visual-redesign.md)를 두 맵의 3D 공간·조명, 캐릭터·유령·초상화·의상·배경 이미지, 홈부터 결과까지의 공통 UI에 적용했다. **22** 낮은 토론 → 찬반 → 지목 → 유언 → 처형(결정 0090). **23** 첫날 키워드와 정답 공개, 조기 진행, D1 판 기록(결정 0091). **24-01~07** 구현 완료.
- **공개 v3 배포** `2026-11-18T15:57:22Z+efa0573b`. 기본 방 생성·참가, 기본·실험방 연습 완주, 새 문구로 4인 실험방 첫 아침까지 확인했다. 로컬 360×560·390×844 연습에서 조작과 겹침을 확인했다. 8인·딱지 8장 부하는 결정 0096에 기록했다.
- **B안 로컬 검증**에서 4인 스모크, 대표 E2E 507개, `npm test` 7,851개가 통과했다. Chrome의 두 맵 8인 토론은 약 60fps, 점광원 3개였다. 실제 폰 성능은 팀 실테스트에서 본다.
- **첫날 실험방 (결정 0095~0097)**은 [v3 별도 링크](https://minifia-v3.dhplay.workers.dev/?playtest=1)에서 만든다. [혼자 연습하기]에서 단서·의심딱지·투표 요청·첫 투표·아침 준비를 익힌다. 전원 행동 완료 시 앞당기고 역할 확인과 첫 투표 때 자동 집결한다. 네 역할 카드와 단계별 재즈 BGM을 적용했다.
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`. 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터·맵**의 B안 모델은 `src/world/character.ts`, `src/world/ghost3d.ts`, `src/world/maps/`에 있다. 시안은 `design/v3.0/redesign/b-noir.png`. 이미지 재생성은 [에셋 자동 검사](docs/screen-map.md#에셋-자동-검사) 참고.
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`, 방장이 고름). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). 전체 로컬 회귀는 묶음으로 나눠 돌린다(폰 6종 흐름을 한 묶음에 많이 몰면 부하 간헐이 나온다). 워커 시험(`--project worker`)도 부하 간헐이 있어 실패 파일은 단독 재실행으로 가린다. `backdrop-filter` 는 비접두 한 번만.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 세부는 `docs/playtest-v2.0-feedback.md`. 다시 묻지 않는다. 새 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0091 과 각 페이즈 UI-SPEC "기본값 기록"은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다. 0090-8: 유언 10초에 몸동작도 막았다(살리려면 audience 분기 필요).
- **키워드 목록 초안 검토(0089-23)**: `shared/game/keywords.ts` 7장르 306개, 사용자 검토 대기. 3글자 초성 우연 겹침(고양이↔가을이) 등 알려진 한계는 0091-19.
- **실기기 확인**은 유령·유언·처형, 작은 화면의 키보드·답 인용, 튜토리얼·의심딱지와 BGM·효과음 균형을 본다. 아침을 놓친 경우 그날 유언은 공개 채팅에서 읽는다.
- **18.1·18 눈 확인**: 헤더 시간대 글자·내 캐릭터 움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083), 광장·바의 아침·낮·저녁 조명(약하면 바 창 빛).
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속. 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 확장 E2E `night`는 직전 배포판에서도 피해자 흐름의 `skipTo("execution")`에서 멈춘다. `night-sizes`와 두 맵 밤 화면은 검증했다. 꺼진 정치 장치 흐름 여섯은 켤 때 고친다.

## 다음 할 일

[토론 UI 3안](design/v3.0/redesign/discussion-layouts.webp) 선택 대기. 고정 하단에 인물 직접 조작을 더하는 구성을 추천한다. 버튼은 아이콘 중심, 채팅 내역과 입력은 한 패널, 단계 행동은 고정 위치에서 짧게 강조한다.

1. **첫날 실험방**에서 신규 참가자가 채팅 없이 단서와 의심딱지를 써 보고 투표 이유를 설명하는지 확인한다(결정 0096). 이 결과로 기본 방에 적용할 범위를 판단한다. 24-10 이후 포스트잇·튜토리얼 폰 6종 검증 대기.
2. **24 끝**: 폰 6종 전체 회귀 → minifia-v3 배포·smoke → v3.0 실테스트(17 UAT Test 3 폰 2대, v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함). 통과하면 main 반영. 판 기록 D1은 `npm run games -- --remote`로 확인한다.
