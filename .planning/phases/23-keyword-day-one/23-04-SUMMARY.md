---
phase: 23-keyword-day-one
plan: "04"
subsystem: game-rules
tags: [keyword, wordlist, invariants, tdd]
requires: ["23-01", "23-03"]
provides:
  - "shared/game/keywords.ts: GENRES 7장르 306개 키워드 초안(영화·음식·동물·장소·스포츠·물건·나라), 파일 머리 '초안, 사용자 검토 대기(0089-23)'"
  - "test/unit/keywords.test.ts: keywordListProblems 순수 검사 함수 + 항목·크기 불변식 시험"
affects: [23-06, 23-07]
actuals:
  tokens: 8500
  tasks: 2
  commits: 4
plan_head_before: 46f504b2453245554a1aaafc5fc3da9401ea59ae
plan_head_after: 84e054bce8a6759fcdf12490668cbf540b85d12f
tech-stack:
  added: []
  patterns:
    - "목록 불변식은 순수 함수 keywordListProblems(genres) 로 두고 실제 목록과 일부러 깨뜨린 목록 모두에 돌린다"
    - "별칭은 정규화(NFKC·글자숫자만·소문자) 기준으로 한 번만 적는다 — 대소문자·띄어쓰기만 다른 형태는 판정이 같이 막는다"
key-files:
  created:
    - test/unit/keywords.test.ts
  modified:
    - shared/game/keywords.ts
    - test/unit/keywordFlow.test.ts
requirements: [SC5, SC2]
status: complete
---

# Phase 23 Plan 04: 키워드 목록 초안 7장르 Summary

23-01 의 영화 장르에 음식·동물·장소·스포츠·물건·나라 여섯 장르를 더해 7장르 306개 키워드(별칭 포함)를 한 파일에 채웠고, 목록이 지켜야 할 불변식(자소 상한·정규화 충돌·역할 문자열 금지·판정 자기 검사)을 시험으로 먼저 썼다. 목록은 Claude 초안이며 사용자 검토를 기다린다(0089-23).

## 장르별 단어 수

| 장르 | id | 라벨 | 단어 수 |
|------|----|------|---------|
| 영화 | movie | 영화 | 33 |
| 음식 | food | 음식 | 45 |
| 동물 | animal | 동물 | 45 |
| 장소 | place | 장소 | 47 |
| 스포츠 | sport | 스포츠 | 42 |
| 물건 | object | 물건 | 51 |
| 나라 | country | 나라 | 43 |
| 합계 | | | 306 |

모든 항목에 별칭이 1개 이상(한국어 변형·영어 표기·짧은 이름)이다. 사용자 검토 대기(0089-23) — 단어·별칭의 추가·삭제는 검토 뒤에 한다.

## 한 일

- **Task 1 (TDD)**: `keywordListProblems(genres)` 와 항목 불변식 시험을 먼저 썼다.
  - RED: 시험 10개 중 2개 실패 — 실제 목록 위반 35건(전부 영화 장르의 정규화 중복 별칭), 음식·동물·장소 장르 없음. 깨진 목록 시험(한 글자 단어·13자소 단어·`Police` 별칭·같은 정규화 단어·자기/타 항목 단어 별칭·항목 안 중복·한국어 역할 단어 별칭·라벨 6자소 초과)은 각각 위반 1건을 낸다.
  - GREEN: 영화 별칭 중복을 정리하고 음식·동물·장소 장르를 넣었다.
- **Task 2 (TDD)**: 크기 불변식(장르 6~8·장르마다 30↑·전체 210↑·장르 id 7개 순서·별칭 1개↑)과 `pickKeyword(seededRandInt(s))` s=1..50 조회·장르 분산(둘 이상) 시험을 더했다.
  - RED: 2개 실패(장르 4개).
  - GREEN: 스포츠·물건·나라 장르를 넣어 통과.
- 불변식 전부가 7장르 전체에서 통과한다(위반 0건): 장르 id·라벨 유일, 라벨 6자소 이하, 단어 2~12자소, 정규화 단어 전체 유일, 별칭 정규화 길이 2↑·자기 단어와 다름·항목 안 유일·다른 항목 단어와 다름, `mafia|police|doctor|citizen|role|none` 부분 문자열 없음, 한국어 역할 단어(마피아·시민·경찰·의사)가 단어·별칭 전체가 되지 않음, 모든 형태와 공백 삽입·점 삽입·대문자 변형이 `violatesKeyword` 로 막힘.

## 3글자 단어·별칭 고른 기준

`violatesKeyword` 는 3글자 이상(완성형 음절만) 형태의 초성열이 답의 초성열에 들어 있으면 막는다(23-03). 시민이 이유 없이 막히지 않도록 아주 흔한 초성 조합은 단어·별칭 모두에서 뺐다. 시험은 하지 않는다(계획대로).

