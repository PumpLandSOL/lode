'use strict';
// LODE brand-kit generator — the site's system: paper white + green pixel grid,
// ink borders + hard shadows, Press Start 2P / VT323 / Inter, pixel pickaxe mark,
// gold reserved for the motherlode. (Rule: the aesthetic is never the slogan.)
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const BASE = `
:root{--bg:#0a0f0c;--panel:#121a14;--ink:#e9f7ec;--sub:#a6c4ad;--mut:#6f8a75;--grn:#00c805;--dk:#3ae57e;--gold:#f5a623;--red:#ff4d68;
  --px:'Press Start 2P',monospace;--vt:'VT323',monospace}
*{margin:0;padding:0;box-sizing:border-box;border-radius:0}
html,body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);overflow:hidden;-webkit-font-smoothing:antialiased}
.stage{position:relative;overflow:hidden;background:var(--bg);background-image:
  repeating-linear-gradient(0deg,rgba(0,200,5,.08) 0 2px,transparent 2px 48px),
  repeating-linear-gradient(90deg,rgba(0,200,5,.08) 0 2px,transparent 2px 48px)}
.px{font-family:var(--px);font-weight:400}
.vt{font-family:var(--vt)}
.card{background:var(--panel);border:4px solid var(--ink);box-shadow:12px 12px 0 #000000}
`;

// pixel pickaxe + gold nugget — 16-cell grid rects
function mark(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" style="image-rendering:pixelated" xmlns="http://www.w3.org/2000/svg">
    <g fill="#00c805"><rect x="9" y="1" width="5" height="2"/><rect x="13" y="3" width="2" height="4"/><rect x="8" y="3" width="2" height="2"/><rect x="12" y="6" width="2" height="2"/></g>
    <g fill="#e9f7ec"><rect x="7" y="5" width="2" height="2"/><rect x="6" y="7" width="2" height="2"/><rect x="5" y="9" width="2" height="2"/><rect x="4" y="11" width="2" height="2"/><rect x="3" y="13" width="2" height="2"/></g>
    <g fill="#f5a623"><rect x="10" y="11" width="4" height="3"/><rect x="9" y="12" width="1" height="2"/><rect x="11" y="10" width="2" height="1"/></g>
    <g fill="#c77f0e"><rect x="10" y="13" width="4" height="1"/></g>
  </svg>`;
}
function lockup(fontPx) {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:${Math.round(fontPx * .4)}px">
    ${mark(Math.round(fontPx * 1.5))}<span class="px" style="font-size:${fontPx}px;letter-spacing:3px">LODE</span></div>`;
}
const chip = (t, mode) => `<span class="px" style="display:inline-flex;align-items:center;font-size:21px;line-height:1.5;color:${mode === 'g' ? '#fff' : mode === 'gold' ? '#fff' : 'var(--ink)'};background:${mode === 'g' ? 'var(--grn)' : mode === 'gold' ? 'var(--gold)' : 'var(--panel)'};border:3px solid var(--ink);box-shadow:6px 6px 0 #000000;padding:15px 24px">${t}</span>`;

// mini 5×5 board with a winning square
function board(size, win, gold) {
  const cell = size / 5, pad = size * .04, c = cell - pad;
  let rects = '';
  for (let i = 0; i < 25; i++) {
    const x = (i % 5) * cell, y = Math.floor(i / 5) * cell;
    const hot = i === win;
    rects += `<rect x="${x}" y="${y}" width="${c}" height="${c}" fill="${hot ? (gold ? '#f5a623' : '#00c805') : '#121a14'}" stroke="#e9f7ec" stroke-width="${size * .012}"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

function page(w, h, css, inner) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  .stage{width:${w}px;height:${h}px}${css}</style></head>
  <body><div class="stage">${inner}</div></body></html>`;
}

const assets = {};

// 1) PFP 2000²
assets['lode-pfp'] = page(2000, 2000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:80px}
  .tick{font-size:56px;color:var(--dk);letter-spacing:2px}
  .tag{font-family:'Inter';font-weight:600;font-size:44px;color:var(--sub)}`,
  `<div class="wrap">
     ${mark(760)}
     <span class="px" style="font-size:150px;letter-spacing:8px">LODE</span>
     <div style="text-align:center">
       <div class="px tick">$LODE</div>
       <div class="tag" style="margin-top:30px">deploy · mine · strike the motherlode</div>
     </div>
   </div>`);

// 2) BANNER 3000×1000
assets['lode-banner'] = page(3000, 1000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:52px}
  .tag{font-family:'Inter';font-weight:600;font-size:40px;color:var(--sub);max-width:1900px;text-align:center}
  .tag b{color:var(--ink)}
  .row{display:flex;gap:22px}
  .dom{font-size:26px;color:var(--dk);letter-spacing:2px}`,
  `<div class="wrap">
     ${lockup(96)}
     <div class="tag">The mining game on <b>Robinhood Chain</b> — 25 squares, one winner a minute,
       a <b style="color:var(--grn)">5,000,000</b> hard cap, and a <b style="color:var(--gold)">motherlode</b> that hits 1-in-500.</div>
     <div class="row">${chip('ROUND EVERY 60S', 'g')}${chip('PROVABLY FAIR')}${chip('MOTHERLODE 1-IN-500', 'gold')}</div>
     <div class="px dom">lodeminer.xyz · $LODE</div>
   </div>`);

