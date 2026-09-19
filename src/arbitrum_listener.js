const { ethers } = require("ethers");
const { Pool } = require("pg");
const CHAIN_ID = 42161;
const RPC = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || 3);
const POLL_MS = Number(process.env.POLL_MS || 2500);
const LOOKBACK = Number(process.env.LOOKBACK_BLOCKS || 20);
const DEFAULT_TOKENS = {
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": { symbol: "USDT", decimals: 6 },
};
const TOKENS = process.env.ERC20_TOKENS ? JSON.parse(process.env.ERC20_TOKENS) : DEFAULT_TOKENS;
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
async function loadWatch(client) {
  const { rows } = await client.query(`SELECT id, LOWER(crypto_address) AS addr FROM users WHERE crypto_address IS NOT NULL`);
  const map = new Map();
  for (const r of rows) map.set(r.addr, r.id);
  return map;
}
async function credit(p) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const { rows } = await client.query(
      `SELECT credit_deposit($1::bigint, $2::asset_type, $3, $4::numeric, 'ARBITRUM_L2'::channel, $5, $5, $6, $7, $8, $9, $10::jsonb) AS tx_id`,
      [p.userId, p.asset, p.token, p.amount, p.txHash, p.from, p.to, p.block, p.logIndex, JSON.stringify(p.extra || {})]
    );
    await client.query("COMMIT");
    return rows[0]?.tx_id;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return null;
    throw err;
  } finally { client.release(); }
}
async function tick() {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing"); return; }
  const client = await pool.connect();
  try {
    const watch = await loadWatch(client);
    const { rows } = await client.query(`SELECT last_block FROM chain_sync WHERE id = 1`);
    const last = Number(rows[0]?.last_block || 0);
    const head = await provider.getBlockNumber();
    const safeHead = head - CONFIRMATIONS;
    const from = last > 0 ? Math.max(0, last + 1 - LOOKBACK) : Math.max(0, safeHead - LOOKBACK);
    if (from > safeHead) return;
    const logs = await provider.getLogs({ fromBlock: from, toBlock: safeHead, address: Object.keys(TOKENS), topics: [TRANSFER_TOPIC] });
    for (const log of logs) {
      const meta = TOKENS[log.address.toLowerCase()];
      if (!meta) continue;
      const to = ("0x" + log.topics[2].slice(26)).toLowerCase();
      const userId = watch.get(to);
      if (!userId) continue;
      const amount = ethers.formatUnits(ethers.toBigInt(log.data), meta.decimals);
      await credit({ userId, asset: "ERC20", token: log.address.toLowerCase(), amount, txHash: log.transactionHash, from: "0x" + log.topics[1].slice(26), to, block: log.blockNumber, logIndex: log.index, extra: { symbol: meta.symbol } });
    }
    await client.query(`UPDATE chain_sync SET last_block = $1, updated_at = NOW() WHERE id = 1`, [safeHead]);
  } finally { client.release(); }
}
async function main() {
  console.log("[LISTENER] Arbitrum ETH+ERC20", RPC);
  setInterval(() => tick().catch((e) => console.error(e.message)), POLL_MS);
  await tick();
}
if (require.main === module) main();
module.exports = { tick };
