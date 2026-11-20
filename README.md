# The World in One Day — 20 November 2026

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node 22](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org/)
[![news-image-20261120](https://img.shields.io/badge/make.fun-news--image--20261120-blue.svg)](https://make.fun/c/news-image-20261120)

One image that sums up the world's news of Friday 20 November 2026:
**40 sourced stories, a UTC timeline and a world map with pins** — drawn
entirely by `main.ts` (Node 22, standard library only, no network).

Lead story: the first-ever Trump–Xi–Putin three-way summit in Shenzhen.
Also inside: the ICJ ruling on Myanmar, Cyclone Akvan's landfall in Odisha,
COP31's final day in Antalya, Wall Street's sharp fall after Anthropic's
record IPO, and 35 more stories from every region and beat — each with its
source named.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` (1024×1024 PNG, deterministic — two runs are
byte-identical).

## Entry

make.fun competition
[news-image-20261120](https://make.fun/c/news-image-20261120) — "Sum up
20 November's world news in one image".
