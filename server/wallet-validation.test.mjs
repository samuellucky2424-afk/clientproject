import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isValidWalletAddress as valid} from '../flashlab-homepage/wallet-validation.mjs';

const evm = '0xde709f2102306220921060314715629080e2fb77';
const cases = [
  ['USDT', 'Tron (TRC20)', 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7'],
  ['USDT', 'Ethereum (ERC20)', evm],
  ['USDT', 'BNB Smart Chain (BEP20)', evm],
  ['BTC', 'Bitcoin', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'],
  ['ETH', 'Ethereum', evm],
  ['USDC', 'Ethereum', evm],
  ['USDC', 'Solana', 'So11111111111111111111111111111111111111112'],
  ['USDC', 'Base', evm],
  ['BNB', 'BNB Smart Chain', evm],
  ['SOL', 'Solana', 'So11111111111111111111111111111111111111112'],
  ['LTC', 'Litecoin', 'LKKG9A9a8n7CeHK8Nk7RdNZiCuHZW2U789'],
  ['DOGE', 'Dogecoin', 'D5EQRCnPMXmRvUoZwC7gu7fYspean3PQ9a'],
  ['XRP', 'XRP Ledger', 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'],
];
for (const [coin, network, address] of cases) {
  test(`${coin} on ${network}: valid address and random input`, () => {
    assert.equal(valid(address, coin, network), true);
    assert.equal(valid(`  ${address}  `, coin, network), true);
    for (const bad of ['', 'hello123', '0x72848383', '123456789', null])
      assert.equal(valid(bad, coin, network), false);
  });
}
test('rejects wrong networks and checksum errors', () => {
  assert.equal(valid(evm, 'USDT', 'Tron (TRC20)'), false);
  assert.equal(valid(evm, 'BTC', 'Bitcoin'), false);
  assert.equal(valid(evm, 'ETH', 'Solana'), false);
  assert.equal(valid('1BoatSLRHtKNngkdXEeobR76b53LETtpyU', 'BTC', 'Bitcoin'), false);
  assert.equal(valid('0x52908400098527886E0F7030069857D2E4169Ee7', 'ETH', 'Ethereum'), false);
  assert.equal(valid('TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU8', 'USDT', 'Tron (TRC20)'), false);
});
