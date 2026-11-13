# 21페이즈 이월 항목 (범위 밖에서 발견한 것)

## test/worker/bots.test.ts 「봇 chat: 밤에는 마피아 봇의 줄이…」 간헐 실패 (약 20%)

- 21-02 에서 발견. 방장(testRole mafia) + 손님 1 + 봇 4 의 6명 판에서 마피아 둘 중 하나가 무작위로 정해지는데, 그 하나가 사람 손님이면 시험이 찾는 `mafiaBot` 이 없어 `Cannot read properties of undefined (reading 'id')` 로 실패한다(손님이 마피아일 확률 1/5).
- 21페이즈 순서 변경과 무관하다(역할 배정은 판 종류와 상관없다). 이 계획의 범위가 아니라 고치지 않았다. 재실행하면 통과한다(3번 중 1번 실패 관찰).
- 고치려면: 시험이 봇 하나를 마피아로 정하도록 저장 방을 고치거나(`editRoom`), 손님을 두지 않는다(`seatQuiet(0)`).

## 전체 `npm test` 부하 때 간헐 실패 두 건 (21-03 에서 관찰, 재실행하면 통과)

- `test/client/v2Marker.test.tsx` 「WORKER_NAME 이 minifia-v3 이면 첫 화면에 'v3.0 시험판' 이 보인다」: 전체 실행 한 번에서 `.mf-entry__build` 가 아직 없어(undefined) 실패. 단독 실행은 통과(6/6). 첫 화면 비동기 렌더를 기다리는 시간 문제로 보인다.
- `test/worker/townLeak.test.ts`: 전체 실행 한 번에서 `advanceTo` 의 `runDurableObjectAlarm` 이 false 라 8개가 함께 실패(`play()` 공용 설정에서 터짐). 단독 3번은 모두 통과(8/8), 전체 재실행도 통과. 알람이 이미 지나간 뒤에 부르는 시간 경쟁으로 보이며 가로등 변경(장소 id)과 무관하다.
- 이 계획에서는 고치지 않았다. 재현되면 21-04 이후 계획이나 별도 정리에서 기다림을 조건 폴링으로 바꾼다.
