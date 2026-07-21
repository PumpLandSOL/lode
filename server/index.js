// LODE — a faithful port of the ORE board game (regolith-labs/ore, BoardV4 era) to
// Robinhood Chain (EVM). 25 squares. Deploy ETH. Entropy picks one winning square.
// Winners split the losers' pot AND the round's $LODE emission. 5,000,000 hard cap.
// Motherlode jackpot: +0.2 LODE accrues per round, hits with 1-in-500 odds.
//
// Faithful mechanics (from ore program/src/reset.rs + api/src/state/round.rs):
//   winning square  = rng % 25 (uniform)
//   winnings        = sum(losing squares) − 1% protocol fee − 10% vault cut → winners pro-rata
//   nobody on winner→ entire pot (minus fee) is vaulted
//   emission        = +1 LODE per round until the 5M cap; 50/50 solo (weighted top miner) vs split
//   motherlode      = +0.2 LODE per round into the pool; rng2 % 500 == 0 pays the whole pool
//   vaulted ETH     → buy-and-bury (buyback & burn) once $LODE trades
//   production cost = EMA of ETH burned per LODE mined (the "mining cost" oracle)
//
// Entropy is commit-reveal: each round's secret is committed (sha256) at round start and
// revealed at resolution — anyone can verify no re-rolls. OPEN BETA: balances are a
// simulated ledger, no custody, no promised returns. Dependency-free Node.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +(process.env.PORT || 8158);
const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const TOKEN = 'LODE';
const MINT = process.env.LODE_MINT || '';            // CA bar dormant until launch
const ROUND_SEC = +(process.env.ROUND_SEC || 60);    // mining window (ORE: ~1 min of slots)
const BREAK_SEC = +(process.env.BREAK_SEC || 15);    // intermission (ORE: 35 slots)
const MAX_SUPPLY = 5_000_000;                        // hard cap (ORE: 5M)
const EMISSION = 1;                                  // +1 LODE per round
const LODE_MOTHER = 0.2;                             // +0.2 LODE per round → motherlode pool
const FEE_BPS = 100;                                 // 1% protocol fee
const VAULT_BPS = 1000;                              // 10% of winnings → vault (fuels bury)
const SEED_ETH = +(process.env.SEED_ETH || 0.1);     // open-beta ledger seed per wallet
const MIN_DEPLOY = 0.0001;

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r9 = (x) => Math.round(x * 1e9) / 1e9;
const now = () => Date.now();
const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s || '');
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const short = (w) => (w || '').slice(0, 6) + '…' + (w || '').slice(-4);

// ---------- persistence ----------
let db = null;
try { db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch (e) {}
if (!db) db = {
  roundId: 1,
  supply: 0,                    // LODE minted so far
  buried: 0,                    // LODE bought & buried (sim counter, activates with a real pool)
  motherlode: 0,                // LODE in the jackpot pool
  vaultEth: 0,                  // ETH vaulted (fuels bury)
  feeEth: 0,                    // protocol fee collected
  costEma: 0,                   // ETH per LODE production cost (EMA)
  wallets: {},                  // 0x -> { eth, lode, wonEth, mined, rounds, joined }
  history: [],                  // resolved rounds (last 120)
  stats: { rounds: 0, deployedEth: 0, winningsEth: 0, motherlodes: 0 },
};
let DIRTY = false; const dirty = () => { DIRTY = true; };
setInterval(() => { if (DIRTY) { DIRTY = false; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} } }, 2000);

function W(a) {
  a = a.toLowerCase();
  if (!db.wallets[a]) { db.wallets[a] = { eth: SEED_ETH, lode: 0, wonEth: 0, mined: 0, rounds: 0, joined: now() }; dirty(); }
  return db.wallets[a];
}

// ---------- live $LODE price (once launched) ----------
let PRICE = 0;
async function pollPrice() {
  if (!MINT) return;
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MINT, { headers: { accept: 'application/json' } });
    if (!r.ok) return;
    const pairs = ((await r.json()).pairs || []).filter((p) => p.chainId === 'robinhood' && +p.priceUsd > 0);
    pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    if (pairs[0]) PRICE = +pairs[0].priceUsd;
  } catch (e) {}
}
pollPrice(); setInterval(pollPrice, 60000);

