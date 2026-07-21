# LODE ⛏

**Deploy. Mine. Strike the motherlode.** A faithful port of the open-source ORE board
game design (regolith-labs/ore) to Robinhood Chain.

**Live:** [lodeminer.xyz](https://lodeminer.xyz) · **X:** [@LodeMinerRH](https://x.com/LodeMinerRH)

- **The board** — 25 squares, one round every 60 seconds. Deploy ETH on a square; a
  commit-reveal RNG picks one winner. Winners take their stake back + the losers' pot
  (−1% protocol fee, −10% vault cut), split pro-rata.
- **The emission** — +1 $LODE per round to a **5,000,000 hard cap**; 50/50 split among the
  winning square or solo to a deployment-weighted top miner.
- **The motherlode** — +0.2 $LODE accrues per round; pays the whole pool on 1-in-500 odds.
- **Provably fair** — each round's RNG secret is committed (sha256) before mining opens
  and revealed at resolution; anyone can verify no re-rolls.
- **The vault** — fees + vault cuts fund buy-and-bury once $LODE trades.

## Status

**Simulated ledger.** Every wallet starts with 0.1 ETH of play balance — no
deposits, no custody, no promised returns.

## Run

```
node server/index.js     # port 8158
```

Dependency-free Node (>= 18). Env: `PORT`, `DATA_PATH`, `LODE_MINT` (enables the live
DexScreener price), `ROUND_SEC`, `BREAK_SEC`, `SEED_ETH`.
