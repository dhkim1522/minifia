# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 개발 완료(배포·확인 대기)**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 산 마피아만 이동, 아침에 분필·유언·쪽지, 결과 시상·다시 하기. 범위 결정 0044, 요구사항·로드맵은 `.planning/`.
- **6~11페이즈 완료**(결정 0057~0069): 월드·채팅·낮 처형과 유령·밤과 아침·정치 장치(0066·0067)·동작과 의상(0068)·결과 공개와 다시 하기·방 연속성·광장 맵(0069). 9페이즈 목표 검증은 `human_needed`(`09-VERIFICATION.md`). 지도는 `docs/architecture.md`·`screen-map.md`.
- **12페이즈 소리·마무리 구현 완료(결정 0070)**: 소리 56개 전부 합성(외부 자산 0, `docs/audio.md`), 끄기 한 단추, 밤 소리 역할 무관, 암살음 피해자만. 마무리 정리·audit·7·8페이즈 리뷰 닫음. 소리 값은 모두 첫 초안, 시험 페이지 `/?sound-lab=1` 로 듣고 조정.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **맵(결정 0050)**: ① 지하 재즈 바 + ③ 시계탑 광장, 방장이 고름·기본 랜덤. 광장 개방(`PLAYABLE_MAPS`, 되돌리려면 `["bar"]`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v2`**(v3.0 은 `v3` 를 새로 만든다). `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 그대로. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`, `--only` 는 부분 문자열이라 묶어 돌린다). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정 16건이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 을 다 만들고 배포한 뒤 한 번에**(v2.0 실기기 칸 `12-TEAM-TEST.md` 도 그때). 단계별 팀 테스트는 없다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **알려진 한계**: `continuity` "옛 방장이 돌아오면" 테스트가 단독 실행 때 절반쯤 5초 초과(후속). 배포본 smoke 는 망 지연으로 간헐 실패(5인 full 1회 통과, 8인·배포 E2E 재실행 필요). `perfbudget` B2 점광원 4>3(기존).

## 다음 할 일

1. v2.0 마일스톤 완료 처리(`/gsd-complete-milestone`). main 은 v1.0 그대로 두고, v3.0 실테스트 통과 뒤 반영한다.
2. `v3` 브랜치를 v2 에서 만들고, 배포 대상은 새 Worker `minifia-v3`(배포 가드에 주소 추가).
3. v3.0 마일스톤 시작(`/gsd-new-milestone`, 입력 `docs/playtest-v2.0-feedback.md`). 단계: ① 사회자 진행(자막 띠·알림음·존댓말)·도구 이름표·숫자 시간·역할 목표 ② 진행 단순화(기본판 하나: 토론→투표→최후 변론→찬반→처형, 직업 주장·귓속말·순차 지목·결선·결전 끔) ③ 낮 심부름(40초·3곳·근처만 보임·마피아 가짜 목록·목격 기록 보상)·밤 흔적 하나.
4. 각 페이즈: UI-SPEC → 계획 → 실행. E2E 는 바뀐 흐름만, 6종 회귀는 페이즈 끝에 한 번. 끝나면 `minifia-v3` 배포까지.
5. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). 이력서용 포트폴리오는 v3.0 뒤(`docs/portfolio-request.md`).