// ---------- the round ----------
// commit-reveal entropy: secret committed at round start, revealed at resolution.
let ROUND = null;
function newRound() {
  const secret = crypto.randomBytes(32).toString('hex');
  ROUND = {
    id: db.roundId,
    secret,                                          // revealed at resolution
    commitment: sha(secret).toString('hex'),         // published now
    startsAt: now(),
    endsAt: now() + ROUND_SEC * 1000,
    deployed: Array(25).fill(0),                     // ETH per square
    miners: Array.from({ length: 25 }, () => ({})),  // square -> { wallet: eth }
    count: Array(25).fill(0),                        // unique miners per square
    totalMiners: new Set(),
  };
  cast({ type: 'round', round: pubRound() });
}
function pubRound() {
  return { id: ROUND.id, commitment: ROUND.commitment, startsAt: ROUND.startsAt, endsAt: ROUND.endsAt,
    deployed: ROUND.deployed.map(r6), count: ROUND.count, totalDeployed: r6(ROUND.deployed.reduce((a, b) => a + b, 0)),
    miners: ROUND.totalMiners.size, motherlode: r6(db.motherlode), supply: r6(db.supply) };
}

function deploy(wallet, square, amount) {
  wallet = wallet.toLowerCase();
  if (!ROUND || ROUND.resolving || now() >= ROUND.endsAt) return { error: 'round is resolving — wait for the next one' };
  square = Math.floor(+square);
  if (!(square >= 0 && square < 25)) return { error: 'pick a square (0–24)' };
  amount = +amount;
  if (!(amount >= MIN_DEPLOY)) return { error: 'minimum deploy is ' + MIN_DEPLOY + ' ETH' };
  const w = W(wallet);
  if (w.eth < amount) return { error: 'not enough beta ETH (' + r6(w.eth) + ')' };
  w.eth = r9(w.eth - amount);
  if (!ROUND.miners[square][wallet]) ROUND.count[square]++;
  ROUND.miners[square][wallet] = r9((ROUND.miners[square][wallet] || 0) + amount);
  ROUND.deployed[square] = r9(ROUND.deployed[square] + amount);
  if (!ROUND.totalMiners.has(wallet)) { ROUND.totalMiners.add(wallet); w.rounds++; }
  db.stats.deployedEth = r6(db.stats.deployedEth + amount);
  dirty();
  cast({ type: 'deploy', square, amount: r6(amount), wallet: short(wallet), round: ROUND.id,
    deployed: ROUND.deployed.map(r6), count: ROUND.count });
  return { ok: true, square, amount, account: pubAccount(wallet) };
}

