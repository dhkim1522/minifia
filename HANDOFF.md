# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 진행 중**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 산 마피아만 이동, 아침에 분필·유언·쪽지. 범위 결정 0044, 요구사항·로드맵은 `.planning/`.
- **6~9페이즈 완료**(월드 뼈대·채팅·낮 처형과 유령·밤과 아침, 결정 0057~0061). 09.1(0063·0064)·마피아 밤 선택 효과(0065)·09.1.1 정치·박진감 장치(0066·0067)도 구현. 9페이즈 목표 검증은 `human_needed`(`09-VERIFICATION.md`).
- **10페이즈 캐릭터·동작·의상 구현 완료(결정 0068)**: 입력줄 동작 9종·로비 의상 9종·좌석별 외형·유령 안개 우선. 지도는 `docs/architecture.md`·`screen-map.md`.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **맵(결정 0050)**: ① 지하 재즈 바(6~9페이즈 기준) + ③ 시계탑 광장, 방장이 고름·기본 랜덤(11페이즈). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 그대로. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것은 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **실기기·팀 테스트는 모든 개발이 끝난 뒤 한꺼번에(사용자 결정 2026-11-02)**: 기기 없이 되는 검사는 Claude 가 직접 돌린다. 목록은 ROADMAP 백로그 999.1~6. 9페이즈는 999.6(`09.1-`·`09.1.1-DEVICE-CHECKS` 를 같이 돈다) — iPhone 낮+밤+아침 5분 55fps, 시민 편 어둠 가독, 유언 시트 + iOS 키보드, 얼굴 칸 누르기, 팀 4명 이상 한 판 관찰. **10페이즈 `10-DEVICE-CHECKS.md` 도 추가**(8명 의상·동시 동작 5분 55fps, 동작 판 한 손, 의상 손맛). 값은 모두 기본값, 플레이 뒤 조정(0067·0068).
- **사용자 테스트 피드백**: 묶음 A(결정 0062)·B(0063·0064) 반영 완료(`09-USER-FEEDBACK.md`). 한 판 10~15분은 참고 목표. 사람용 디자인 시스템 아티팩트 갱신 필요(숫자 표시·깃펜·타이머 경고 색·차례 알약·편지·떠 있는 버튼·배지·찬반 묶음·결선·마지막 3인·동작 판·꾸미기 시트). 360×560 경찰 밤 이름표 상승은 그대로 둔다(결정).
- **7·8페이즈 코드 리뷰 open**: `08-REVIEW-DISPOSITION.md`(Info 7), `07-REVIEW-GAPS.md`(경고 3).
- **알려진 한계**: 방 높이 640 이하 폰에서 키보드가 열리면 스테이지 128 미만. 8자 이름표는 폭 360 에서 가장자리가 잘릴 수 있다.
- `npm audit` 취약점 6건(three 무관). 12페이즈 정리 후보: `scripts/uat-night.mjs`(낮 타이머·동률·allyPicks 단언 낡음)·`uat-vote.mjs`(둘 다 옛 15초 동시 지목), `leaderShift`·`DayState.leader`/`sure`, worker `testTools` 'ended' 시험 간헐 실패, `day.css`·`night.css` 의 v1.0 잔재, `MorningView.phrase`·`MORNING_PHRASE_COUNT`, `VERDICT_TEXT.candidateNone`·`votedSuffix`. 배포본 전체 E2E 는 900초를 넘길 수 있어 `--only` 로 나눠 돌린다.

## 다음 할 일

1. 배포본 smoke full 이 느린 망에서 타이밍 검사가 흔들렸다(표 A). 문턱은 낮추지 말고 빠른 망에서 다시 돌린다. E2E 간헐 실패(night-sizes 360x640 PK3, ghost G2)는 지켜본다.
2. 육안·실기기 항목(역할 확인 무대 위 가독, 놋쇠·진홍 타이머, 결과 8인판 스크롤)은 999.6 에 모은다. 끝나면 `/gsd-verify-work 9`·`9.1`. 12페이즈에 차례·편지·핀 조명·판결·결선·한마디 효과음.
3. **10페이즈 미결**(사용자 결정 필요): 경찰·의사 얼굴 목록을 의상 얼굴로, 암살 쓰러지는 동작(09-UI-SPEC 이월, 10-UI-SPEC 에 없음). 밤 시민 편 동작 버튼 부재(O-12)는 플레이 뒤 판단. **11페이즈**: 결과 화면 직업 의상(M-12)·동작 통계·다시 하기 look 유지·방장 맵 탭, 귓속말 본문·주장 이력 공개, 찬반 카드 보관 재검토(0067).
4. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). v1.0 산출물 링크는 `CLAUDE.md`.
5. v2.0 마무리 뒤 이력서용 포트폴리오(GitHub Pages): `docs/portfolio-request.md`(아이콘 반영 포함).
