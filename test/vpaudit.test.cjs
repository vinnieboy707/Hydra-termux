'use strict';
// The VP's audit: your checks, then Blockscout as the independent witness (chain head, your contract, every wallet,
// what the executor sent, every recorded profit as a successful receipt), then the next step reassessed. The
// Blockscout stand-in answers in the exact shapes the Arbitrum deployment returned on 2026-11-25. Real counterpart:
// chronos verify-real check 'blockscout-witness' asks the real arbitrum.blockscout.com and compares it with your node.
const test = require('node:test');
const assert = require('node:assert');
const { Blockscout, baseUrl } = require('../lib/blockscout.cjs');
const { audit } = require('../lib/vpaudit.cjs');

const C = '0x' + 'c1'.repeat(20), X = '0x' + 'e1'.repeat(20), O = '0x' + 'a1'.repeat(20), P = '0x' + 'b1'.repeat(20), EVIL = '0x' + 'ee'.repeat(20);
const H1 = '0x' + '11'.repeat(32), H2 = '0x' + '22'.repeat(32);
function world({ creator = O, sends = null, txs = null } = {}) {
  const addr = { [C]: { is_contract: true, is_verified: true, coin_balance: '0', creator_address_hash: creator, creation_transaction_hash: '0xabc', creation_status: 'success', block_number_balance_updated_at: 1000 },
    [X]: { is_contract: false, coin_balance: '5000000000000000', block_number_balance_updated_at: 1000 }, [O]: { is_contract: false, coin_balance: '5000000000000000', block_number_balance_updated_at: 1000 },
    [P]: { is_contract: false, coin_balance: '7', block_number_balance_updated_at: 1000 } };
  const tx = txs || { [H1]: { hash: H1, status: 'ok', result: 'success', block_number: 990, from: { hash: X }, to: { hash: C }, fee: { value: '1000' } } };
  const fetchImpl = async (u) => {
    const url = new URL(u); const p = url.pathname;
    let body = null;
    if (p === '/api/v2/blocks') body = { items: [{ height: 1010 }] };
    else if (/^\/api\/v2\/addresses\/0x[0-9a-f]{40}\/transactions$/.test(p)) body = { items: sends || [{ hash: H1, status: 'ok', block_number: 990, from: { hash: X }, to: { hash: C }, fee: { value: '1000' } }] };
    else if (/^\/api\/v2\/addresses\//.test(p)) body = addr[p.split('/').pop().toLowerCase()] || null;
    else if (/^\/api\/v2\/transactions\//.test(p)) body = tx[p.split('/').pop()] || null;
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => ({}) };
  };
  return new Blockscout('https://bs.example', { fetchImpl });
}
const node = (bal = {}) => ({ getBlockNumber: async () => 1008, getBalance: async (a) => BigInt(bal[a.toLowerCase()] ?? { [X]: '5000000000000000', [O]: '5000000000000000', [P]: '7' }[a.toLowerCase()] ?? 0) });
const env = (o) => (k) => ({ CHRONOS_FLASH_ARB_ADDRESS: C, CHRONOS_EXECUTOR_ADDRESS: X, PAYOUT_WALLET_ADDRESS: P, ...o })[k];
const road = [{ step: 1, id: 'engine', title: 'engine', done: true, owner: 'chronos' }, { step: 2, id: 'contract-v2', title: 'Contract v2 deployed and yours', done: false, owner: 'you', todo: 'chronos mainnet' }];
const rc = (fail = []) => async () => ({ results: [{ id: 'rpc-is-arbitrum', status: 'pass' }, ...fail.map((id) => ({ id, status: 'fail' }))] });

test('a healthy system: every check passes and the next step is the road\'s', async () => {
  const a = await audit({ get: env({}), provider: node(), bs: world(), owner: O, realized: { executions: [{ txHash: H1, netUsd: 1.2 }] }, verifyReal: rc(), road, after: ['research'] });
  const s = Object.fromEntries(a.checks.map((c) => [c.id, c.status]));
  assert.deepStrictEqual(s, { 'real-checks': 'pass', 'chain-head': 'pass', 'contract-on-chain': 'pass', wallets: 'pass', 'executor-sends': 'pass', 'profits-confirmed': 'pass' });
  assert.strictEqual(a.fail, 0); assert.deepStrictEqual([a.next.step, a.next.owner], [2, 'you']);
  assert.match(a.line, /Audit after research: 6 pass, 0 fail, 0 warn .* NEXT step 2 \(yours\): Contract v2 deployed and yours/);
});

test('a recorded profit Blockscout does not confirm is a failure, and fixing it becomes the next step', async () => {
  const bs = world({ txs: { [H1]: { hash: H1, status: 'error', result: 'execution reverted', block_number: 990, from: { hash: X }, to: { hash: C }, fee: { value: '1' } } } });
  const a = await audit({ get: env({}), provider: node(), bs, owner: O, realized: { executions: [{ txHash: H1 }, { txHash: H2 }] }, verifyReal: rc(), road });
  const p = a.checks.find((c) => c.id === 'profits-confirmed');
  assert.strictEqual(p.status, 'fail'); assert.match(p.detail, /2 of 2 .*execution reverted.*unknown to Blockscout/);
  assert.strictEqual(a.next.title, 'Fix what the audit found');
});

test('the executor sending anywhere but your contract fails loudly; a contract not created by your owner fails', async () => {
  const a = await audit({ get: env({}), provider: node(), bs: world({ creator: EVIL, sends: [{ hash: H2, status: 'ok', from: { hash: X }, to: { hash: EVIL }, fee: { value: '5' } }] }), owner: O, verifyReal: rc(), road });
  assert.match(a.checks.find((c) => c.id === 'executor-sends').detail, /NOT your contract/); assert.strictEqual(a.checks.find((c) => c.id === 'executor-sends').status, 'fail');
  assert.match(a.checks.find((c) => c.id === 'contract-on-chain').detail, /NOT your owner wallet/);
  assert.strictEqual(a.next.owner, 'you');
});

test('node and Blockscout disagree on a balance, or the node lags: shown as a warning with both numbers', async () => {
  const a = await audit({ get: env({}), provider: { getBlockNumber: async () => 900, getBalance: async () => 1n }, bs: world(), owner: O, verifyReal: rc(), road });
  assert.match(a.checks.find((c) => c.id === 'chain-head').detail, /110 blocks behind/);
  assert.match(a.checks.find((c) => c.id === 'wallets').detail, /node 0\.00000 ETH vs Blockscout 0\.00500 ETH/);
});

test('your own failing real checks fail the audit; Blockscout off is said, never silently skipped', async () => {
  const a = await audit({ get: env({ CHRONOS_FLASH_ARB_ADDRESS: '' }), provider: node(), bs: null, verifyReal: rc(['multicall3']), road });
  assert.strictEqual(a.checks.find((c) => c.id === 'real-checks').status, 'fail');
  assert.match(a.checks.find((c) => c.id === 'blockscout').detail, /nothing confirms the engine from outside/);
  assert.strictEqual(baseUrl((k) => ({ CHRONOS_BLOCKSCOUT_URL: 'off' })[k]), null);
  assert.strictEqual(baseUrl(() => undefined), 'https://arbitrum.blockscout.com');
});
