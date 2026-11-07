export const platforms = { Binance: ['binance','#f0b90b'], Coinbase:['coinbase','#0879ed'], 'Trust Wallet':['trust-wallet','#3375ee'], Bybit:['bybit','#f7a600'] };
export const networks={USDT:['Tron (TRC20)','Ethereum (ERC20)','BNB Smart Chain (BEP20)'],BTC:['Bitcoin'],ETH:['Ethereum'],USDC:['Ethereum','Solana','Base'],BNB:['BNB Smart Chain'],SOL:['Solana'],LTC:['Litecoin'],DOGE:['Dogecoin'],XRP:['XRP Ledger']};
export const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const priceIds={USDT:'tether',BTC:'bitcoin',ETH:'ethereum',USDC:'usd-coin',BNB:'binancecoin',SOL:'solana',LTC:'litecoin',DOGE:'dogecoin',XRP:'ripple'};
export function calculateFee(amount, rate) {
 const usdCents=Math.round(Number(amount)*rate*100);
 const feeCents=Math.round(usdCents/100);
 if(!Number.isSafeInteger(usdCents)||usdCents<=0||feeCents<1)throw Error('Amount is too small to charge a 1% fee rounded to cents.');
 return {usdValue:usdCents/100,fee:feeCents/100,feePercent:1};
}
