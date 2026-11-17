import validator from 'multicoin-address-validator/dist/wallet-address-validator.js';
import baseX from 'base-x';

const base58 = baseX('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
const networks = {
  USDT: {'Tron (TRC20)': 'trx', 'Ethereum (ERC20)': 'eth', 'BNB Smart Chain (BEP20)': 'eth'},
  BTC: {Bitcoin: 'btc'},
  ETH: {Ethereum: 'eth'},
  USDC: {Ethereum: 'eth', Solana: 'sol', Base: 'eth'},
  BNB: {'BNB Smart Chain': 'eth'},
  SOL: {Solana: 'sol'},
  LTC: {Litecoin: 'ltc'},
  DOGE: {Dogecoin: 'doge'},
  XRP: {'XRP Ledger': 'xrp'},
};

// Validate mainnet address encoding, not ownership, balance or token support.
export function isValidWalletAddress(address, coin, network) {
  if (typeof address !== 'string' || address.length > 150) return false;
  const value = address.trim();
  const chain = Object.hasOwn(networks, coin) && Object.hasOwn(networks[coin], network)
    ? networks[coin][network] : null;
  if (!chain || !value) return false;
  try {
    if (chain === 'sol') return base58.decode(value).length === 32;
    return validator.validate(value, chain, 'prod') === true;
  } catch {
    return false;
  }
}

export function walletAddressError(coin, network) {
  return `This is not a valid wallet address for ${coin} on ${network}. Check the address and selected network.`;
}
