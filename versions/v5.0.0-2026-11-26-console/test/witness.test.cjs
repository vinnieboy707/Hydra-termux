'use strict';
// The independent-witness check (2.9.15): Blockscout first, Etherscan V2 (your key) when Blockscout does not answer.
// Only YOUR node falling behind fails; a witness indexing a little behind is normal. The explorers are played by
// fakeExplorer; their real counterparts are arbitrum.blockscout.com and api.etherscan.io, run by chronos verify-real
// (blockscout-witness).
const test = require('node:test');
const assert = require('node:assert');
const { CHECKS } = require('../lib/realcheck.cjs');
const C = '0x31837899Aa8e17a5EF802A17e86149216545D076';

function fakeExplorer({ bsHead = null, bsDown = false, esHead = null, code = '0x6080' } = {}) {
  return async (url) => {
    const j = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o });
    if (url.includes('blockscout')) {
      if (bsDown) return j({ message: 'API key required' }, 401);
      if (url.includes('/api/v2/blocks')) return j({ items: [{ height: bsHead }] });
      if (url.includes('/api/v2/addresses/')) return j({ is_contract: true, is_verified: false });
    }
    if (url.includes('api.etherscan.io')) {
      if (url.includes('eth_blockNumber')) return j({ jsonrpc: '2.0', id: 1, result: '0x' + esHead.toString(16) });
      if (url.includes('eth_getCode')) return j({ jsonrpc: '2.0', id: 1, result: code });
    }
    return j({}, 404);
  };
}
const ctx = (mine, fetchImpl, env = {}) => ({ get: (k) => ({ CHRONOS_FLASH_ARB_ADDRESS: C, ...env })[k], provider: async () => ({ getBlockNumber: async () => mine }), fetchImpl });
const run = (x) => CHECKS['blockscout-witness'].run(x);

test('Blockscout indexing behind your node is normal (it failed verify-real before 2.9.15); your node behind fails', async () => {
  const ok = await run(ctx(1000, fakeExplorer({ bsHead: 900 })));
  assert.strictEqual(ok.status, 'pass', ok.detail); assert.match(ok.detail, /indexes 100 blocks behind your node: normal/);
  const stale = await run(ctx(1000, fakeExplorer({ bsHead: 1500 })));
  assert.strictEqual(stale.status, 'fail'); assert.match(stale.detail, /your node is 500 blocks behind Blockscout/);
});

test('Blockscout asking for a key: Etherscan with your key is the witness; without one, the fix is named', async () => {
  const es = await run(ctx(1000, fakeExplorer({ bsDown: true, esHead: 1001 }), { ETHERSCAN_API_KEY: 'K'.repeat(34) }));
  assert.strictEqual(es.status, 'pass', es.detail); assert.match(es.detail, /^Etherscan block 1001/); assert.match(es.detail, /Blockscout: Blockscout HTTP 401/);
  const none = await run(ctx(1000, fakeExplorer({ bsDown: true })));
  assert.strictEqual(none.status, 'fail'); assert.match(none.detail, /chronos set ETHERSCAN_API_KEY/);
  const gone = await run(ctx(1000, fakeExplorer({ bsDown: true, esHead: 1000, code: '0x' }), { ETHERSCAN_API_KEY: 'K'.repeat(34) }));
  assert.strictEqual(gone.status, 'fail'); assert.match(gone.detail, /does not see a contract/);
});