// 3) KEYART 2400×1350 — the board is the hero
assets['lode-keyart'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:110px;padding:0 120px}
  .h{font-size:58px;line-height:1.7}
  .h .g{color:var(--grn)}.h .o{color:var(--gold)}
  .sub{font-family:'Inter';font-weight:600;font-size:30px;color:var(--sub);max-width:900px;line-height:1.65;margin-top:40px}
  .sub b{color:var(--ink)}
  .dom{font-size:26px;color:var(--dk);letter-spacing:2px;margin-top:44px}`,
  `<div class="wrap">
     <div>
       ${lockup(66)}
       <div class="px h" style="margin-top:48px">Deploy.<br>Mine.<br>Strike the <span class="o">motherlode.</span></div>
       <div class="sub">Pick a square. Every 60 seconds, entropy picks a winner — the winners split the
         losers' pot <b>and</b> the round's <b style="color:var(--grn)">$LODE</b> emission. Hard-capped at 5,000,000. Forever.</div>
       <div class="px dom">lodeminer.xyz</div>
     </div>
     <div class="card" style="padding:36px">${board(560, 12)}</div>
   </div>`);

// 4) HOW IT WORKS 2400×1350
const step = (n, t, d) => `<div class="card" style="flex:1;padding:40px 36px;box-shadow:8px 8px 0 #000000">
  <div class="vt" style="font-size:58px;color:var(--grn);line-height:1">${n}</div>
  <div class="px" style="font-size:19px;line-height:1.7;margin:20px 0 14px">${t}</div>
  <div style="font-family:'Inter';font-weight:500;font-size:22px;color:var(--sub);line-height:1.65">${d}</div></div>`;
assets['lode-how'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 100px;gap:50px}
  .head{text-align:center}
  .eye{font-size:16px;color:var(--dk);letter-spacing:4px;margin-bottom:26px}
  .h{font-size:48px;line-height:1.65}
  .h .g{color:var(--grn)}
  .row{display:flex;gap:30px}
  .foot{font-family:var(--vt);font-size:29px;color:var(--mut);text-align:center;letter-spacing:1px}
  .foot b{color:var(--dk);font-weight:400}`,
  `<div class="wrap">
     <div class="head"><div class="px eye">▲ THE GAME ▲</div>
       <div class="px h">One square wins <span class="g">every minute.</span></div></div>
     <div class="row">
       ${step('01', 'DEPLOY', 'Put ETH on any of 25 squares before the round closes. Spread wide or go heavy on one.')}
       ${step('02', 'STRIKE', 'A commit-reveal RNG picks the winning square — 1-in-25, verifiable, no re-rolls possible.')}
       ${step('03', 'COLLECT', 'Winners take their stake back + the losers&rsquo; pot + the round&rsquo;s +1 $LODE emission.')}
       ${step('04', 'MOTHERLODE', 'A jackpot pool grows +0.2 $LODE every round — and dumps entirely on 1-in-500 odds.')}
     </div>
     <div class="foot">1% protocol fee · 10% of winnings vaulted → <b>buy &amp; bury</b> · lodeminer.xyz</div>
   </div>`);

