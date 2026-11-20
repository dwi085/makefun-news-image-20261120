// THE WORLD IN ONE DAY — ROUND 2. Friday 20 November 2026 in one image:
// 50 sourced stories, an 18-pin world map and a UTC timeline.
// Node 22, standard library only. Draws the whole front page with a tiny
// built-in 5x7 bitmap font and its own PNG encoder (zlib + CRC32), then
// writes /output/entry.png. Fully deterministic: same bytes on every run,
// no network, no clock, no randomness anywhere.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const frame = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [251, 248, 241];
const INK: RGB = [17, 24, 39];
const NAVY: RGB = [15, 42, 74];
const RED: RGB = [180, 35, 24];
const TEAL: RGB = [14, 116, 144];
const GOLD: RGB = [183, 121, 31];
const GREEN: RGB = [63, 125, 93];
const GREY: RGB = [100, 106, 118];
const PALE: RGB = [232, 228, 219];
const OCEAN: RGB = [220, 233, 242];
const WHITE: RGB = [255, 255, 255];

function put(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  frame[i] = c[0]; frame[i + 1] = c[1]; frame[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c);
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
    if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) put(i, j, c);
  }
}

function hRule(x: number, y: number, w: number, c: RGB): void { rect(x, y, w, 1, c); }
function vRule(x: number, y: number, h: number, c: RGB): void { rect(x, y, 1, h, c); }

