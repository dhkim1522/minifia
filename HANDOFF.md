# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 개발 완료(배포·확인 대기)**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 산 마피아만 이동, 아침에 분필·유언·쪽지, 결과 시상·다시 하기. 범위 결정 0044, 요구사항·로드맵은 `.planning/`.
- **6~11페이즈 완료**(결정 0057~0069): 월드·채팅·낮 처형과 유령·밤과 아침·정치 장치(0066·0067)·동작과 의상(0068)·결과 공개와 다시 하기·방 연속성·광장 맵(0069). 9페이즈 목표 검증은 `human_needed`(`09-VERIFICATION.md`). 지도는 `docs/architecture.md`·`screen-map.md`.
- **12페이즈 소리·마무리 구현 완료(결정 0070)**: 소리 56개 전부 합성(외부 자산 0, `docs/audio.md`), 끄기 한 단추, 밤 소리 역할 무관, 암살음 피해자만. 마무리 정리·audit·7·8페이즈 리뷰 닫음. 소리 값은 모두 첫 초안, 시험 페이지 `/?sound-lab=1` 로 듣고 조정.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **맵(결정 0050)**: ① 지하 재즈 바 + ③ 시계탑 광장, 방장이 고름·기본 랜덤. 광장 개방(`PLAYABLE_MAPS`, 되돌리려면 `["bar"]`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 그대로. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`, `--only` 는 부분 문자열이라 묶어 돌린다). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것은 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **실기기·팀 테스트는 모든 개발이 끝난 뒤 한꺼번에(사용자 결정 2026-11-02)**: 한 장에 모았다 — `.planning/phases/12-sound-polish/12-TEAM-TEST.md`(999.x·09.1·10·11 칸 + 소리 칸 + 팀 관찰 + 디자인 시스템 아티팩트 갱신 TO-DO). 값은 모두 기본값, 플레이 뒤 조정(0067~0070). 아침에 폰으로 `/?sound-lab=1` 을 열어 소리를 듣는다.
- 한 판 10~15분은 참고 목표. 360×560 경찰 밤 이름표 상승은 그대로 둔다(결정).
- **알려진 한계**: 방 높이 640 이하 폰에서 키보드가 열리면 스테이지 128 미만. 8자 이름표는 폭 360 에서 가장자리가 잘릴 수 있다.
- **사용자 판단**: `leaderShift` 손사래는 코드가 아직 재생해 결정 0067 문구와 다르다(0070-6, 없애면 행동이 바뀐다). `uat-day.mjs` 부활 여부. 합성 음색이 부족하면 id 단위 샘플 교체(하이브리드). 저장소 이력 위생 검사 결과가 흔적이면 원격 재생성은 사용자가 판단·실행.

## 다음 할 일

1. **배포**(오케스트레이터) → 배포본 smoke full + 새 소리 흐름. 이 Mac 의 망이 느려(상태 확인 1.3~1.9초) 이전 smoke 타이밍이 흔들렸으니 망이 좋을 때 한 번 더. 문턱은 낮추지 않는다.
2. `12-TEAM-TEST.md` 처리(실기기·팀) → `/gsd-verify-work` 로 페이즈 닫기(9·9.1·12 등) → v2.0 마일스톤 닫기.
3. E2E 간헐 실패(night-sizes 360x640 PK3, ghost G2)는 지켜본다. `perfbudget` B2 점광원 4>3 은 10페이즈 이전부터라 후속(`bar.ts` 광원 4개).
4. **미결**(플레이 뒤 판단): 경찰·의사 얼굴 목록을 의상 얼굴로, 암살 쓰러지는 동작, 밤 시민 편 동작 버튼, 칭호 임계값 `AWARD_MIN`, 칭호별·귓속말 소리.
5. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). v1.0 산출물 링크는 `CLAUDE.md`.
6. v2.0 마무리 뒤 이력서용 포트폴리오(GitHub Pages): `docs/portfolio-request.md`(아이콘 반영 포함).