// 5) SUPPLY 2400×1350 — the 5M cap
assets['lode-supply'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;text-align:center}
  .eye{font-size:16px;color:var(--dk);letter-spacing:4px}
  .big{font-family:var(--vt);font-size:190px;line-height:1;color:var(--grn)}
  .h{font-size:30px;line-height:1.7}
  .sub{font-family:'Inter';font-weight:600;font-size:30px;color:var(--sub);max-width:1400px;line-height:1.65}
  .sub b{color:var(--ink)}
  .row{display:flex;gap:20px}
  .dom{font-size:24px;color:var(--dk);letter-spacing:2px}`,
  `<div class="wrap">
     <div class="px eye">▲ THE EMISSION ▲</div>
     <div class="big">5,000,000</div>
     <div class="px h">Hard cap. Mined, never minted to anyone.</div>
     <div class="sub">$LODE only enters the world one way: <b>+1 per round</b> to whoever wins the board,
       +0.2 to the motherlode pool. No premine allocation games, no unlocks, no team spigot —
       the emission schedule <b>is</b> the tokenomics.</div>
     <div class="row">${chip('+1 / ROUND', 'g')}${chip('1% FEE · 10% VAULT')}${chip('BUY & BURY', 'g')}</div>
     <div class="px dom">lodeminer.xyz · $LODE</div>
   </div>`);

// 6) PROVABLY FAIR 2400×1350
assets['lode-fair'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 130px;gap:46px}
  .head{text-align:center}
  .eye{font-size:16px;color:var(--dk);letter-spacing:4px;margin-bottom:26px}
  .h{font-size:46px;line-height:1.65}
  .h .g{color:var(--grn)}
  .codebox{background:#050a06;border:4px solid var(--ink);box-shadow:12px 12px 0 rgba(11,36,19,.25);padding:44px 52px}
  .codebox .vt{font-size:34px;color:#c8f7cf;line-height:2}
  .codebox .c{color:#6fae78}
  .codebox .g{color:#7dff8a}
  .foot{font-family:'Inter';font-weight:600;font-size:26px;color:var(--sub);text-align:center;line-height:1.65;max-width:1500px;margin:0 auto}
  .foot b{color:var(--ink)}`,
  `<div class="wrap">
     <div class="head"><div class="px eye">▲ PROVABLY FAIR ▲</div>
       <div class="px h">The house <span class="g">can't re-roll.</span></div></div>
     <div class="codebox">
       <div class="vt"><span class="c">// before the round opens, the secret is committed:</span></div>
       <div class="vt">commitment = <span class="g">sha256(secret)</span>          <span class="c">// published to every miner</span></div>
       <div class="vt"><span class="c">// at resolution, the secret is revealed. verify it yourself:</span></div>
       <div class="vt">rng = <span class="g">sha256(secret + ':' + roundId)</span></div>
       <div class="vt">winning_square = rng % 25   <span class="c">// same digest drives the 1-in-500 motherlode roll</span></div>
     </div>
     <div class="foot">Every resolved round publishes its secret next to its commitment. If they ever didn't match,
       you'd catch it in one line of code. <b>Fairness you can check, not trust.</b> · lodeminer.xyz</div>
   </div>`);

// 7) VS ORE 2400×1350 — same game, fresh board
const vrow = (k, ore, lode, hot) => `<tr>
  <td class="k">${k}</td><td class="o">${ore}</td><td class="l${hot ? ' hot' : ''}">${lode}</td></tr>`;
assets['lode-vs'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 130px;gap:40px}
  .head{text-align:center}
  .eye{font-size:16px;color:var(--dk);letter-spacing:4px;margin-bottom:24px}
  .h{font-size:44px;line-height:1.65}
  .h .g{color:var(--grn)}
  table{width:100%;border-collapse:separate;border-spacing:0 12px}
  th{font-family:var(--px);font-size:17px;text-align:left;padding:4px 26px;color:var(--mut);font-weight:400}
  th.l{color:var(--grn)}
  td{padding:19px 26px;font-family:'Inter';font-weight:500;font-size:23px;line-height:1.5;vertical-align:middle;background:var(--panel)}
  td.k{width:22%;font-family:var(--px);font-size:14px;line-height:1.6;color:var(--ink);border:2px solid var(--ink);border-right:none}
  td.o{width:36%;color:var(--mut);border:2px solid var(--ink);border-left:none;border-right:none}
  td.l{width:42%;color:var(--ink);background:rgba(0,200,5,.08);border:2px solid var(--grn);border-left:none}
  td.l b{color:var(--grn)}
  td.l.hot b{color:var(--gold)}
  .foot{font-family:var(--vt);font-size:27px;color:var(--mut);text-align:center;letter-spacing:1px}
  .foot b{color:var(--dk);font-weight:400}`,
  `<div class="wrap">
     <div class="head"><div class="px eye">▲ THE PRECEDENT ▲</div>
       <div class="px h">ORE ran to ~\$288M on Solana.<br><span class="g">LODE brings the game somewhere new.</span></div></div>
     <table>
       <tr><th></th><th>ORE · SOLANA</th><th class="l">LODE · ROBINHOOD CHAIN</th></tr>
       ${vrow('THE GAME', '25 squares, 1-min rounds — the original', '<b>The same proven game</b> — faithful mechanics, square for square')}
       ${vrow('THE ARENA', 'Solana — crowded, mature, priced in', '<b>First mining game on the chain</b> — an empty board')}
       ${vrow('FAIRNESS', 'On-chain entropy', '<b>Commit-reveal</b> — verify every round yourself in one line')}
       ${vrow('SUPPLY', '5,000,000 hard cap', '5,000,000 hard cap — <b>same discipline, zero premine</b>')}
       ${vrow('ATH', '~\$288M', '<b>unwritten</b> — the board just opened', true)}
     </table>
     <div class="foot">same game. fresh chain. <b>lodeminer.xyz · \$LODE</b></div>
   </div>`);

for (const [name, html] of Object.entries(assets)) {
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
