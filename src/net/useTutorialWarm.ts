import { useEffect } from "react";
import { getEngine } from "../audio/unlock";

// 혼자 하기 마무리 카드(17-06, 장면 8)가 뜰 때 따뜻한 조명 소리(tut.warm)를 한 번 낸다.
// 컴포넌트·화면은 엔진의 play 를 부르지 않는 규칙(soundButton 소리 호출 자리 시험)이라 호출은 net 훅에 둔다(useTutorialDirector 와 같은 자리).
// 소리 켬·끔은 엔진이 따르고, 소리를 낼 수 없는 환경은 조용히 넘어간다.
export function useTutorialWarm(): void {
  useEffect(() => {
    try {
      getEngine().play("tut.warm");
    } catch {
      // 무음으로 진행한다
    }
  }, []);
}
