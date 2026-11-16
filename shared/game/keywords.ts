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

/**
 * 장르 목록(초안). 별칭 규칙은 test/unit/keywords.test.ts 의 keywordListProblems 가 지킨다:
 * 정규화(NFKC·글자숫자만·소문자)한 별칭은 길이 2 이상, 자기 단어와 다르고, 항목 안에서 유일하고, 다른 항목의 단어와 다르다.
 * 그래서 대소문자·띄어쓰기만 다른 형태는 한 번만 적는다(판정이 정규화로 같이 막는다).
 * 3글자 단어·별칭은 초성열이 흔한 말과 겹치면(ㄱㅇㅇ·ㅇㅇㅇ·ㅈㄴㄱ·ㄷㄹㄱ 류) 피했다(23-03 알려진 한계).
 */
export const GENRES = [
  {
    id: "movie",
    label: "영화",
    words: [
      { word: "해리포터", aliases: ["Harry Potter", "해리", "해포", "potter", "harry", "포터"] },
      { word: "타이타닉", aliases: ["Titanic", "타이타닉호"] },
      { word: "겨울왕국", aliases: ["Frozen", "엘사", "렛잇고"] },
      { word: "어벤져스", aliases: ["Avengers", "어벤저스"] },
      { word: "아바타", aliases: ["Avatar"] },
      { word: "라이온킹", aliases: ["Lion King", "심바", "라이언킹"] },
      { word: "토이스토리", aliases: ["Toy Story", "우디", "버즈"] },
      { word: "기생충", aliases: ["Parasite"] },
      { word: "부산행", aliases: ["Train to Busan"] },
      { word: "범죄도시", aliases: ["The Outlaws", "마석도", "범도"] },
      { word: "극한직업", aliases: ["Extreme Job", "치킨집"] },
      { word: "명량", aliases: ["The Admiral", "Roaring Currents", "이순신"] },
      { word: "베테랑", aliases: ["Veteran", "서도철"] },
      { word: "도둑들", aliases: ["The Thieves"] },
      { word: "괴물", aliases: ["The Host", "한강괴물"] },
      { word: "올드보이", aliases: ["Oldboy"] },
      { word: "건축학개론", aliases: ["Architecture 101", "건개"] },
      { word: "7번방의 선물", aliases: ["칠번방의 선물", "7번방", "칠번방", "Miracle in Cell No. 7"] },
      { word: "인터스텔라", aliases: ["Interstellar"] },
      { word: "인셉션", aliases: ["Inception"] },
      { word: "다크나이트", aliases: ["The Dark Knight", "dark knight", "배트맨", "Batman"] },
      { word: "매트릭스", aliases: ["The Matrix", "matrix", "네오"] },
      { word: "쥬라기공원", aliases: ["Jurassic Park", "쥐라기공원"] },
      { word: "스파이더맨", aliases: ["Spider-Man"] },
      { word: "아이언맨", aliases: ["Iron Man"] },
      { word: "반지의 제왕", aliases: ["Lord of the Rings", "반제"] },
      { word: "캐리비안의 해적", aliases: ["캐리비안해적", "Pirates of the Caribbean", "캐해", "잭스패로우"] },
      { word: "슈렉", aliases: ["Shrek"] },
      { word: "코코", aliases: ["Coco"] },
      { word: "인사이드 아웃", aliases: ["Inside Out"] },
      { word: "알라딘", aliases: ["Aladdin"] },
      { word: "미션 임파서블", aliases: ["Mission Impossible", "미임파"] },
      { word: "서울의 봄", aliases: ["Seoul Spring"] },
    ],
  },
  {
    id: "food",
    label: "음식",
    words: [
      { word: "김치찌개", aliases: ["Kimchi Stew", "김치찜", "김찌"] },
      { word: "된장찌개", aliases: ["Doenjang Stew", "된찌"] },
      { word: "부대찌개", aliases: ["Budae Jjigae", "부찌"] },
      { word: "삼겹살", aliases: ["Samgyeopsal", "삼겹", "Pork Belly"] },
      { word: "치킨", aliases: ["Chicken", "후라이드", "양념치킨", "통닭"] },
      { word: "피자", aliases: ["Pizza", "페퍼로니"] },
      { word: "햄버거", aliases: ["Hamburger", "버거", "Burger"] },
      { word: "떡볶이", aliases: ["Tteokbokki", "떡볶기", "떡뽁이"] },
      { word: "라면", aliases: ["Ramyeon", "인스턴트라면", "컵라면"] },
      { word: "김밥", aliases: ["Gimbap", "Kimbap", "참치김밥"] },
      { word: "비빔밥", aliases: ["Bibimbap", "비빔"] },
      { word: "불고기", aliases: ["Bulgogi", "불갈비"] },
      { word: "냉면", aliases: ["Naengmyeon", "물냉면", "비빔냉면"] },
      { word: "짜장면", aliases: ["자장면", "Jajangmyeon", "짜장"] },
      { word: "짬뽕", aliases: ["Jjamppong", "짬뽕국물"] },
      { word: "탕수육", aliases: ["Sweet and Sour Pork", "탕슉"] },
      { word: "초밥", aliases: ["Sushi", "스시"] },
      { word: "돈가스", aliases: ["돈까스", "Tonkatsu", "Pork Cutlet"] },
      { word: "파스타", aliases: ["Pasta", "스파게티", "Spaghetti"] },
      { word: "마라탕", aliases: ["Malatang", "마라"] },
      { word: "샌드위치", aliases: ["Sandwich", "샌드위지"] },
      { word: "족발", aliases: ["Jokbal", "불족발"] },
      { word: "보쌈", aliases: ["Bossam", "수육"] },
      { word: "아이스크림", aliases: ["Ice Cream", "아이스콘", "콘아이스크림"] },
      { word: "초콜릿", aliases: ["Chocolate", "초코", "초콜렛"] },
      { word: "딸기", aliases: ["Strawberry", "딸기우유"] },
      { word: "수박", aliases: ["Watermelon", "수박화채"] },
      { word: "바나나", aliases: ["Banana", "바나나우유"] },
      { word: "케이크", aliases: ["Cake", "케잌", "생크림케이크"] },
      { word: "마카롱", aliases: ["Macaron", "마까롱"] },
      { word: "호떡", aliases: ["Hotteok", "꿀호떡"] },
      { word: "붕어빵", aliases: ["Bungeoppang", "잉어빵", "붕빵"] },
      { word: "핫도그", aliases: ["Hot Dog", "콘도그"] },
      { word: "팝콘", aliases: ["Popcorn", "캐러멜팝콘"] },
      { word: "탕후루", aliases: ["Tanghulu", "딸기탕후루"] },
      { word: "도넛", aliases: ["Donut", "도너츠", "도넛츠"] },
      { word: "와플", aliases: ["Waffle", "크로플"] },
      { word: "샐러드", aliases: ["Salad", "샐러드볼"] },
      { word: "계란말이", aliases: ["달걀말이", "Rolled Omelet"] },
      { word: "곱창", aliases: ["Gopchang", "막창", "대창"] },
      { word: "만두", aliases: ["Dumpling", "군만두", "물만두"] },
      { word: "팥빙수", aliases: ["빙수", "Bingsu", "Shaved Ice"] },
      { word: "타코", aliases: ["Taco", "타코야키"] },
      { word: "카레", aliases: ["Curry", "카레라이스"] },
      { word: "감자튀김", aliases: ["French Fries", "프렌치프라이", "감튀"] },
    ],
  },
  {
    id: "animal",
    label: "동물",
    words: [
      { word: "강아지", aliases: ["Dog", "Puppy", "멍멍이", "댕댕이"] },
      { word: "호랑이", aliases: ["Tiger", "백두산호랑이"] },
      { word: "사자", aliases: ["Lion", "백수의왕"] },
      { word: "코끼리", aliases: ["Elephant", "아기코끼리"] },
      { word: "기린", aliases: ["Giraffe", "목긴동물"] },
      { word: "펭귄", aliases: ["Penguin", "황제펭귄"] },
      { word: "토끼", aliases: ["Rabbit", "Bunny", "토끼풀"] },
      { word: "햄스터", aliases: ["Hamster", "햄찌"] },
      { word: "거북이", aliases: ["Turtle", "거북", "Tortoise"] },
      { word: "악어", aliases: ["Crocodile", "Alligator"] },
      { word: "고래", aliases: ["Whale", "흰수염고래"] },
      { word: "돌고래", aliases: ["Dolphin", "돌고래쇼"] },
      { word: "상어", aliases: ["Shark", "백상아리", "아기상어"] },
      { word: "문어", aliases: ["Octopus", "대왕문어"] },
      { word: "해파리", aliases: ["Jellyfish", "물해파리"] },
      { word: "독수리", aliases: ["Eagle", "Vulture"] },
      { word: "부엉이", aliases: ["Owl", "올빼미"] },
      { word: "앵무새", aliases: ["Parrot", "말하는새"] },
      { word: "오리", aliases: ["Duck", "청둥오리", "아기오리"] },
      { word: "병아리", aliases: ["Chick", "삐약이"] },
      { word: "돼지", aliases: ["Pig", "아기돼지", "꿀꿀이"] },
      { word: "젖소", aliases: ["Cow", "얼룩소", "Dairy Cow"] },
      { word: "조랑말", aliases: ["Pony", "제주말"] },
      { word: "염소", aliases: ["Goat", "산양"] },
      { word: "사슴", aliases: ["Deer", "루돌프", "Reindeer"] },
      { word: "여우", aliases: ["Fox", "꼬리아홉"] },
      { word: "늑대", aliases: ["Wolf", "늑대인간"] },
      { word: "불곰", aliases: ["Brown Bear", "Grizzly", "큰곰"] },
      { word: "판다", aliases: ["Panda", "자이언트판다", "푸바오"] },
      { word: "코알라", aliases: ["Koala", "유칼립투스"] },
      { word: "캥거루", aliases: ["Kangaroo", "주머니동물"] },
      { word: "침팬지", aliases: ["Chimpanzee", "Chimp"] },
      { word: "고릴라", aliases: ["Gorilla", "킹콩"] },
      { word: "다람쥐", aliases: ["Squirrel", "청설모"] },
      { word: "박쥐", aliases: ["Bat", "흡혈박쥐"] },
      { word: "하마", aliases: ["Hippo", "Hippopotamus"] },
      { word: "낙타", aliases: ["Camel", "사막낙타"] },
      { word: "얼룩말", aliases: ["Zebra", "줄무늬말"] },
      { word: "공룡", aliases: ["Dinosaur", "티라노사우루스", "티라노"] },
      { word: "나비", aliases: ["Butterfly", "호랑나비"] },
      { word: "개구리", aliases: ["Frog", "청개구리"] },
      { word: "달팽이", aliases: ["Snail", "민달팽이"] },
      { word: "수달", aliases: ["Otter", "해달"] },
      { word: "고슴도치", aliases: ["Hedgehog", "가시쥐"] },
      { word: "너구리", aliases: ["Raccoon Dog", "Raccoon"] },
    ],
  },
  {
    id: "place",
    label: "장소",
    words: [
      { word: "한강", aliases: ["Han River", "한강공원", "한강라면"] },
      { word: "남산", aliases: ["Namsan", "남산타워"] },
      { word: "제주도", aliases: ["Jeju", "Jeju Island", "제주"] },
      { word: "부산", aliases: ["Busan", "Pusan"] },
      { word: "서울", aliases: ["Seoul", "수도"] },
      { word: "해운대", aliases: ["Haeundae", "해운대해수욕장"] },
      { word: "경복궁", aliases: ["Gyeongbokgung", "근정전"] },
      { word: "광화문", aliases: ["Gwanghwamun", "광화문광장"] },
      { word: "동대문", aliases: ["Dongdaemun", "동대문시장"] },
      { word: "명동", aliases: ["Myeongdong", "명동거리"] },
      { word: "홍대", aliases: ["Hongdae", "홍대입구"] },
      { word: "강남", aliases: ["Gangnam", "강남역"] },
      { word: "경주", aliases: ["Gyeongju", "첨성대"] },
      { word: "학교", aliases: ["School", "교실"] },
      { word: "병원", aliases: ["Hospital", "응급실"] },
      { word: "도서관", aliases: ["Library", "열람실"] },
      { word: "영화관", aliases: ["Cinema", "극장", "영화관람"] },
      { word: "놀이공원", aliases: ["Amusement Park", "놀이동산", "테마파크"] },
      { word: "수영장", aliases: ["Swimming Pool", "워터파크"] },
      { word: "편의점", aliases: ["Convenience Store", "편의점도시락"] },
      { word: "공항", aliases: ["Airport", "비행장"] },
      { word: "지하철", aliases: ["Subway", "전철", "Metro"] },
      { word: "노래방", aliases: ["Karaoke", "코인노래방", "코노"] },
      { word: "PC방", aliases: ["피시방", "게임방"] },
      { word: "찜질방", aliases: ["Jjimjilbang", "사우나", "Sauna"] },
      { word: "목욕탕", aliases: ["Bathhouse", "대중탕"] },
      { word: "놀이터", aliases: ["Playground", "미끄럼틀"] },
      { word: "동물원", aliases: ["Zoo", "사파리"] },
      { word: "수족관", aliases: ["Aquarium", "아쿠아리움"] },
      { word: "박물관", aliases: ["Museum", "전시관"] },
      { word: "백화점", aliases: ["Department Store", "쇼핑몰"] },
      { word: "카페", aliases: ["Cafe", "커피숍", "Coffee Shop"] },
      { word: "공원", aliases: ["Park", "산책로"] },
      { word: "해변", aliases: ["Beach", "바닷가", "해수욕장"] },
      { word: "바다", aliases: ["Sea", "Ocean", "푸른바다"] },
      { word: "한라산", aliases: ["Hallasan", "백록담"] },
      { word: "백두산", aliases: ["Paektu", "천지"] },
      { word: "사막", aliases: ["Desert", "사하라"] },
      { word: "정글", aliases: ["Jungle", "밀림"] },
      { word: "동굴", aliases: ["Cave", "석회동굴"] },
      { word: "캠핑장", aliases: ["Campsite", "캠핑", "글램핑"] },
      { word: "스키장", aliases: ["Ski Resort", "슬로프"] },
      { word: "호텔", aliases: ["Hotel", "리조트"] },
      { word: "펜션", aliases: ["Pension", "독채펜션"] },
      { word: "우주", aliases: ["Space", "우주정거장"] },
      { word: "에펠탑", aliases: ["Eiffel Tower", "파리탑"] },
      { word: "피라미드", aliases: ["Pyramid", "스핑크스"] },
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
