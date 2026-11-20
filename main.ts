// THE WORLD IN ONE DAY — Friday 20 November 2026.
// One image that sums up the day's world news: 40 sourced stories, a UTC
// timeline and a world map with pins. Node 22, standard library only.
// Draws the whole front page with a tiny built-in 5x7 bitmap font and its
// own PNG encoder (zlib + CRC32), then writes /output/entry.png.
// Fully deterministic: same bytes on every run, no network, no clock.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

const PAPER: [number, number, number] = [251, 248, 241];
const INK: [number, number, number] = [17, 24, 39];
const NAVY: [number, number, number] = [15, 42, 74];
const RED: [number, number, number] = [180, 35, 24];
const TEAL: [number, number, number] = [14, 116, 144];
const GOLD: [number, number, number] = [183, 121, 31];
const GREEN: [number, number, number] = [63, 125, 93];
const GREY: [number, number, number] = [100, 106, 118];
const LIGHT: [number, number, number] = [232, 228, 219];
const OCEAN: [number, number, number] = [220, 233, 242];
const WHITE: [number, number, number] = [255, 255, 255];

type RGB = [number, number, number];

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPixel(i, j, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
    if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) setPixel(i, j, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB): void { fillRect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: RGB): void { fillRect(x, y, 1, h, c); }

// ---- PNG encoder (color type 2, 8-bit, filter 0) ----
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font: each glyph is 7 rows of 5 bits (bit 4 = left pixel) ----
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

function glyphOf(ch: string): number[] {
  const up = ch.toUpperCase();
  return FONT[up] ?? PUNCT[up] ?? FONT[' '];
}

function drawChar(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = glyphOf(ch);
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if ((g[r] >> (4 - col)) & 1) fillRect(x + col * s, y + r * s, s, s, c);
  }
}

function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawText(x: number, y: number, text: string, s: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) drawChar(x + i * 6 * s, y, text[i], s, c);
}

function drawTextCentered(cx: number, y: number, text: string, s: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, s) / 2), y, text, s, c);
}

// ---- punctuation glyphs ----
const PUNCT: Record<string, number[]> = {
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0], ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 6, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 10, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0], '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  '&': [12, 18, 20, 8, 21, 18, 13], '%': [25, 26, 2, 4, 8, 11, 19],
  '+': [0, 4, 4, 14, 4, 4, 0], '=': [0, 0, 31, 0, 31, 0, 0],
  '$': [4, 15, 20, 14, 5, 30, 4], '#': [10, 10, 31, 10, 31, 10, 10],
  '*': [0, 4, 21, 14, 21, 4, 0], '@': [14, 17, 23, 21, 22, 16, 14],
  '_': [0, 0, 0, 0, 0, 0, 31], '>': [8, 4, 2, 1, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2], '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14], '^': [4, 10, 17, 0, 0, 0, 0],
  '~': [0, 0, 9, 22, 0, 0, 0], '•': [0, 0, 12, 12, 0, 0, 0],
};