// resolution — the faithful reset.rs math
function resolve() {
  const R = ROUND;
  const rngBuf = sha(R.secret + ':' + R.id);
  const r = Number((rngBuf.readBigUInt64LE(0) ^ rngBuf.readBigUInt64LE(8) ^ rngBuf.readBigUInt64LE(16) ^ rngBuf.readBigUInt64LE(24)) & 0xFFFFFFFFFFFFFn);
  const r2 = Number(rngBuf.readBigUInt64LE(8) & 0xFFFFFFFFFFFFFn);
  const winning = r % 25;
  const totalDeployed = R.deployed.reduce((a, b) => a + b, 0);
  const rec = { id: R.id, winning, commitment: R.commitment, secret: R.secret, ts: now(),
    totalDeployed: r6(totalDeployed), miners: R.totalMiners.size, deployed: R.deployed.map(r6),
    winners: 0, winningsEth: 0, vaultedEth: 0, minted: 0, motherlode: 0, split: false, topMiner: null };

  if (totalDeployed > 0) {
    const fee = totalDeployed * FEE_BPS / 1e4;
    db.feeEth = r6(db.feeEth + fee);
    if (R.deployed[winning] === 0) {
      // nobody on the winning square — vault everything (minus fee)
      const vaulted = totalDeployed - fee;
      db.vaultEth = r6(db.vaultEth + vaulted);
      rec.vaultedEth = r6(vaulted);
    } else {
      // winners split the losers' pot (minus 1% fee, minus 10% vault cut) + get their stake back
      let winnings = totalDeployed - R.deployed[winning];
      const wFee = winnings * FEE_BPS / 1e4;
      winnings -= wFee; db.feeEth = r6(db.feeEth + wFee - fee); // fee applied on winnings path only (faithful)
      const vaultCut = winnings * VAULT_BPS / 1e4;
      winnings -= vaultCut;
      db.vaultEth = r6(db.vaultEth + vaultCut);
      rec.vaultedEth = r6(vaultCut);
      rec.winningsEth = r6(winnings);
      db.stats.winningsEth = r6(db.stats.winningsEth + winnings);

      // emission: +1 LODE (capped), +0.2 to motherlode pool (capped)
      let mint = Math.min(EMISSION, Math.max(0, MAX_SUPPLY - db.supply));
      db.supply = r6(db.supply + mint);
      let motherMint = Math.min(LODE_MOTHER, Math.max(0, MAX_SUPPLY - db.supply));
      db.supply = r6(db.supply + motherMint);
      db.motherlode = r6(db.motherlode + motherMint);
      rec.minted = r6(mint + motherMint);

      // motherlode: 1-in-500
      let motherPay = 0;
      if (r2 % 500 === 0 && db.motherlode > 0) { motherPay = db.motherlode; db.motherlode = 0; db.stats.motherlodes++; rec.motherlode = r6(motherPay); }

      const entries = Object.entries(R.miners[winning]);
      rec.winners = entries.length;
      const sq = R.deployed[winning];
      // 50/50: split the +1 LODE pro-rata, or a deployment-weighted top miner takes it solo
      const split = (r2 % 2) === 0;
      rec.split = split;
      let topWallet = null;
      if (!split) {
        let sample = (Number(rngBuf.readBigUInt64LE(16) & 0xFFFFFFFFFFFFFn) / 0xFFFFFFFFFFFFF) * sq, cum = 0;
        for (const [wal, amt] of entries) { cum += amt; if (sample <= cum) { topWallet = wal; break; } }
        if (!topWallet) topWallet = entries[entries.length - 1][0];
        rec.topMiner = short(topWallet);
      }
      for (const [wal, amt] of entries) {
        const share = amt / sq;
        const w = W(wal);
        w.eth = r9(w.eth + amt + winnings * share);                   // stake back + ETH winnings
        w.wonEth = r6(w.wonEth + winnings * share);
        let lode = split ? mint * share : (wal === topWallet ? mint : 0);
        lode += motherPay * share;                                    // motherlode splits pro-rata among winners
        w.lode = r6(w.lode + lode);
        w.mined = r6(w.mined + lode);
      }
      // production cost EMA (ETH burned per LODE minted)
      if (mint > 0) { const cost = (totalDeployed - winnings - R.deployed[winning]) / mint; db.costEma = r6(db.costEma ? db.costEma * 0.9 + cost * 0.1 : cost); }
    }
  }
  db.roundId++; db.stats.rounds++;
  db.history.unshift(rec); if (db.history.length > 120) db.history.pop();
  dirty();
  cast({ type: 'resolve', result: rec, treasury: pubTreasury() });
}

function tickLoop() {
  if (!ROUND) newRound();
  if (now() >= ROUND.endsAt) {
    resolve();
    setTimeout(() => { newRound(); }, BREAK_SEC * 1000);
    ROUND = { ...ROUND, endsAt: Infinity, resolving: true };  // block deploys during intermission
  }
}
setInterval(tickLoop, 500);

// ---------- bots (the board is never empty) ----------
const BOTS = Array.from({ length: 6 }, (_, i) => '0xb07' + String(i).padStart(37, '0'));
setInterval(() => {
  if (!ROUND || ROUND.resolving || now() >= ROUND.endsAt - 2000) return;
  if (Math.random() < 0.55) {
    const b = BOTS[Math.floor(Math.random() * BOTS.length)];
    const w = W(b); if (w.eth < 0.002) w.eth = SEED_ETH;
    deploy(b, Math.floor(Math.random() * 25), r6(0.0005 + Math.random() * 0.004));
  }
}, 2500);

