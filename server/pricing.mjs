import { priceIds, calculateFee } from './catalog.mjs';
export { calculateFee };
export function createPricing(env, request=fetch) {
 const prices=new Map(); let fx;
 async function crypto(coin,amount,feePercent=1){
  let p=prices.get(coin);
  if(!p||Date.now()-p.cachedAt>60000){
   const r=await request(`https://api.coingecko.com/api/v3/simple/price?ids=${priceIds[coin]}&vs_currencies=usd&include_last_updated_at=true`,{headers:env.COINGECKO_API_KEY?{'x-cg-demo-api-key':env.COINGECKO_API_KEY}:{},signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Crypto USD pricing is unavailable. Try again.');
   const data=(await r.json())[priceIds[coin]];
   if(!data||!Number.isFinite(data.usd)||data.usd<=0||!Number.isFinite(data.last_updated_at)||Date.now()-data.last_updated_at*1000>300000||data.last_updated_at*1000>Date.now()+60000)throw Error('Fresh crypto USD pricing is unavailable.');
   p={rate:data.usd,updatedAt:new Date(data.last_updated_at*1000).toISOString(),cachedAt:Date.now()};prices.set(coin,p);
  }
  return {...calculateFee(amount,p.rate,feePercent),usdRate:p.rate,priceTimestamp:p.updatedAt};
 }
 async function deposit(ngnKobo){
  if(!fx||Date.now()-fx.cachedAt>3600000){
   const r=await request('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Currency conversion is temporarily unavailable.');
   const d=await r.json();
   if(d.result!=='success'||d.base_code!=='USD'||!Number.isFinite(d.rates?.NGN)||d.rates.NGN<=0||!Number.isFinite(d.time_last_update_unix)||Date.now()-d.time_last_update_unix*1000>172800000||d.time_last_update_unix*1000>Date.now()+60000)throw Error('A recent NGN/USD exchange rate is unavailable.');
   fx={rate:d.rates.NGN,updatedAt:new Date(d.time_last_update_unix*1000).toISOString(),cachedAt:Date.now()};
  }
  const usdCents=Math.floor(ngnKobo/fx.rate);
  if(!Number.isSafeInteger(usdCents)||usdCents<1)throw Error('Deposit must credit at least $0.01.');
  return {usdCents,rate:fx.rate,updatedAt:fx.updatedAt};
 }
 return {crypto,deposit};
}
