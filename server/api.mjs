import {randomUUID} from 'node:crypto';
import {createStore} from './store.mjs';
import {createPricing} from './pricing.mjs';
import {createFlutterwave,sameSecret,cents} from './flutterwave.mjs';
import {platforms,networks} from './catalog.mjs';
import {buildEmail} from './email.mjs';
export {calculateFee} from './catalog.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function transferView(t){return {id:t.id,platform:t.platform,coin:t.coin,network:t.network,amount:String(t.amount),address:t.address,email:t.email,usdValue:Number(t.usd_cents)/100,fee:Number(t.fee_cents)/100,feePercent:1,usdRate:Number(t.usd_rate),priceTimestamp:t.price_timestamp,expires:Date.parse(t.expires_at),state:t.state,timestamp:t.confirmed_at||t.created_at};}
export function depositView(d){return {id:d.id,ngnAmount:Number(d.ngn_kobo)/100,usdCredit:Number(d.usd_cents)/100,rate:Number(d.fx_rate),rateTimestamp:d.fx_timestamp,expires:d.expires_at,state:d.state,reference:d.tx_ref};}
export function createApi(env,dependencies={}){
 let store=dependencies.store;
 const pricing=dependencies.pricing||createPricing(env);
 const request=dependencies.request||fetch;
 const configured=()=>Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&env.SUPABASE_PUBLISHABLE_KEY);
 return async(req,res,next)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/api/'))return next();
  const reply=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  try{
   if(req.method==='GET'&&url.pathname==='/api/config')return reply(200,{supabaseUrl:env.SUPABASE_URL||'',supabaseKey:env.SUPABASE_PUBLISHABLE_KEY||'',configured:Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY)});
   if(!configured())throw fail('Backend is not configured. See BACKEND_SETUP.md.',503);
   store ||= createStore(env);
   const flw=createFlutterwave(env,store,request);
   if(req.method==='POST'&&url.pathname==='/api/webhooks/flutterwave'){
    if(!env.FLW_SECRET_KEY||!sameSecret(req.headers['verif-hash'],env.FLW_WEBHOOK_SECRET))throw fail('Invalid webhook signature',401);
    const body=await readBody(req,65536);
    if(body.event!=='charge.completed')return reply(200,{received:true});
    try{await flw.verify(body.data?.id);}catch(error){console.error('Payment webhook verification failed:',error.message);throw fail('Payment not verified; retry notification.',503);}
    return reply(200,{received:true});
   }
   if(!['GET','POST'].includes(req.method))throw fail('Method not allowed',405);
   if(req.headers.origin&&req.headers.origin!==env.APP_ORIGIN)throw fail('Origin rejected',403);
   const token=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1];
   if(!token)throw fail('Please sign in.',401);
   const user=await store.user(token);if(!user)throw fail('Please sign in with a confirmed email address.',401);
   const limited=await store.rpc('prank_rate_limit',{p_key:`${user.id}:${req.method}`,p_limit:req.method==='GET'?120:30,p_seconds:60});
   if(!limited)throw fail('Too many requests. Try again in a minute.',429);
   if(req.method==='GET'&&url.pathname==='/api/wallet')return reply(200,{balance:Number((await store.wallet(user.id)).balance_cents)/100,currency:'USD',depositCurrency:'NGN',feePercent:1,email:user.email});
   if(req.method==='GET'&&url.pathname==='/api/history'){
    const [ledger,deposits,transfers]=await Promise.all([store.rows('prank_ledger',{user_id:user.id}),store.rows('prank_deposits',{user_id:user.id}),store.rows('prank_transfers',{user_id:user.id})]);
    return reply(200,{ledger,deposits:deposits.map(depositView),transfers:transfers.map(transferView)});
   }
   if(req.method==='GET'&&url.pathname.startsWith('/api/transfers/')){
    const id=url.pathname.split('/').pop();if(!uuid(id))throw fail('Invalid transfer ID');
    const t=await store.one('prank_transfers',{id,user_id:user.id});if(!t)throw fail('Preview not found',404);
    return reply(200,{...transferView(t),balance:Number((await store.wallet(user.id)).balance_cents)/100});
   }
   if(req.method!=='POST')throw fail('Not found',404);
   const body=await readBody(req);
   if(url.pathname==='/api/deposits/quote'){
    if(!env.FLW_SECRET_KEY||!env.FLW_WEBHOOK_SECRET||!env.APP_ORIGIN)throw fail('Flutterwave deposits are not configured.',503);
    if(!uuid(body.requestKey))throw fail('Missing request key');
    const existing=await store.one('prank_deposits',{user_id:user.id,request_key:body.requestKey});if(existing)return reply(200,depositView(existing));
    const ngnKobo=cents(body.amount);
    if(ngnKobo<10000||ngnKobo>100000000)throw fail('Deposit must be between NGN 100 and NGN 1,000,000.');
    const fx=await pricing.deposit(ngnKobo);
    const d=await store.insert('prank_deposits',{user_id:user.id,request_key:body.requestKey,tx_ref:`prank-${randomUUID()}`,ngn_kobo:ngnKobo,usd_cents:fx.usdCents,fx_rate:fx.rate,fx_timestamp:fx.updatedAt,expires_at:new Date(Date.now()+600000).toISOString()});
    return reply(200,depositView(d));
   }
   if(url.pathname==='/api/deposits/checkout'){
    if(!env.FLW_SECRET_KEY)throw fail('Flutterwave is not configured.',503);
    if(!uuid(body.id))throw fail('Invalid deposit ID');
    const d=await store.one('prank_deposits',{id:body.id,user_id:user.id});if(!d)throw fail('Deposit not found',404);
    if(d.state==='credited')throw fail('Deposit has already been credited.',409);
    if(d.checkout_url)return reply(200,{url:d.checkout_url});
    if(Date.parse(d.expires_at)<Date.now())throw fail('Deposit quote expired. Enter the amount again.',409);
    if(d.state!=='quoted')throw fail('Checkout is already being prepared. If no checkout opened, create a new deposit quote.',409);
    const claimed=await store.update('prank_deposits',{id:d.id,state:'quoted'},{state:'pending'});
    if(!claimed.length)throw fail('Checkout is already being prepared.',409);
    return reply(200,{url:await flw.checkout(d,user)});
   }
   if(url.pathname==='/api/deposits/verify'){
    if(!env.FLW_SECRET_KEY)throw fail('Flutterwave is not configured.',503);
    if(typeof body.reference!=='string'||body.reference.length>100)throw fail('Invalid deposit reference');
    return reply(200,await flw.verify(body.transactionId,user.id,body.reference));
   }
   if(url.pathname==='/api/transfers/preview'){
    if(!env.RESEND_API_KEY||!env.RESEND_FROM)throw fail('Email delivery is not configured.',503);
    if(!uuid(body.requestKey))throw fail('Missing request key');
    const existing=await store.one('prank_transfers',{user_id:user.id,request_key:body.requestKey});if(existing)return reply(200,transferView(existing));
    if(!Object.hasOwn(platforms,body.platform)||!Object.hasOwn(networks,body.coin)||!networks[body.coin].includes(body.network)||!['string','number'].includes(typeof body.amount)||!Number.isFinite(Number(body.amount))||Number(body.amount)<=0||Number(body.amount)>1e9||typeof body.address!=='string'||!body.address.trim()||body.address.length>150||typeof body.email!=='string'||body.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))throw fail('Check the transfer details.');
    const p=await pricing.crypto(body.coin,body.amount);
    const t=await store.insert('prank_transfers',{user_id:user.id,request_key:body.requestKey,platform:body.platform,coin:body.coin,amount:String(body.amount),network:body.network,address:body.address.trim(),email:body.email,usd_cents:Math.round(p.usdValue*100),fee_cents:Math.round(p.fee*100),usd_rate:p.usdRate,price_timestamp:p.priceTimestamp,expires_at:new Date(Date.now()+120000).toISOString()});
    return reply(200,transferView(t));
   }
   if(url.pathname==='/api/transfers/confirm'){
    if(!uuid(body.id))throw fail('Invalid preview ID');
    const t=await store.one('prank_transfers',{id:body.id,user_id:user.id});if(!t)throw fail('Preview not found',404);
    const payload=await buildEmail(env,t);
    const confirmed=await store.rpc('prank_confirm_transfer',{p_user:user.id,p_id:t.id,p_payload:payload});
    return reply(200,{...transferView(confirmed),balance:Number((await store.wallet(user.id)).balance_cents)/100});
   }
   throw fail('Not found',404);
  }catch(error){if(!res.writableEnded)reply(error.status||400,{error:error.message||'Request failed'});}
 };
}
async function readBody(req,max=8192){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('Expected JSON',415);
 // Vercel may have parsed the JSON stream before invoking the Node handler.
 if(req.body!==undefined){
  let data=req.body;
  try{if(typeof data==='string'||Buffer.isBuffer(data))data=JSON.parse(String(data));}catch{throw fail('Invalid JSON');}
  if(!data||Array.isArray(data)||typeof data!=='object')throw fail('Invalid JSON');
  if(Buffer.byteLength(JSON.stringify(data))>max)throw fail('Request too large',413);
  return data;
 }
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw fail('Request too large',413);chunks.push(chunk);}
 try{const data=JSON.parse(Buffer.concat(chunks).toString());if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{throw fail('Invalid JSON');}
}