// ---------- views ----------
function pubTreasury() {
  return { vaultEth: r6(db.vaultEth), feeEth: r6(db.feeEth), motherlode: r6(db.motherlode),
    supply: r6(db.supply), maxSupply: MAX_SUPPLY, buried: r6(db.buried), costEma: db.costEma,
    priceUsd: PRICE || null, mcap: PRICE ? r6(PRICE * db.supply) : null };
}
function pubAccount(wallet) {
  wallet = wallet.toLowerCase();
  const w = W(wallet);
  const inRound = ROUND && !ROUND.resolving ? ROUND.miners.map((m) => r6(m[wallet] || 0)) : Array(25).fill(0);
  return { wallet, eth: r9(w.eth), lode: r6(w.lode), wonEth: r6(w.wonEth), mined: r6(w.mined), rounds: w.rounds, inRound };
}
function leaderboard() {
  return Object.entries(db.wallets).filter(([a]) => !a.startsWith('0xb07'))
    .map(([a, w]) => ({ wallet: short(a), lode: r6(w.lode), wonEth: r6(w.wonEth), rounds: w.rounds }))
    .sort((a, b) => b.lode - a.lode).slice(0, 10);
}

// ---------- hand-rolled WebSocket ----------
const socks = new Set();
function frame(str) {
  const p = Buffer.from(str); const l = p.length; let h;
  if (l < 126) h = Buffer.from([0x81, l]);
  else if (l < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(l, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(l), 2); }
  return Buffer.concat([h, p]);
}
function cast(ev) { if (!socks.size) return; const f = frame(JSON.stringify(ev)); for (const s of socks) { try { s.write(f); } catch (e) { socks.delete(s); } } }

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
const json = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(b); };
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  const qs = new URLSearchParams(req.url.split('?')[1] || '');
  if (u === '/api/config') return json(res, 200, { token: TOKEN, mint: MINT, network: 'robinhood-chain', roundSec: ROUND_SEC, breakSec: BREAK_SEC, maxSupply: MAX_SUPPLY, emission: EMISSION, motherOdds: 500, feeBps: FEE_BPS, vaultBps: VAULT_BPS, minDeploy: MIN_DEPLOY, seedEth: SEED_ETH });
  if (u === '/api/state') return json(res, 200, { round: ROUND && !ROUND.resolving ? pubRound() : null, resolving: !!(ROUND && ROUND.resolving), treasury: pubTreasury(), history: db.history.slice(0, +(qs.get('n') || 12)), leaderboard: leaderboard(), stats: db.stats });
  if (req.method === 'POST') {
    const d = await body(req);
    if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'connect a wallet first (0x…)' });
    if (u === '/api/account') return json(res, 200, pubAccount(d.wallet));
    if (u === '/api/deploy') { const r = deploy(d.wallet, d.square, d.amount); return json(res, 200, r); }
  }
  let f = u === '/' ? '/landing.html' : u === '/mine' ? '/index.html' : (u === '/docs' || u === '/docs/') ? '/docs.html' : u;
  f = path.normalize(f).replace(/^([.\\/])+/, '');
  const fp = path.join(CLIENT, f);
  if (!fp.startsWith(CLIENT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- WS upgrade ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']; if (!key) return socket.destroy();
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '
    + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  socks.add(socket);
  socket.on('close', () => socks.delete(socket));
  socket.on('error', () => socks.delete(socket));
  socket.on('data', () => {});
  try { socket.write(frame(JSON.stringify({ type: 'hello', round: ROUND && !ROUND.resolving ? pubRound() : null, treasury: pubTreasury() }))); } catch (e) {}
});

newRound();
server.listen(PORT, () => console.log('LODE board live on :' + PORT + ' — round ' + db.roundId + ' · supply ' + db.supply + '/' + MAX_SUPPLY + ' · open beta, no custody'));