// ---- The day's news: 40 stories, each with its source. ----
// [headline, source] — every story first reported on Friday 20 Nov 2026.
const STORIES: [string, string][] = [
  ['TRUMP, XI AND PUTIN HOLD FIRST THREE-WAY SUMMIT', 'TIMES OF INDIA'],
  ['ICJ: MYANMAR LIKELY SOUGHT ROHINGYA DESTRUCTION', 'ICJ'],
  ['S. KOREA COURT OVERTURNS EX-PM HAN CONVICTION', 'TIMES OF INDIA'],
  ['FIJI DECLARES DISASTER OVER DROUGHT, WATER SHORTAGE', 'FIJI GOVT'],
  ['N. KOREA EXPANDING YONGBYON ENRICHMENT PLANT', 'IAEA'],
  ['US AND VENEZUELA TO RESTORE MILITARY COOPERATION', 'US DEFENCE DEPT'],
  ['CYCLONE AKVAN LANDFALL: 300,000 EVACUATED IN ODISHA', 'IMD'],
  ['PHILLIPS 118 AS NZ REACH 317-6 IN WELLINGTON TEST', 'REUTERS'],
  ['PHILLIPS: THREE-FORMAT TONS VS INDIA IN ONE YEAR', 'SPORTSKEEDA'],
  ['TRUMP TO HOLD NOON NEWS CONFERENCE AT WHITE HOUSE', 'TRUTH SOCIAL'],
  ['APEC LEADERS TALK TRADE AND TECH IN SHENZHEN', 'JAGRAN JOSH'],
  ['PAKISTAN MINISTER TO LEAD DELEGATION TO DELHI', 'DAILY JAGRAN'],
  ['AUSTRALIA SANCTIONS ISRAELI SETTLERS OVER WEST BANK', 'DAILY JAGRAN'],
  ['LPG TANKER THAT SANK OFF BULGARIA HIT BY PROJECTILES', 'DAILY JAGRAN'],
  ['JAPAN PM TAKAICHI SEEKS CONTINUED DIALOGUE WITH CHINA', 'DAILY JAGRAN'],
  ['COP31 DRAFT DROPS FOSSIL-FUEL TRANSITION LANGUAGE', 'GLOBAL DIASPORA NEWS'],
  ['GUTERRES: TRIPLING ADAPTATION CASH STILL NOT ENOUGH', 'UN NEWS'],
  ['GERMANY PLEDGES FREYJA RADARS FOR UKRAINE DEFENCE', 'UBN.NEWS'],
  ['RUSSIAN STRIKES DAMAGE AUSTRIAN, DUTCH EMBASSIES IN KYIV', 'AFRINEWS'],
  ['WALL ST SINKS: S&P -2.03%, DOW -1,103 AFTER ANTHROPIC DEBUT', 'REUTERS'],
  ['FED MINUTES POINT TO DECEMBER HIKE; 94% ODDS', 'CME FEDWATCH'],
  ['ANTHROPIC PRICES RECORD IPO AT $83 A SHARE', 'REUTERS'],
  ['GOOGLE PUTS GEMINI 4 HYDROGEN INTO SEARCH WORLDWIDE', 'AI EVENT MAG'],
  ['OPENAI RAISES $11BN AT $1.25 TRILLION VALUATION', 'AI EVENT MAG'],
  ['EU BEGINS GPAI ENFORCEMENT UNDER AI ACT', 'AI EVENT MAG'],
  ['NVIDIA LEADERSHIP CRISIS SPURS AI STOCK SELL-OFF', 'REUTERS'],
  ['RABADA 8 WICKETS POWER SA TO 9-WICKET WIN OVER BANGLADESH', 'MYKHEL'],
  ['INDIA BEAT PAKISTAN 2-1 TO WIN 10TH SAFF TITLE', 'STUDMENTOR'],
  ['SENSEX JUMPS NEARLY 1,000 PTS TO 83,022', 'TIMES OF INDIA'],
  ['MODI MEETS PRINCE AND PRINCESS OF WALES IN DELHI', 'TIMES OF INDIA'],
  ['MODI OPENS FICCI CENTENARY CONVENTION IN DELHI', 'JAGRAN JOSH'],
  ['FIRE AT EX-LEADER YUNUS ANCESTRAL HOME IN BANGLADESH', 'TIMES OF INDIA'],
  ['ELEVEN INDIAN STATES, UTS REACH FULL LITERACY', 'STUDMENTOR'],
  ['ADNOC VESSEL ATTACKED IN HORMUZ; ONE CREW MISSING', 'PW.LIVE'],
  ['AGENTIC ENGINEERING DAYS SELL OUT IN ZURICH', 'AI EVENT MAG'],
  ['WORLD CHILDRENS DAY MARKED AROUND THE GLOBE', 'UNICEF'],
  ['AFRICA INDUSTRIALIZATION DAY OBSERVED', 'UNITED NATIONS'],
  ['57TH IFFI FILM FESTIVAL OPENS IN GOA', 'IFFI'],
  ['WINTER RAINS DEEPEN GAZA SHELTER CRISIS', 'UN NEWS'],
  ['SUDAN CIVIL WAR GRINDS ON INTO NOVEMBER', 'WARNPOINT'],
];

// ---- World map: stylised continents as filled blocks, pins as numbered dots ----
const MAP = { x: 24, y: 222, w: 676, h: 100 };
const LAND: [number, number, number, number][] = [
  [46, 226, 203, 15], [127, 241, 109, 18], [165, 259, 34, 8], [259, 222, 56, 11],
  [212, 270, 84, 16], [222, 286, 60, 18], [238, 304, 28, 14],
  [343, 232, 94, 19], [368, 226, 40, 10], [338, 234, 10, 10],
  [332, 252, 126, 16], [340, 268, 100, 20], [358, 288, 60, 16],
  [437, 222, 263, 18], [450, 240, 180, 20], [470, 260, 120, 14],
  [468, 248, 26, 22], [450, 252, 28, 16], [545, 266, 64, 6],
  [578, 288, 68, 16], [652, 232, 10, 16], [660, 296, 10, 14], [452, 286, 8, 14],
];
const PINS: [number, number, string][] = [
  [114, 22.5, '1'], [4.3, 52, '2'], [127, 37.5, '3'], [178, -18, '4'],
  [126, 39.8, '5'], [-67, 10.5, '6'], [85, 19.3, '7'], [174.8, -41.3, '8'],
  [30.7, 36.9, '9'], [-77, 38.9, '10'], [30.5, 50.4, '11'], [34.5, 31.5, '12'],
];
const PIN_NAMES: [string, string][] = [
  ['1 SHENZHEN', '7 ODISHA'], ['2 THE HAGUE', '8 WELLINGTON'],
  ['3 SEOUL', '9 ANTALYA'], ['4 SUVA, FIJI', '10 WASHINGTON'],
  ['5 YONGBYON', '11 KYIV'], ['6 CARACAS', '12 GAZA'],
];
function mapX(lon: number): number { return MAP.x + Math.round((lon + 180) * MAP.w / 360); }
function mapY(lat: number): number { return MAP.y + Math.round((75 - lat) * MAP.h / 135); }

