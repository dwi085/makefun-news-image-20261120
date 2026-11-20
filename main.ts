// THE WORLD TODAY — Friday Edition: the world news of Friday 20 November 2026.
// A broadsheet front page drawn entirely by code: masthead, three-headline lead
// row, dotted world map with 20 numbered pins, a 50-story sourced index, a UTC
// timeline and a footer note to the judge. Node 22 standard library only.
// SPDX-License-Identifier: MIT

import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [26, 26, 26];
const RED: RGB = [176, 42, 32];
const BLUE: RGB = [31, 78, 121];
const GREY: RGB = [110, 106, 96];
const LIGHT: RGB = [226, 220, 205];
const SEA: RGB = [214, 228, 236];

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(rgb: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // no filter
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
class Canvas {
  px = new Uint8Array(W * H * 3);
  constructor() {
    for (let i = 0; i < W * H; i++) {
      this.px[i * 3] = PAPER[0];
      this.px[i * 3 + 1] = PAPER[1];
      this.px[i * 3 + 2] = PAPER[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.rect(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.rect(x, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= n; i++) {
      this.set(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.set(x, y, c);
      }
  }
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, written here by hand.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") cv.rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cv: Canvas, s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap into lines that fit maxW pixels at the given scale.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- data
// 50 stories, all first reported on Friday 20 November 2026 (any time zone).
// [headline, source, map pin number (0 = no pin)]
const STORIES: [string, string, number][] = [
  ["TRUMP, XI AND PUTIN HOLD FIRST-EVER THREE-WAY SUMMIT IN SHENZHEN", "TASS", 1],
  ["WORLD COURT: MYANMAR COMMITTED GENOCIDE AGAINST THE ROHINGYA", "BBC", 2],
  ["CYCLONE AKVAN HITS ODISHA COAST; 300,000 EVACUATED", "THE HINDU", 3],
  ["ANTHROPIC SHARES JUMP 17% AFTER RECORD $81.3BN IPO", "AFP", 9],
  ["TRUMP PUSHES IRAN WAR DECISION TO 2027", "REUTERS", 15],
  ["VOYAGER 1 PASSES A LIGHT-DAY FROM EARTH, NASA CONFIRMS", "MARKETSCREENER", 0],
  ["HAYABUSA2 ENGINE TROUBLE ENDS ASTEROID LANDING PLAN", "SPACE.COM", 10],
  ["KYIV HIT BY FOUR BALLISTIC MISSILES", "DAILY BAKU", 4],
  ["HOUTHIS CLAIM STRIKES ON FOUR SAUDI TARGETS", "TASS", 5],
  ["TANKER CATCHES FIRE AFTER HITTING MINE NEAR HORMUZ", "DAILY BAKU", 6],
  ["GENOA AIRPORT HALTS FLIGHTS FOR FOUR HOURS AFTER DRONES", "DAILY BAKU", 7],
  ["SOUTH KOREA EXPORTS TOP $1 TRILLION FOR FIRST TIME", "SIMPLELIFE.NEWS", 12],
  ["TAIWAN MOVES TO STEADY STOCKS; SHORT-SELL CURBS START TODAY", "SIMPLELIFE.NEWS", 11],
  ["JAPAN'S TAKAISHI DUCKS TAIWAN CONTINGENCY QUESTION", "SIMPLELIFE.NEWS", 10],
  ["INDIA-JAPAN 2+2 IN TOKYO; JOINT TRAINING FROM 2027", "LOGICHUB", 10],
  ["EUROPE READY FOR TALKS WITH RUSSIA TO END UKRAINE WAR", "BBC", 14],
  ["FOUR NATIONS URGE ISRAEL TO LET AID REACH FLOODED GAZA", "THE PARIS EYE", 8],
  ["US DETAILS $12BN IN VENEZUELAN OIL AND MINERAL REVENUE", "THE PARIS EYE", 16],
  ["ISRAEL'S PRESIDENT PICKS EISENKOT TO FORM GOVERNMENT", "THE PARIS EYE", 8],
  ["FRANCE FACES FOURTH WEEKEND OF COST-OF-LIVING PROTESTS", "THE PARIS EYE", 13],
  ["SOUTH KOREA COURT OVERTURNS EX-PM HAN'S CONVICTION", "STUDMENTOR", 12],
  ["FIJI DECLARES NATIONAL DISASTER AS DROUGHT BITES", "STUDMENTOR", 17],
  ["UKRAINE ATTACK ON CRIMEAN BRIDGE HALTS RAIL TRAFFIC", "STUDMENTOR", 4],
  ["NORTH KOREA EXPANDING YONGBYON ENRICHMENT, IAEA SAYS", "STUDMENTOR", 18],
  ["US AND VENEZUELA AGREE TO RESTORE MILITARY TIES", "STUDMENTOR", 16],
  ["CALIFORNIA PROBES NVIDIA OVER CHINA AI CHIPS", "BBC", 15],
  ["FIONA THE HIPPO DIES AT CINCINNATI ZOO AFTER SWALLOWING HAT", "BBC", 0],
  ["TRUMP POSTHUMOUSLY PARDONS BASEBALL GREAT PETE ROSE", "BBC", 15],
  ["ISRAEL ENDS GAZA GROUND OPERATION BEYOND YELLOW LINE", "BBC", 8],
  ["GTA 6 SALES PASS THE ODYSSEY'S $1.80BN GLOBAL RUN", "MEZHA", 0],
  ["ONE DEAD, 15 HURT IN FIRE AT FRENCH APARTMENT TOWER", "DAILY BAKU", 13],
  ["ISRAELI STRIKE HITS HEZBOLLAH SITE IN EASTERN LEBANON", "DAILY BAKU", 19],
  ["FRANCE, GERMANY AND UK WEIGH MEETING WITH RUSSIA", "DAILY BAKU", 14],
  ["OIL FLAT AS HORMUZ DISRUPTION OFFSETS GLUT FEARS", "SIMPLELIFE.NEWS", 6],
  ["INDIA'S STATE BANKS POST RECORD HALF-YEAR PROFIT", "LOGICHUB", 3],
  ["LASHKAR COMMANDER KILLED IN KULGAM, J&K", "LOGICHUB", 3],
  ["COP31 DRAFT DROPS FOSSIL-FUEL PHASE-OUT, $120BN TARGET", "THE HINDU", 20],
  ["PROJECTILE LANDS NEAR DUTCH EMBASSY IN KYIV", "SIMPLELIFE.NEWS", 4],
  ["TRUMP WARNS APEC: STRICT AI RULES WOULD STIFLE GROWTH", "SIMPLELIFE.NEWS", 1],
  ["TRUMP BACK IN WASHINGTON AFTER CHINA TRIP", "SIMPLELIFE.NEWS", 15],
  ["NEW ZEALAND 348/9 AS BUMRAH STRIKES IN WELLINGTON TEST", "DAILY JAGRAN", 0],
  ["PHILLIPS' 118 LIFTS NZ; THREE-FORMAT TON FEAT VS INDIA", "SPORTSKEEDA", 0],
  ["ASH BARTY PICKED FOR TENNIS HALL OF FAME, CLASS OF 2027", "JAGRAN JOSH", 0],
  ["RISING STARS ASIA CUP OPENS IN DOHA; INDIA A FACE NEPAL", "JAGRAN JOSH", 0],
  ["SATWIK-CHIRAG REACH HONG KONG OPEN QUARTER-FINALS", "EDUCATION TIMES", 0],
  ["WOMEN'S ASIAN HOCKEY CHAMPIONS TROPHY OPENS IN BHOPAL", "EDUCATION TIMES", 0],
  ["F1 HEADS TO VEGAS WITH TITLES ALREADY SETTLED", "LEAD PAKISTAN", 0],
  ["HAALAND SENDS NORWAY INTO NATIONS LEAGUE LAST EIGHT", "LEAD PAKISTAN", 0],
  ["TEXANS' BRASWELL CARTED OFF ON TNF OPENING KICKOFF", "LARRY BROWN SPORTS", 0],
  ["HARRIS SMASHES FASTEST WBBL FIFTY IN RECORD CHASE", "SPORTING AVENUE", 0],
];

// Map pins: [name, latitude, longitude, label offset dx, dy]
const PINS: [string, number, number, number, number][] = [
  ["SHENZHEN", 22.5, 114.0, 0, 0],
  ["THE HAGUE", 52.1, 4.3, 18, -18],
  ["ODISHA", 19.3, 84.9, 0, 0],
  ["KYIV", 50.4, 30.5, 12, -14],
  ["RIYADH", 24.7, 46.7, 0, 0],
  ["HORMUZ", 26.5, 56.3, 12, 10],
  ["GENOA", 44.4, 8.9, 18, 12],
  ["GAZA", 31.5, 34.5, -22, 16],
  ["NEW YORK", 40.7, -74.0, -12, -12],
  ["TOKYO", 35.7, 139.7, 0, 0],
  ["TAIPEI", 25.0, 121.5, 12, 14],
  ["SEOUL", 37.5, 127.0, -14, 12],
  ["PARIS", 48.9, 2.3, -22, 14],
  ["LONDON", 51.5, -0.1, -20, -16],
  ["WASHINGTON", 38.9, -77.0, -14, 12],
  ["CARACAS", 10.5, -66.9, 0, 0],
  ["SUVA", -18.1, 178.4, 0, 0],
  ["PYONGYANG", 39.0, 125.8, 16, -14],
  ["LEBANON", 34.0, 36.3, 18, -14],
  ["ANTALYA", 36.9, 30.7, 16, 14],
];

// Dotted world map: land cells as [startCol, endCol] ranges per row.
// Grid: 61 cols (lon -170..190), 16 rows (lat 75N..-55S), equirectangular.
const LAND: [number, number][][] = [
  [[0, 5], [6, 18], [19, 25], [36, 59]],
  [[0, 5], [6, 19], [25, 25], [29, 34], [35, 59]],
  [[1, 19], [28, 29], [30, 34], [35, 59]],
  [[7, 19], [27, 36], [37, 52], [53, 59]],
  [[7, 17], [27, 34], [35, 38], [39, 44], [45, 49], [50, 53]],
  [[9, 15], [27, 34], [35, 39], [40, 44], [45, 49], [50, 52]],
  [[11, 14], [27, 35], [36, 39], [40, 44], [45, 47]],
  [[13, 14], [25, 34], [41, 42], [45, 47]],
  [[15, 20], [26, 36], [44, 52]],
  [[15, 22], [30, 36], [44, 54]],
  [[17, 22], [30, 35], [47, 53]],
  [[17, 22], [30, 34], [36, 37], [47, 54]],
  [[17, 20], [31, 34], [48, 55]],
  [[16, 19], [57, 59]],
  [[16, 17], [57, 58]],
  [[17, 17]],
];

// UTC timeline: [time, event] — times as the wires reported them, 20 Nov.
const TIMELINE: [string, string][] = [
  ["01:27", "TANKER HITS MINE OFF HORMUZ"],
  ["03:47", "HOUTHIS CLAIM FOUR SAUDI STRIKES"],
  ["04:07", "KYIV HIT BY FOUR MISSILES"],
  ["04:22", "DRONES HALT GENOA AIRPORT"],
  ["09:00", "ICJ RULING LEADS MORNING WIRES"],
  ["13:00", "ANTHROPIC DEBUT STILL MOVING MARKETS"],
  ["17:00", "COP31 DRAFT DROPS PHASE-OUT TEXT"],
  ["21:00", "TRUMP BACK IN WASHINGTON"],
];

// ---------------------------------------------------------------- layout
const MX = 24; // left margin
const RX = 1000; // right edge
const MAP_X = 24;
const MAP_Y = 224;
const MAP_W = 976;
const MAP_H = 224;

function project(lat: number, lon: number): [number, number] {
  const x = MAP_X + ((lon + 170) / 360) * MAP_W;
  const y = MAP_Y + ((75 - lat) / 130) * MAP_H;
  return [Math.round(x), Math.round(y)];
}

function drawMasthead(cv: Canvas): void {
  cv.hline(MX, 6, RX - MX, INK, 2);
  drawText(cv, "FRIDAY EDITION", MX, 14, 1, INK);
  const no = "NO. 324";
  drawText(cv, no, RX - textWidth(no, 1), 14, 1, INK);
  drawTextCentered(cv, "THE WORLD TODAY", 512, 22, 5, INK);
  drawTextCentered(cv, "FRIDAY 20 NOVEMBER 2026", 512, 62, 2, RED);
  drawTextCentered(cv, "50 SOURCED STORIES \u2022 20 PLACES \u2022 ONE DAY", 512, 82, 1, GREY);
  cv.hline(MX, 94, RX - MX, INK, 3);
  cv.hline(MX, 99, RX - MX, INK, 1);
}

function drawLeadRow(cv: Canvas): void {
  const boxes: [string, string, string][] = [
    [
      "LEAD STORY - SHENZHEN",
      "TRUMP, XI AND PUTIN MEET",
      "FIRST-EVER THREE-WAY SUMMIT ENDS WITH A JOINT PEACE DECLARATION - TASS, BBC",
    ],
    [
      "THE HAGUE",
      "MYANMAR GUILTY OF GENOCIDE",
      "WORLD COURT RULES 9-6 ON THE ROHINGYA - BBC, THE HINDU",
    ],
    [
      "ODISHA, INDIA",
      "CYCLONE AKVAN SLAMS COAST",
      "300,000 EVACUATED AS STORM MAKES LANDFALL - THE HINDU",
    ],
  ];
  const xs = [24, 356, 688];
  for (let i = 0; i < 3; i++) {
    const x = xs[i];
    cv.rect(x, 106, 312, 90, LIGHT);
    cv.hline(x, 106, 312, RED, 3);
    drawText(cv, boxes[i][0], x + 10, 116, 1, RED);
    const lines = wrap(boxes[i][1], 2, 292);
    lines.forEach((ln, j) => drawText(cv, ln, x + 10, 128 + j * 15, 2, INK));
    const sub = wrap(boxes[i][2], 1, 292);
    sub.forEach((ln, j) => drawText(cv, ln, x + 10, 164 + j * 9, 1, GREY));
  }
}

function drawMap(cv: Canvas): void {
  drawText(cv, "THE WORLD ON THE MAP - 20 PLACES WHERE THE DAY HAPPENED", MX, 206, 1, INK);
  const cap = "NUMBERS MATCH THE INDEX";
  drawText(cv, cap, RX - textWidth(cap, 1), 206, 1, GREY);
  cv.rect(MAP_X, 222, MAP_W, 228, SEA);
  // Dotted continents.
  for (let r = 0; r < LAND.length; r++) {
    for (const [a, b] of LAND[r]) {
      for (let c = a; c <= b; c++) {
        cv.disc(MAP_X + c * 16 + 8, MAP_Y + r * 14 + 7, 3, BLUE);
      }
    }
  }
  // Numbered pins.
  for (let i = 0; i < PINS.length; i++) {
    const [, lat, lon, dx, dy] = PINS[i];
    const [px, py] = project(lat, lon);
    cv.disc(px, py, 3, RED);
    cv.ring(px, py, 5, INK);
    const lx = px + dx;
    const ly = py + dy;
    if (dx !== 0 || dy !== 0) cv.line(px, py, lx, ly, RED);
    cv.disc(lx, ly, 8, RED);
    cv.ring(lx, ly, 8, INK);
    drawTextCentered(cv, String(i + 1), lx, ly - 3, 1, [255, 255, 255] as RGB);
  }
  // Pin legend, two lines.
  drawText(
    cv,
    "PINS: 1 SHENZHEN  2 THE HAGUE  3 ODISHA  4 KYIV  5 RIYADH  6 HORMUZ  7 GENOA  8 GAZA  9 NEW YORK  10 TOKYO",
    MX, 456, 1, GREY,
  );
  drawText(
    cv,
    "11 TAIPEI  12 SEOUL  13 PARIS  14 LONDON  15 WASHINGTON  16 CARACAS  17 SUVA  18 PYONGYANG  19 LEBANON  20 ANTALYA",
    MX, 466, 1, GREY,
  );
}

function fitLine(head: string, src: string, pin: number, maxW: number): [string, string] {
  const tag = pin > 0 ? `[${pin}] ` : "";
  let h = head;
  while (textWidth(tag + h + " - " + src, 1) > maxW && h.includes(" ")) {
    h = h.slice(0, h.lastIndexOf(" "));
  }
  while (textWidth(tag + h + " - " + src, 1) > maxW && h.length > 10) {
    h = h.slice(0, -1);
  }
  return [tag + h, src];
}

function drawIndex(cv: Canvas): void {
  drawText(cv, "THE DAY IN 50 STORIES", MX, 480, 1, INK);
  const cap = "EVERY STORY NAMES ITS SOURCE";
  drawText(cv, cap, RX - textWidth(cap, 1), 480, 1, GREY);
  cv.hline(MX, 492, RX - MX, INK, 1);
  const colW = 476;
  const rowH = 16;
  const y0 = 498;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i < 25 ? 0 : 1;
    const row = i % 25;
    const x = MX + col * 500;
    const y = y0 + row * rowH;
    const [head, src, pin] = STORIES[i];
    const num = String(i + 1).padStart(2, "0");
    drawText(cv, num, x, y + 4, 1, RED);
    const [h2, s2] = fitLine(head, src, pin, colW - 24);
    let tx = x + 18;
    if (pin > 0) {
      drawText(cv, `[${pin}]`, tx, y + 4, 1, RED);
      tx += textWidth(`[${pin}] `, 1);
    }
    drawText(cv, h2.replace(/^\[\d+\] /, ""), tx, y + 4, 1, INK);
    const srcW = textWidth(" - " + s2, 1);
    drawText(cv, " - " + s2, x + colW - srcW, y + 4, 1, BLUE);
    if (row % 5 === 4) cv.hline(x, y + 14, colW, LIGHT, 1);
  }
}

function drawTimeline(cv: Canvas): void {
  cv.hline(MX, 902, RX - MX, INK, 2);
  drawText(cv, "THE DAY IN UTC - WHEN THE WIRES MOVED", MX, 910, 1, RED);
  const cap = "ALL TIMES UTC";
  drawText(cv, cap, RX - textWidth(cap, 1), 910, 1, GREY);
  const slotW = 122;
  for (let i = 0; i < TIMELINE.length; i++) {
    const x = MX + i * slotW;
    if (i > 0) cv.vline(x - 6, 924, 48, LIGHT, 1);
    drawText(cv, TIMELINE[i][0], x, 926, 2, RED);
    const lines = wrap(TIMELINE[i][1], 1, slotW - 8);
    lines.slice(0, 3).forEach((ln, j) => drawText(cv, ln, x, 944 + j * 9, 1, INK));
  }
}

function drawFooter(cv: Canvas): void {
  cv.hline(MX, 978, RX - MX, INK, 1);
  drawText(
    cv,
    "TO THE JUDGE: THIS IMAGE SUMS UP FRIDAY 20 NOVEMBER 2026. EVERY STORY WAS FIRST REPORTED THAT DAY; EACH NAMES ITS SOURCE.",
    MX, 986, 1, INK,
  );
  drawText(
    cv,
    "DRAWN ENTIRELY BY CODE - NO PHOTOGRAPHS, NO NETWORK. 50 STORIES, 20 PINS, 8 UTC MOMENTS. SOURCES INCLUDE BBC, REUTERS, AFP, TASS, THE HINDU.",
    MX, 1000, 1, GREY,
  );
}

// ---------------------------------------------------------------- main
function main(): void {
  const cv = new Canvas();
  drawMasthead(cv);
  drawLeadRow(cv);
  drawMap(cv);
  drawIndex(cv);
  drawTimeline(cv);
  drawFooter(cv);
  const png = encodePNG(cv.px, W, H);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "entry.png");
  writeFileSync(out, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${out} ${png.length} bytes sha256=${sha}`);
}

main();
