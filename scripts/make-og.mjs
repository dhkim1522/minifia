// 참가 링크의 미리보기도 홈과 같은 테이블 장면을 쓴다. 제목·초대 문구는 링크 메타데이터에 있다.
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const art = sharp(root("public/backgrounds/noir-entry.webp"));
const { width, height } = await art.metadata();
const cardWidth = 1200;
const cardHeight = 630;
const cropHeight = Math.round(width * cardHeight / cardWidth);
// 세 사람의 얼굴과 테이블 조명이 원화 높이의 44% 지점을 둘러싼다.
const top = Math.max(0, Math.min(height - cropHeight, Math.round(height * 0.44 - cropHeight / 2)));
await art.extract({ left: 0, top, width, height: cropHeight })
  .resize(cardWidth, cardHeight)
  .png({ palette: true, colours: 256, dither: 0.6 })
  .toFile(root("public/og.png"));
