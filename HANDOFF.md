# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 시험판**(`v3`)은 [B안 달빛 누아르](docs/decisions/0093-v3-noir-visual-redesign.md)의 재즈 바와 공통 화면을 쓴다. **22** 낮은 토론 → 찬반 → 지목 → 유언 → 처형(결정 0090). **23** 첫날 라이어게임과 정답 공개, 조기 진행, D1 판 기록(결정 0091). **24-01~07** 구현 완료.
- [동물 12종](docs/decisions/0102-animal-characters.md)은 3D 모델·초상·의상을 공유한다. [공용 화면](docs/decisions/0100-home-art-and-discussion-controls.md)의 채팅은 하단에 두고, [단계의 선택과 결과](docs/decisions/0103-phase-events.md)는 중앙에서 진행한다.
- **공개 v3** `2026-11-26T07:15:12Z+acc449fc`. [첫날 답안 스크롤·기록 바로가기·발표 배치](docs/decisions/0122-v3-suspect-hold-keyword-reveal-and-will.md), [모바일 원탁 이름표](docs/decisions/0121-player-name-colors.md), [첫 토론 참가자 안내](docs/decisions/0126-v3-first-game-guide.md). 휴대폰 실기기 검수는 대기 중이다. [테스트 방](https://minifia-v3.dhplay.workers.dev/?test=1)
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`. 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터·맵**의 B안 모델은 `src/world/character.ts`, `src/world/ghost3d.ts`, `src/world/maps/`에 있다. 시안은 `design/v3.0/redesign/b-noir.png`. 이미지 재생성은 [에셋 자동 검사](docs/screen-map.md#에셋-자동-검사) 참고.
- **맵**: 일반·테스트·다시 하기 모두 재즈 바. 이전 광장 방은 역할·단계를 유지해 원탁으로 옮긴다. 광장 자료는 개발 측정에서만 쓴다.
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 버전은 `/api/health`. `npm run e2e` 기본은 공개판, 로컬은 `-- --url http://localhost:5173 --only 흐름1,흐름2`. 모바일 전체 회귀는 나누어 실행하고 간헐 실패는 단독 재검수한다. `backdrop-filter`는 비접두 한 번만 쓴다.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 세부는 `docs/playtest-v2.0-feedback.md`. 다시 묻지 않는다. 새 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0091 과 각 페이즈 UI-SPEC "기본값 기록"은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다. 0090-8: 유언 10초에 몸동작도 막았다(살리려면 audience 분기 필요).
- **키워드 목록 초안 검토(0089-23)**: `shared/game/keywords.ts` 7장르 306개, 사용자 검토 대기.
- **실기기 확인**은 유령·유언·처형, 작은 화면의 키보드·답 인용, 의심 고깔과 BGM·효과음 균형을 본다. 아침을 놓친 경우 그날 유언은 공개 채팅에서 읽는다.
- **18.1·18 눈 확인**: 헤더 시간대 글자·움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083), 재즈 바의 아침·낮·저녁 조명.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속. 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 밤 확장 시나리오 여섯은 개별 통과했다. 마피아 선택 불일치의 아침 화면 6초 대기는 첫 실행에서 초과해 단독 재실행으로 확인했다. 꺼진 정치 장치 흐름 여섯은 켤 때 고친다.

## 다음 할 일

- [남은 작업 로드맵](TODO.md)을 위에서부터 진행한다. 다음은 게임 단계별 하단 탭 표시 통일이다. 한 항목씩 실제 게임 화면으로 시안을 먼저 보여 주고 사용자 선택 후 적용한다. 모바일 전체 회귀와 팀·실기기 검수 순서도 로드맵에 있다.