- 뺀 단어: 고양이(ㄱㅇㅇ)·원숭이(ㅇㅅㅇ)·오징어(ㅇㅈㅇ)·달리기(ㄷㄹㄱ)·줄넘기(ㅈㄴㄱ)·무인도(ㅁㅇㄷ)·설악산(ㅅㅇㅅ 연쇄)·운동화(ㅇㄷㅎ)·장난감(ㅈㄴㄱ)·젓가락(ㅈㄱㄹ)·남아공(ㄴㅇㄱ)·에어컨(ㅇㅇㅋ)·이어폰(ㅇㅇㅍ)·다이빙(ㄷㅇㅂ).
- 뺀 별칭: 손거울·긴의자·가위질·곰인형·화장지·돋보기·냉동실·장우산·아르헨·에이레·인디아·벨지움·볼더링·말타기·오륜기·홀인원·자유형·제주말 등(생각을·개인적·아이를·어디야·봤더라·마트가 류와 겹침).
- 남긴 한계: 강아지(ㄱㅇㅈ)·냉장고(ㄴㅈㄱ)·스위스(ㅅㅇㅅ)·스웨덴·사우디(ㅅㅇㄷ)·자전거·거북이 등은 겹침 가능성이 낮다고 보아 남겼다. 사우디·자장면은 빼면 누설이 더 커서 남겼다. 이 한계는 23-03 과 같다(결정 0091 에 기록).
- 상표·특정 인물 실명은 피했다(작품·사물·장소 이름 위주). 푸바오·킹콩·루돌프 같은 별칭은 동물·캐릭터 이름이다.

## 검증

- `npx vitest run test/unit/keywords.test.ts test/unit/keywordGuard.test.ts test/unit/keywordFlow.test.ts` — 3 파일 56개 통과.
- `npm run typecheck` — 통과(종료 코드 0).
- `npx vitest run test/unit` 전체 — 126 파일 통과(4203 통과, 99 건너뜀, 실패 0).
- 계획 인수 기준: `grep -cE 'id: "(movie|food|animal|place|sport|object|country)"'` = 7, `grep -c '초안, 사용자 검토 대기'` = 1.
- 워커·E2E·클라이언트 시험은 돌리지 않았다(이 계획은 목록 데이터와 단위 시험만 바꾼다. 워커 setup 이 키워드 스위치를 끈다).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 23-01 영화 장르의 정규화 중복 별칭 정리**
- **Found during:** Task 1 RED(실제 목록 위반 35건)
- **Issue:** `Titanic`/`titanic`, `Spider-Man`/`spider man`, `쥬라기 공원`(= 자기 단어) 처럼 대소문자·띄어쓰기만 다른 별칭이 있어 "별칭 정규화 유일·자기 단어와 다름" 불변식을 어겼다. 판정은 정규화로 같은 형태를 막으므로 동작에는 영향이 없었다.
- **Fix:** 정규화가 같은 형태를 한 번만 남겼다(반지의 제왕·미션 임파서블 등 공백 변형, 올드보이 `Old Boy`, 아이언맨 `iron man` 등). `쥐라기공원` 같은 서로 다른 철자는 남겼다.
- **Files modified:** shared/game/keywords.ts
- **Commit:** a022802a

**2. [Rule 1 - Bug] keywordFlow 의 영화 라벨 고정 단언 제거**
- **Found during:** Task 1 GREEN(장르가 늘면서 시드 3 이 음식을 골라 실패)
- **Issue:** `test/unit/keywordFlow.test.ts` 가 `view.day.keyword` 를 `{ genre: "영화" }` 로 고정해, 장르가 하나뿐이라는 전제에 기대고 있었다.
- **Fix:** 바로 위 줄의 `genreLabelOf(state.keyword.genre)` 단언이 같은 계약을 지키므로 고정 줄만 뺐다.
- **Files modified:** test/unit/keywordFlow.test.ts
- **Commit:** a022802a

## Known Stubs

없음. 목록은 의도한 초안이며 사용자 검토(0089-23) 전까지 확정이 아니다 — 스텁이 아니라 계획된 검토 대기 상태다.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다. T-23-12(역할 문자열)·T-23-14(정규화 충돌)는 불변식 시험으로 완화했고, T-23-13(공개 저장소의 목록)은 계획대로 수용한다.

## Carry-over

- 키워드 목록은 사용자 검토 대기(0089-23). 검토 뒤 단어·별칭을 고쳐도 `keywords.test.ts` 불변식이 자동으로 지킨다.
- 알려진 한계(3글자 초성 겹침)는 결정 0091 기록 몫이다(이 계획에서 문서는 건드리지 않았다).

## Self-Check: PASSED

- FOUND: shared/game/keywords.ts, test/unit/keywords.test.ts
- 커밋 4개 모두 HEAD 의 조상: 58fb486b, a022802a, 9aea2275, 84e054bc
