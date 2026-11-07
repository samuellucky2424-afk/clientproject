import {timingSafeEqual} from 'node:crypto';
export const sameSecret=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length>0&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function cents(value){
 if(!['number','string'].includes(typeof value)||!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('Enter an amount with at most two decimal places.');
 const result=Math.round(Number(value)*100);if(!Number.isSafeInteger(result)||result<=0)throw Error('Invalid amount');return result;
}
export function verifyPayment(tx,deposit){
 if(tx.status!=='successful'||tx.tx_ref!==deposit.tx_ref||tx.currency!=='NGN'||!/^\d+$/.test(String(tx.id))||cents(tx.amount)!==Number(deposit.ngn_kobo))throw Error('Payment details do not match this deposit. No balance was credited.');
}
export function createFlutterwave(env,store,request=fetch){
 async function verify(id,userId,expectedRef){
  if(!/^\d{1,24}$/.test(String(id)))throw Error('Invalid payment reference');
  const r=await request(`https://api.flutterwave.com/v3/transactions/${id}/verify`,{headers:{Authorization:`Bearer ${env.FLW_SECRET_KEY}`},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Flutterwave verification is unavailable. Retry shortly.');
  const data=await r.json();if(data.status!=='success'||!data.data)throw Error('Payment has not been verified.');
  const tx=data.data;
  if(String(tx.id)!==String(id))throw Error('Payment ID mismatch');
  const d=await store.one('prank_deposits',{tx_ref:tx.tx_ref});
  if(!d||(userId&&d.user_id!==userId)||(expectedRef&&d.tx_ref!==expectedRef))throw Error('Deposit not found');
  verifyPayment(tx,d);
  return store.rpc('prank_credit_deposit',{p_ref:d.tx_ref,p_provider_id:String(tx.id),p_ngn_kobo:cents(tx.amount)});
 }
 async function checkout(d,user){
  const r=await request('https://api.flutterwave.com/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${env.FLW_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({tx_ref:d.tx_ref,amount:(Number(d.ngn_kobo)/100).toFixed(2),currency:'NGN',redirect_url:`${env.APP_ORIGIN}/dashboard?deposit_return=1`,customer:{email:user.email},customizations:{title:'2winprankz wallet funding',description:'Service credits for fictional entertainment previews'},link_expiration:new Date(Date.now()+3600000).toISOString()}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Unable to start Flutterwave checkout. Retry shortly.');
  const data=await r.json();const link=data.data?.link;
  if(data.status!=='success'||!link||new URL(link).protocol!=='https:'||!['checkout.flutterwave.com','flutterwave.com'].includes(new URL(link).hostname))throw Error('Invalid checkout response');
  await store.update('prank_deposits',{id:d.id,state:'pending'},{checkout_url:link});return link;
 }
 return {verify,checkout};
}
