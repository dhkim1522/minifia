export const ANIMAL_IDS = [
  "rabbit", "elephant", "crocodile", "penguin", "fox", "pig",
  "lion", "ram", "frog", "parrot", "hedgehog", "bat",
] as const;

export type AnimalId = (typeof ANIMAL_IDS)[number];

export const ANIMALS: Readonly<Record<AnimalId, { name: string; color: string }>> = {
  rabbit: { name: "토끼", color: "#b5a4ca" },
  elephant: { name: "코끼리", color: "#93acc6" },
  crocodile: { name: "악어", color: "#50867b" },
  penguin: { name: "펭귄", color: "#626d82" },
  fox: { name: "여우", color: "#dc8b4e" },
  pig: { name: "돼지", color: "#dfa1aa" },
  lion: { name: "사자", color: "#c99a59" },
  ram: { name: "숫양", color: "#ddc7a9" },
  frog: { name: "개구리", color: "#5b9f88" },
  parrot: { name: "앵무새", color: "#be6266" },
  hedgehog: { name: "고슴도치", color: "#a47d60" },
  bat: { name: "박쥐", color: "#71668e" },
};

/** 동물 값이 없는 구형 데이터에만 쓰는 좌석별 대체 외형. */
export function animalForSeat(seat: number): AnimalId {
  if (!Number.isInteger(seat)) return "rabbit";
  const n = ANIMAL_IDS.length;
  return ANIMAL_IDS[((seat % n) + n) % n]!;
}

export function isAnimalId(value: unknown): value is AnimalId {
  return typeof value === "string" && Object.hasOwn(ANIMALS, value);
}
