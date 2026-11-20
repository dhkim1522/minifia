# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 시험판**(`v3`)에 [B안 달빛 누아르](docs/decisions/0093-v3-noir-visual-redesign.md)를 두 맵의 3D 공간·조명, 캐릭터·유령·초상화·의상·배경 이미지, 홈부터 결과까지의 공통 UI에 적용했다. **22** 낮은 토론 → 찬반 → 지목 → 유언 → 처형(결정 0090). **23** 첫날 키워드와 정답 공개, 조기 진행, D1 판 기록(결정 0091). **24-01~07** 구현 완료.
- [동물 12종](docs/decisions/0102-animal-characters.md)은 3D 모델·초상·의상을 공유한다. [공용 화면](docs/decisions/0100-home-art-and-discussion-controls.md)의 채팅은 하단에 두고, [단계의 선택과 결과](docs/decisions/0103-phase-events.md)는 중앙에서 진행한다.
- **공개 v3** `2026-11-20T03:20:41Z+4a93ef88`. 재즈 바 고정 착석·눈높이·가리키기와 반투명 관전 캐릭터 배포. `/api/health`와 390px 지목·유령·유언 E2E 129건 통과. [첫날 실험방](https://minifia-v3.dhplay.workers.dev/?playtest=1).
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`. 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터·맵**의 B안 모델은 `src/world/character.ts`, `src/world/ghost3d.ts`, `src/world/maps/`에 있다. 시안은 `design/v3.0/redesign/b-noir.png`. 이미지 재생성은 [에셋 자동 검사](docs/screen-map.md#에셋-자동-검사) 참고.
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`, 방장이 고름). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 버전은 `/api/health`. `npm run e2e` 기본은 공개판, 로컬은 `-- --url http://localhost:5173 --only 흐름1,흐름2`. 모바일 전체 회귀는 나누어 실행하고 간헐 실패는 단독 재검수한다. `backdrop-filter`는 비접두 한 번만 쓴다.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 세부는 `docs/playtest-v2.0-feedback.md`. 다시 묻지 않는다. 새 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0091 과 각 페이즈 UI-SPEC "기본값 기록"은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다. 0090-8: 유언 10초에 몸동작도 막았다(살리려면 audience 분기 필요).
- **키워드 목록 초안 검토(0089-23)**: `shared/game/keywords.ts` 7장르 306개, 사용자 검토 대기. 3글자 초성 우연 겹침(고양이↔가을이) 등 알려진 한계는 0091-19.
- **실기기 확인**은 유령·유언·처형, 작은 화면의 키보드·답 인용, 의심딱지와 BGM·효과음 균형을 본다. 아침을 놓친 경우 그날 유언은 공개 채팅에서 읽는다.
- **18.1·18 눈 확인**: 헤더 시간대 글자·내 캐릭터 움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083), 광장·바의 아침·낮·저녁 조명(약하면 바 창 빛).
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속. 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 밤 확장 시나리오 여섯은 개별 통과했다. 마피아 선택 불일치의 아침 화면 6초 대기는 첫 실행에서 초과해 단독 재실행으로 확인했다. 꺼진 정치 장치 흐름 여섯은 켤 때 고친다.

## 다음 할 일

- **다음 첫날 라이어게임**. [고정 좌석 및 유령 시야 결정](docs/decisions/0108-seated-bar-play.md). [인원별 배치](design/v3.0/seated-camera-review/seating-review.webp), [12종 얼굴 전후](design/v3.0/seated-camera-review/character-comparison.webp), [배경·소품 전후](design/v3.0/seated-camera-review/room-comparison.webp).

1. **재즈 바 검수**. 390px 4~8인 좌석·시점, 320px 8인 지목·딱지·재접속을 확인했다. 8인 눈높이 62 draw call, 전체 94. 생존자와 관전자의 아침 화면을 대조했고 관전자 3D 불투명도 0.60을 확인했다. 처형된 유령은 아침까지 마지막 중앙 위치에서 시작한다. 실기기 GPU와 키보드는 확인 대기.
2. **실기기**. 작은 폰의 키보드와 채팅·이름표, 소리 크기, 처음 온 사람이 채팅 없이 단서와 의심딱지를 쓸 수 있는지 팀에서 확인한다. 결과로 실험방의 기본 적용 범위를 판단한다. 24페이즈의 남은 모바일 전체 회귀와 실기기 항목을 확인한 뒤 main 반영을 판단한다.