// ---- PNG writer: 8-bit RGB, no filter, zlib level 9 ----
const CRC: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const typeBuf = Buffer.from(type, 'ascii');
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function writePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(frame.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font: 7 rows of 5 bits each, bit 4 is the left pixel ----
const GLYPHS: Record<string, number[]> = {
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

function drawGlyph(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = GLYPHS[ch.toUpperCase()] ?? GLYPHS[' '];
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if ((g[r] >> (4 - col)) & 1) rect(x + col * s, y + r * s, s, s, c);
  }
}

function textW(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawStr(x: number, y: number, text: string, s: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) drawGlyph(x + i * 6 * s, y, text[i], s, c);
}

function drawStrC(cx: number, y: number, text: string, s: number, c: RGB): void {
  drawStr(cx - Math.floor(textW(text, s) / 2), y, text, s, c);
}

// ---- The day's news: 50 stories, each with its source. ----
// [headline, source] — every story reported in the 20 November 2026 news cycle.
const STORIES: [string, string][] = [
  ['TRUMP, XI AND PUTIN HOLD FIRST THREE-WAY SUMMIT', 'TIMES OF INDIA'],
  ['ICJ: MYANMAR COMMITTED GENOCIDE OF ROHINGYA', 'BBC'],
  ['S. KOREA COURT OVERTURNS EX-PM HAN CONVICTION', 'TIMES OF INDIA'],
  ['FIJI DECLARES DISASTER OVER DROUGHT, WATER CRISIS', 'FIJI GOVT'],
  ['N. KOREA EXPANDING YONGBYON ENRICHMENT PLANT', 'IAEA'],
  ['US AND VENEZUELA TO RESTORE MILITARY TIES', 'US DEFENCE DEPT'],
  ['CYCLONE AKVAN: 300,000 EVACUATED IN ODISHA', 'THE HINDU'],
  ['PHILLIPS 118 AS NZ REACH 317-6 IN WELLINGTON TEST', 'REUTERS'],
  ['PHILLIPS: THREE-FORMAT TONS VS INDIA IN 2026', 'SPORTSKEEDA'],
  ['TRUMP: NO RUSH ON IRAN CALL, SEE WHAT HAPPENS', 'REUTERS'],
  ['APEC LEADERS TALK TRADE AND TECH IN SHENZHEN', 'JAGRAN JOSH'],
  ['TRUMP AND XI HOLD SHENZHEN TALKS, ACCOUNTS DIFFER', 'NYT'],
  ['AUSTRALIA SANCTIONS ISRAELI SETTLERS IN WEST BANK', 'DAILY JAGRAN'],
  ['LPG TANKER THAT SANK OFF BULGARIA HIT BY PROJECTILES', 'DAILY JAGRAN'],
  ['JAPAN PM TAKAICHI DUCKS TAIWAN QUESTION AT APEC', 'SIMPLELIFE.NEWS'],
  ['COP31 CLOSES TODAY IN ANTALYA AFTER 12 DAYS', 'UN NEWS'],
  ['GUTERRES: ADAPTATION CASH TRIPLING STILL NOT ENOUGH', 'UN NEWS'],
  ['GERMANY PLEDGES FREYJA RADARS FOR UKRAINE', 'UBN.NEWS'],
  ['RUSSIAN STRIKES DAMAGE EMBASSIES IN KYIV', 'THE INDEPENDENT'],
  ['WALL ST SINKS: S AND P -2.02%, DOW -1,101', 'REUTERS'],
  ['ANTHROPIC IPO: $83 A SHARE, $81BN RAISED', 'REUTERS'],
  ['ANTHROPIC CLOSES AT $97 AFTER $115 PEAK', "BARRON'S"],
  ['NVIDIA -40% FROM PEAK AS AI SELL-OFF DEEPENS', 'REUTERS'],
  ['AMD -8% ON HUNTERBROOK EXPORT REPORT', 'M+ MARKET PULSE'],
  ['VOYAGER 1 FIRST CRAFT A LIGHT-DAY FROM EARTH', 'NASA'],
  ['HAYABUSA2 DROPS ASTEROID LANDING AFTER FAULT', 'SPACE.COM'],
  ["GTA 6 SALES PASS THE ODYSSEY'S $1.8BN RUN", 'MEZHA'],
  ['TAIWAN MOVES TO STEADY STOCKS; CURBS TODAY', 'SIMPLELIFE.NEWS'],
  ['S. KOREA EXPORTS TOP $1 TRILLION FOR FIRST TIME', 'SIMPLELIFE.NEWS'],
  ['SENSEX JUMPS NEARLY 1,000 PTS TO 83,022', 'TIMES OF INDIA'],
  ['MODI MEETS PRINCE AND PRINCESS OF WALES', 'TIMES OF INDIA'],
  ['FIRE AT EX-LEADER YUNUS ANCESTRAL HOME', 'TIMES OF INDIA'],
  ['ELEVEN INDIAN STATES, UTS REACH FULL LITERACY', 'STUDMENTOR'],
  ['ADNOC VESSEL ATTACKED IN HORMUZ; ONE CREW MISSING', 'PW.LIVE'],
  ["WORLD CHILDREN'S DAY MARKED AROUND THE GLOBE", 'UNICEF'],
  ['AFRICA INDUSTRIALIZATION DAY OBSERVED', 'UNITED NATIONS'],
  ['57TH IFFI FILM FESTIVAL OPENS IN GOA', 'IFFI'],
  ['WINTER RAINS DEEPEN GAZA SHELTER CRISIS', 'UN NEWS'],
  ['SUDAN CIVIL WAR GRINDS ON INTO NOVEMBER', 'WARNPOINT'],
  ["HOUTHI ATTACK DAMAGES RIYADH'S TALLEST TOWER", 'ARAB NEWS'],
  ['US SENATE REJECTS IRAN WAR-POWERS BID 51-48', 'APPISTOS'],
  ['TRUMP ANNOUNCES POSTHUMOUS PARDON FOR PETE ROSE', 'APPISTOS'],
  ['HAITI OFFENSIVE KILLS 34 SUSPECTED GANG MEMBERS', 'NEWS.INBOX.LV'],
  ['SERBIA: CUPIC ELECTED PARLIAMENT SPEAKER', 'APPISTOS'],
  ['UK AND NORWAY FUND 100M-PLUS NAVAL CRAFT FOR KYIV', 'APPISTOS'],
  ['APEC ADOPTS SHENZHEN OUTLOOK ON TRADE, DATA, AI', 'APPISTOS'],
  ['ALCARAZ BEATS MEDVEDEV AT ATP FINALS IN TURIN', 'APEX SPORTS'],
  ['FIROUZJA BEATS CARUANA, MEETS GIRI IN CHESS FINAL', 'APEX SPORTS'],
  ["INDIA BEAT MALAYSIA 4-1 IN WOMEN'S HOCKEY OPENER", 'APEX SPORTS'],
  ['GRIMES 47 PTS AS LAKERS WIN 9TH STRAIGHT IN OT', 'APEX SPORTS'],
];

// ---- World map: stylised continents as filled blocks, 18 numbered pins ----
// Map box: x 24..700, y 200..300. Equirectangular: lon -180..180, lat 75..-60.
const MAP = { x: 24, y: 200, w: 676, h: 100 };
const LAND: [number, number, number, number][] = [
  [46, 206, 150, 18], [70, 224, 130, 14], [90, 238, 60, 10], [225, 206, 30, 12],
  [180, 250, 70, 16], [195, 266, 45, 18], [210, 284, 25, 14],
  [348, 214, 8, 10], [350, 206, 80, 12], [360, 218, 55, 12],
  [340, 232, 90, 16], [350, 248, 75, 18], [365, 266, 50, 16],
  [440, 202, 200, 14], [450, 216, 180, 14], [470, 230, 130, 12],
  [500, 232, 25, 20], [540, 242, 60, 8], [640, 218, 10, 18],
  [580, 268, 65, 16], [678, 282, 8, 10],
];
// [lon, lat, label, dx, dy] — dx/dy shift crowded dots away from their true spot.
const PINS: [number, number, string, number, number][] = [
  [114, 22.5, '1', 0, 0], [4.3, 52, '2', 0, -11], [127, 37.5, '3', 14, -12],
  [178, -18, '4', -12, 0], [126, 39.8, '5', 0, 0], [-67, 10.5, '6', 0, 0],
  [85, 19.3, '7', 0, 0], [174.8, -41.3, '8', 0, 0], [30.7, 36.9, '9', 0, 0],
  [-77, 38.9, '10', 0, 0], [30.5, 50.4, '11', 0, -12], [34.5, 31.5, '12', 0, 12],
  [46.7, 24.7, '13', 0, 0], [-74, 40.7, '14', 0, -12], [-118.1, 34.1, '15', 0, 0],
  [-72.3, 18.5, '16', 12, 8], [7.7, 45.1, '17', 0, 0], [74, 15.3, '18', 0, 0],
];
const PIN_GUIDE: string[][] = [
  ['1 SHENZHEN', '7 ODISHA', '13 RIYADH'],
  ['2 THE HAGUE', '8 WELLINGTON', '14 NEW YORK'],
  ['3 SEOUL', '9 ANTALYA', '15 PASADENA'],
  ['4 SUVA', '10 WASHINGTON', '16 HAITI'],
  ['5 YONGBYON', '11 KYIV', '17 TURIN'],
  ['6 CARACAS', '12 GAZA', '18 GOA'],
];
function lonToX(lon: number): number { return MAP.x + Math.round((lon + 180) * MAP.w / 360); }
function latToY(lat: number): number { return MAP.y + Math.round((75 - lat) * MAP.h / 135); }

// ---- UTC timeline: seven moments, times as reported in the 20 Nov cycle ----
const TIMELINE: [string, string, string][] = [
  ['00:22', 'WELLINGTON', 'PHILLIPS 118'],
  ['01:30', 'TOKYO', 'HAYABUSA2 DROPS LANDING'],
  ['01:43', 'ODISHA', 'AKVAN EVACUATIONS'],
  ['02:30', 'WASHINGTON', 'PETE ROSE PARDON'],
  ['03:06', 'WASHINGTON', 'TRUMP: NO IRAN RUSH'],
  ['03:13', 'NEW DELHI', 'IRAN CALL TO 2027'],
  ['17:00', 'WASHINGTON', 'TRUMP PRESSER'],
];

const BADGE: RGB[] = [RED, NAVY, TEAL, GOLD];

function paintMasthead(): void {
  rect(0, 0, W, 100, NAVY);
  drawStrC(512, 12, 'THE WORLD IN ONE DAY', 4, WHITE);
  drawStrC(512, 54, 'FRIDAY, 20 NOVEMBER 2026', 2, WHITE);
  drawStrC(512, 82, '50 SOURCED STORIES  •  18 PINS  •  UTC TIMELINE', 1, [200, 210, 225]);
  rect(0, 100, W, 4, RED);
}

function paintLead(): void {
  rect(16, 112, 62, 18, RED);
  drawStr(24, 117, 'LEAD', 1, WHITE);
  drawStr(92, 112, 'FIRST-EVER TRUMP-XI-PUTIN SUMMIT IN SHENZHEN', 2, INK);
  drawStr(16, 140, 'THREE LEADERS SIGN JOINT PEACE DECLARATION AFTER 90-MINUTE TALKS', 1, INK);
  drawStr(16, 156, 'APEC, SHENZHEN, CHINA - NUCLEAR ARMS, ENERGY AND ENDING WARS ON THE TABLE', 1, GREY);
  drawStr(880, 156, 'SOURCE: NEW YORK TIMES', 1, GREY);
  hRule(16, 172, 992, PALE);
}

function paintMap(): void {
  drawStr(16, 182, 'WHERE IT HAPPENED - WORLD MAP', 1, NAVY);
  drawStr(716, 182, 'PIN GUIDE', 1, NAVY);
  rect(MAP.x, MAP.y, MAP.w, MAP.h, OCEAN);
  for (const [x, y, w, h] of LAND) rect(x, y, w, h, GREEN);
  for (const [lon, lat, n, dx, dy] of PINS) {
    const cx = lonToX(lon);
    const cy = latToY(lat);
    if (dx !== 0 || dy !== 0) {
      if (dy !== 0) vRule(cx, Math.min(cy, cy + dy), Math.abs(dy), RED);
      if (dx !== 0) hRule(Math.min(cx, cx + dx), cy + dy, Math.abs(dx), RED);
    }
    disc(cx + dx, cy + dy, 6, RED);
    drawStr(cx + dx - (n.length === 2 ? 6 : 3), cy + dy - 3, n, 1, WHITE);
  }
  PIN_GUIDE.forEach((row, i) => {
    row.forEach((cell, j) => drawStr(716 + j * 98, 204 + i * 16, cell, 1, INK));
  });
  hRule(16, 308, 992, PALE);
}

function paintTimeline(): void {
  drawStr(16, 316, 'THROUGH THE DAY - ALL TIMES UTC', 1, NAVY);
  const y0 = 354;
  hRule(48, y0, 928, NAVY);
  TIMELINE.forEach(([t, place, what], i) => {
    const cx = 64 + i * 144;
    disc(cx, y0, 5, RED);
    drawStrC(cx, 334, t, 1, RED);
    drawStrC(cx, y0 + 10, place, 1, INK);
    drawStrC(cx, y0 + 22, what, 1, GREY);
  });
  hRule(16, 390, 992, PALE);
}

function paintStories(): void {
  drawStr(16, 398, 'THE DAY IN 50 STORIES - EACH WITH ITS SOURCE', 1, NAVY);
  drawStr(700, 398, 'HEADLINE - SOURCE', 1, GREY);
  STORIES.forEach(([head, src], i) => {
    const col = Math.floor(i / 25);
    const row = i % 25;
    const x = 16 + col * 508;
    const y = 418 + row * 21;
    rect(x, y, 22, 18, BADGE[i % 4]);
    drawStr(x + 4, y + 6, String(i + 1), 1, WHITE);
    drawStr(x + 28, y + 6, head + ' - ' + src, 1, INK);
  });
}

function paintFooter(): void {
  rect(0, 952, W, 4, RED);
  rect(0, 956, W, 68, NAVY);
  drawStrC(512, 984, '50 STORIES REPORTED IN THE 20 NOVEMBER 2026 NEWS CYCLE - ALL TIMES UTC', 1, WHITE);
}

function main(): void {
  rect(0, 0, W, H, PAPER);
  paintMasthead();
  paintLead();
  paintMap();
  paintTimeline();
  paintStories();
  paintFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), writePNG());
}

main();
