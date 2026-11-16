// 초안, 사용자 검토 대기(0089-23). 이 파일 하나가 키워드의 원천이다. src 에서 import 하지 않는다(Pitfall 8).
// 첫날 키워드 문제(결정 0089-2·3, D-05)의 장르·단어·별칭 목록. 서버가 시작할 때 무작위로 하나를 고른다(pickKeyword).
// 클라이언트는 이 목록을 읽지 않는다 — 장르 라벨은 view 의 day.keyword.genre 로, 단어는 시민 편 본인의 me.keyword 로만 받는다.
// 다만 shared/game/room.ts 를 클라이언트(hostLine·Lobby 의 connectedCount)가 import 하므로, 이 파일은 최상위에서 함수를 부르지 않는다
// (리터럴 + as const satisfies 만) — 번들 트리 셰이킹이 확실해야 목록이 브라우저에 실리지 않는다(T-23-02).

/** 키워드 하나: 정답으로 보이는 단어와 같은 뜻으로 인정할 별칭(한국어 변형·영어·짧은 이름). 한 글자 단어는 없다. */
export interface KeywordEntry {
  readonly word: string;
  readonly aliases: readonly string[];
}

/** 장르 하나: id 는 서버 저장용 짧은 이름, label 은 화면에 보이는 장르 이름이다. */
export interface Genre {
  readonly id: string;
  readonly label: string;
  readonly words: readonly KeywordEntry[];
}

/**
 * 시험 스위치(23-01, D-29). false 면 beginGame 이 키워드를 고르지 않아 첫날 흐름이 옛 그대로(roleReveal → dayAnnounce)다.
 * 제품은 늘 true 이고, test/unit/setup.ts·test/worker/setup.ts 가 시험 동안 끈다(PLAYABLE_MAPS 잠금과 같은 성격 — 소켓·HTTP 로 바꿀 경로가 없다).
 * 켜는 시험은 test/helpers/keyword.ts 의 openKeyword 를 쓴다.
 */
export const KEYWORD_SWITCH: { on: boolean } = { on: true };

/** 장르 목록. 지금은 영화 하나이고 나머지 장르·별칭 보강은 23-04 가 채운다. */
export const GENRES = [
  {
    id: "movie",
    label: "영화",
    words: [
      { word: "해리포터", aliases: ["Harry Potter", "해리", "해포", "potter", "harry", "포터"] },
      { word: "타이타닉", aliases: ["Titanic", "titanic", "타이타닉호"] },
      { word: "겨울왕국", aliases: ["Frozen", "frozen", "엘사", "렛잇고"] },
      { word: "어벤져스", aliases: ["Avengers", "avengers", "어벤저스"] },
      { word: "아바타", aliases: ["Avatar", "avatar"] },
      { word: "라이온킹", aliases: ["Lion King", "lion king", "심바", "라이언킹"] },
      { word: "토이스토리", aliases: ["Toy Story", "toy story", "우디", "버즈"] },
      { word: "기생충", aliases: ["Parasite", "parasite"] },
      { word: "부산행", aliases: ["Train to Busan", "train to busan"] },
      { word: "범죄도시", aliases: ["The Outlaws", "마석도", "범도"] },
      { word: "극한직업", aliases: ["Extreme Job", "extreme job", "치킨집"] },
      { word: "명량", aliases: ["The Admiral", "Roaring Currents", "이순신"] },
      { word: "베테랑", aliases: ["Veteran", "veteran", "서도철"] },
      { word: "도둑들", aliases: ["The Thieves", "the thieves"] },
      { word: "괴물", aliases: ["The Host", "the host", "한강괴물"] },
      { word: "올드보이", aliases: ["Oldboy", "oldboy", "Old Boy"] },
      { word: "건축학개론", aliases: ["Architecture 101", "건개"] },
      { word: "7번방의 선물", aliases: ["칠번방의 선물", "7번방", "칠번방", "Miracle in Cell No. 7"] },
      { word: "인터스텔라", aliases: ["Interstellar", "interstellar"] },
      { word: "인셉션", aliases: ["Inception", "inception"] },
      { word: "다크나이트", aliases: ["The Dark Knight", "dark knight", "배트맨", "Batman"] },
      { word: "매트릭스", aliases: ["The Matrix", "matrix", "네오"] },
      { word: "쥬라기공원", aliases: ["Jurassic Park", "jurassic park", "쥬라기 공원", "쥐라기공원", "쥐라기 공원"] },
      { word: "스파이더맨", aliases: ["Spider-Man", "spiderman", "spider man", "스파이더 맨"] },
      { word: "아이언맨", aliases: ["Iron Man", "ironman", "iron man", "아이언 맨"] },
      { word: "반지의 제왕", aliases: ["반지의제왕", "Lord of the Rings", "lord of the rings", "반제"] },
      { word: "캐리비안의 해적", aliases: ["캐리비안해적", "Pirates of the Caribbean", "캐해", "잭스패로우"] },
      { word: "슈렉", aliases: ["Shrek", "shrek"] },
      { word: "코코", aliases: ["Coco", "coco"] },
      { word: "인사이드 아웃", aliases: ["인사이드아웃", "Inside Out", "inside out"] },
      { word: "알라딘", aliases: ["Aladdin", "aladdin"] },
      { word: "미션 임파서블", aliases: ["미션임파서블", "Mission Impossible", "mission impossible", "미임파"] },
      { word: "서울의 봄", aliases: ["서울의봄", "Seoul Spring"] },
    ],
  },
] as const satisfies readonly Genre[];

/** 서버가 시작에 키워드를 고른다: 장르 randInt 한 번 → 단어 randInt 한 번(D-29, beginGame 이 decideMap 뒤에 부른다). */
export function pickKeyword(randInt: (n: number) => number): { genre: string; word: string } {
  const genre = GENRES[randInt(GENRES.length)]!;
  const entry = genre.words[randInt(genre.words.length)]!;
  return { genre: genre.id, word: entry.word };
}

/** 저장된 (장르 id, 단어) 의 항목. 목록에 없으면 undefined. */
export function keywordEntryOf(genre: string, word: string): KeywordEntry | undefined {
  return GENRES.find((g) => g.id === genre)?.words.find((w) => w.word === word);
}

/** 장르 id 의 화면 라벨(공개 값). 모르는 id 는 undefined. */
export function genreLabelOf(genre: string): string | undefined {
  return GENRES.find((g) => g.id === genre)?.label;
}
