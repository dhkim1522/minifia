# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 구현 중(브랜치 `v3`)**: 13~18페이즈 완료·배포(결정 0072~0081-1). **18(바로 고칠 것)이 끝났다** — 옷 중복 해소·옷장 잠금, 낮 조명, 튜토리얼 스포트라이트·[다음] 알약, 낡은 문구, UAT gap 조명·smoke 수정(18-12~14). 배포 version `2026-11-10T10:31:13Z+722eb565`(minifia-v3). 17 튜토리얼(결정 0078·0080)은 혼자 하기(서버 0)와 방장 스위치로 함께 진행.
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`(페이즈 문서 `v2.0-phases/`). 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **v3.0 시안**: 17 첫 사건 https://claude.ai/artifact/BLPWgYmeQrKJYekHcBPwR8 (사본 `design/v3.0/first-case/`), 16 https://claude.ai/artifact/9y71ePzHX9TamPrkCgt7KT (사본 `design/v3.0/tutorial/`), 15 https://claude.ai/artifact/X9XPJtc6mm3UdihPA6fNYD.
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용, 변화 없음), v1.0 `https://minifia.dhplay.workers.dev`(변화 없음). `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). 전체 로컬 회귀는 약 26분(제한 29분). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0074 와 위임 기본값 표(13·14·15페이즈 각 `*-UI-SPEC.md` "기본값 기록", 15는 0074-7, 16은 0079-11 V-*·A1~A5, 17은 0080-1~19·T-1~T-23, **18은 18-UI-SPEC P18-1~11**)는 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **18 조명 눈 확인**: 광장·바의 아침(서늘한 옅은 푸른빛)·낮(회백)·저녁(노을)이 장면만으로 느껴지는지 배포본에서 본다(측정 PNG `.planning/phases/18-quick-fixes/perf/light-*.png`). 약하면 다음 손잡이는 바 창 빛. 도윤 자리 (1.3, −1.5). nightload 끊김 5~7회/5분.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 모든 배포본에서 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2 점광원 4>3·M1 geometries 35>25 는 13페이즈 전부터 지속. 배포본 smoke full 은 18-14 에서 4/5 통과(편차는 서버 시각 판정, 도착 편차는 정보용; 실패 1회는 HTTP `fetch failed`, 원인 미확정). 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 0073: 360×560 은 띠 때문에 위쪽이 비좁고 [유언]·[보내기] 간격 16→8(실기기 확인), 마지막 5초 숫자 crimson-300. **0074**: 마피아 얼굴 칸의 선택 수 배지가 밤 겉보기 같음의 유일한 예외, 기록 카드가 열려 있으면 이름표가 가려질 수 있음, 마피아 밤 채팅 화면 없음(서버 채널은 유지, 되돌리는 곳은 `GamePanel` 밤 분기). **0079**: 마피아의 가짜 [처리] 무반응은 설명하지 않음(V-25), 기록 없음은 마피아 증거가 아님, 360×560 방장 대기실 열이 두 열로 접힘, E2E errand EO4·witness 시간 초과는 간헐(원인 미확정), 배포 순간 진행 중이던 판의 마피아는 그날만 3/3 가능. **0080**: 360×560 방장 대기실 스테이지 172(패널 326), 390×664 방장은 잠긴 소리 알약이 접히는 8초간 옷장을 가림, 직업 카드 아래 줄·장면 6 이름표가 폭 360 에서 6~7px 넘음, 튜토리얼 체감은 실기기에서, 전체 회귀에서 tutorial-solo 시간 판정이 가끔 흔들림(재실행 통과).

## 다음 할 일

1. **18.1 화면 손보기**(UI-SPEC 끝남) — `/gsd-plan-phase 18.1`. 이어서 19(방장이 고르는 기본 마피아·확장판, 결정 0081-6)·20·21. 17 UAT Test 3(폰 2대)은 실테스트 때.
2. **v3.0 실테스트**는 페이즈 19~21 뒤 한 번에(팀·실기기, 사람이 적으면 대기실 [봇]). v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함. 통과하면 main 반영.
3. 시안용 장면 촬영은 로컬 + 테스트 방·봇(`scripts/gallery.mjs`). 포트폴리오는 v3.0 뒤.
