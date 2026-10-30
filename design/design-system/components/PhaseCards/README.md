# PhaseCards

단계가 바뀔 때 장면 위에 잠깐 뜨는 문구 · 카드 묶음이다. 모두 터치를 통과시키고 화면 읽기 도구에는 하단 안내 문장이 대신 읽힌다.

- **SceneIntro**(`src/components/SceneIntro.tsx`): 밤 · 낮 시작 "N일차 / 밤이 되었습니다 · 낮이 되었습니다" 2초, 36px + `shadow-text`. 낮은 보조줄 "토론 전에 먼저 직업을 공개해요". 재접속 · 처음 마운트에서는 뜨지 않는다(결정 0030).
- **NoExecutionCard**(`src/components/NoExecutionCard.tsx`): 찬성 과반이 아니거나 후보 표가 없을 때 회색 카드 "처형 무효 · 찬성이 과반이 아니에요", 밤 시작 위에 뜨고 1.6초 뒤 밤 문구(결정 0036 · 0037).
- **MorningCard**(`src/components/MorningCard.tsx`): 아침 5초 동안 밤 결과. 탈락 문구는 여러 개 중 무작위(결정 0019), 아무도 없으면 "아무 일도 없었습니다".
- 처형 카드는 `Spotlight`, '처형 투표' 카드는 `VoteParts` 를 본다.
