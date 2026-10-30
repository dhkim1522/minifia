# UserRecord

캐릭터를 누르면 여는 그 사람의 기록 카드와 채팅 내역 시트다(결정 0017 · 0023, 원천 `src/components/UserRecordSheet.tsx` · `src/components/ChatHistorySheet.tsx` · `src/game/recordRows.ts`).

- 유저 기록 카드: 이름(자리 색 점)과 일차별 줄 — 직업 주장, 처형 여부 표, 후보 선택. 공개된 정보만 담는다. 밤에는 열리지 않는다.
- 채팅 내역: 하단 채팅 세 줄의 ^ 로 여는 오늘 메시지 전체. 보낸 사람 자리 색 점 + 이름 + 문장.
- 둘 다 하단 시트(`radius-lg` 위 모서리, `night-800`), 닫기 버튼 44px.