// ---- UTC timeline: eight moments of the day ----
const TIMELINE: [string, string, string][] = [
  ['00:10', 'KYIV', 'EMBASSIES HIT'],
  ['00:22', 'WELLINGTON', 'PHILLIPS 118'],
  ['06:30', 'ODISHA', 'AKVAN LANDFALL'],
  ['07:00', 'ANTALYA', 'COP31 FINAL DAY'],
  ['09:00', 'WASHINGTON', 'US-KOREA TALKS'],
  ['12:00', 'GOA', 'IFFI OPENS'],
  ['17:00', 'WASHINGTON', 'TRUMP PRESSER'],
  ['20:00', 'SHENZHEN', 'APEC TALKS'],
];

const BADGE_COLORS: RGB[] = [RED, NAVY, TEAL, GOLD];

function drawMasthead(): void {
  fillRect(0, 0, W, 116, NAVY);
  drawTextCentered(512, 16, 'THE WORLD IN ONE DAY', 4, WHITE);
  drawTextCentered(512, 62, 'FRIDAY, 20 NOVEMBER 2026', 2, WHITE);
  drawTextCentered(512, 94, '40 SOURCED STORIES  •  UTC TIMELINE  •  WORLD MAP', 1, [200, 210, 225]);
  fillRect(0, 116, W, 4, RED);
}

function drawLead(): void {
  fillRect(16, 130, 62, 20, RED);
  drawText(24, 135, 'LEAD', 1, WHITE);
  drawText(92, 132, 'TRUMP, XI AND PUTIN MEET IN SHENZHEN', 2, INK);
  drawText(16, 164, 'FIRST-EVER THREE-WAY SUMMIT: NUCLEAR ARMS, ENERGY AND ENDING WARS ON THE TABLE', 1, INK);
  drawText(16, 180, 'APEC, SHENZHEN, CHINA - THE THREE LEADERS MET FACE TO FACE FOR THE FIRST TIME', 1, GREY);
  drawText(880, 180, 'SOURCE: TIMES OF INDIA', 1, GREY);
  hline(16, 200, 992, LIGHT);
}

function drawMap(): void {
  drawText(16, 208, 'WHERE IT HAPPENED - WORLD MAP', 1, NAVY);
  fillRect(MAP.x, MAP.y, MAP.w, MAP.h, OCEAN);
  for (const [x, y, w, h] of LAND) fillRect(x, y, w, h, GREEN);
  for (const [lon, lat, n] of PINS) {
    const cx = mapX(lon), cy = mapY(lat);
    // Seoul and Yongbyon are ~60 km apart: offset the Seoul dot so both read.
    const dx = n === '3' ? 14 : 0;
    const dy = n === '3' ? -12 : 0;
    if (dx !== 0) hline(cx, cy - 12, 14, RED);
    fillCircle(cx + dx, cy + dy, 7, RED);
    drawText(cx + dx - (n.length === 2 ? 6 : 3), cy + dy - 3, n, 1, WHITE);
  }
  drawText(716, 208, 'PIN GUIDE', 1, NAVY);
  PIN_NAMES.forEach(([a, b], i) => {
    drawText(716, 228 + i * 16, a, 1, INK);
    drawText(872, 228 + i * 16, b, 1, INK);
  });
  drawText(716, 330 - 8, '12 PLACES, 12 STORIES', 1, GREY);
  hline(16, 336, 992, LIGHT);
}

function drawTimeline(): void {
  drawText(16, 346, 'THROUGH THE DAY - ALL TIMES UTC', 1, NAVY);
  const y0 = 382;
  hline(28, y0, 968, NAVY);
  TIMELINE.forEach(([t, place, what], i) => {
    const cx = 48 + i * 132;
    fillCircle(cx, y0, 5, RED);
    drawTextCentered(cx, 360, t, 1, RED);
    drawTextCentered(cx, y0 + 10, place, 1, INK);
    drawTextCentered(cx, y0 + 22, what, 1, GREY);
  });
  hline(16, 414, 992, LIGHT);
}

function drawStories(): void {
  drawText(16, 424, 'THE DAY IN 40 STORIES - EACH WITH ITS SOURCE', 1, NAVY);
  drawText(700, 424, 'HEADLINE - SOURCE', 1, GREY);
  STORIES.forEach(([head, src], i) => {
    const col = Math.floor(i / 20);
    const row = i % 20;
    const x = 16 + col * 508;
    const y = 448 + row * 27;
    const c = BADGE_COLORS[i % 4];
    fillRect(x, y, 22, 20, c);
    drawText(x + 4, y + 7, String(i + 1), 1, WHITE);
    const line = head + ' - ' + src;
    drawText(x + 28, y + 7, line, 1, INK);
  });
}

function drawFooter(): void {
  fillRect(0, 984, W, 4, RED);
  fillRect(0, 988, W, 36, NAVY);
  drawTextCentered(512, 1000, 'ALL 40 STORIES FIRST REPORTED ON FRIDAY 20 NOVEMBER 2026 - TIMES UTC', 1, WHITE);
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  drawMap();
  drawTimeline();
  drawStories();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
