import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createApi,calculateFee} from './api.mjs';
import {verifyPayment,sameSecret,cents} from './flutterwave.mjs';
import {processEmail} from './email.mjs';
import {createPricing} from './pricing.mjs';

test('payment, database and API integration',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(await readFile('database/schema.sql','utf8'));
 const u1=randomUUID(),u2=randomUUID();await db.query('insert into auth.users values($1),($2)',[u1,u2]);
 const rpc=async(name,args={})=>(await db.query(`select public.${name}(${Object.keys(args).map((_,i)=>'$'+(i+1)).join(',')}) as result`,Object.values(args))).rows[0].result;
 const conditions=filters=>Object.keys(filters).map((k,i)=>`${k}=$${i+1}`).join(' and ');
 const store={
  user:async token=>token==='alice'?{id:u1,email:'alice@example.com'}:token==='bob'?{id:u2,email:'bob@example.com'}:null,
  one:async(table,filters)=>(await db.query(`select * from ${table} where ${conditions(filters)}`,Object.values(filters))).rows[0]||null,
  insert:async(table,body)=>(await db.query(`insert into ${table}(${Object.keys(body)}) values(${Object.keys(body).map((_,i)=>'$'+(i+1))}) returning *`,Object.values(body))).rows[0],
  update:async(table,filters,body)=>{const n=Object.keys(filters).length;return (await db.query(`update ${table} set ${Object.keys(body).map((k,i)=>`${k}=$${i+n+1}`)} where ${conditions(filters)} returning *`,[...Object.values(filters),...Object.values(body)])).rows;},
  rows:async(table,filters)=>(await db.query(`select * from ${table} where ${conditions(filters)}`,Object.values(filters))).rows,
  wallet:async userId=>{await db.query('insert into prank_wallets(user_id) values($1) on conflict do nothing',[userId]);return store.one('prank_wallets',{user_id:userId});},rpc
 };
 const env={APP_ORIGIN:'http://localhost',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'secret',SUPABASE_PUBLISHABLE_KEY:'public',FLW_SECRET_KEY:'flutterwave-test',FLW_WEBHOOK_SECRET:'webhook-test',RESEND_API_KEY:'resend-test',RESEND_FROM:'2winprankz <previews@example.com>'};
 let payment,checkoutCalls=0;
 const request=async(url,options)=>{
  if(url.endsWith('/payments')){checkoutCalls++;return {ok:true,json:async()=>({status:'success',data:{link:'https://checkout.flutterwave.com/v3/hosted/pay/test'}})};}
  if(url.includes('/verify'))return {ok:true,json:async()=>({status:'success',data:payment})};
  throw Error('Unexpected external request');
 };
 const pricing={deposit:async kobo=>({usdCents:Math.floor(kobo/1500),rate:1500,updatedAt:new Date().toISOString()}),crypto:async(coin,amount)=>({...calculateFee(amount,4000),usdRate:4000,priceTimestamp:new Date().toISOString()})};
 const api=createApi(env,{store,pricing,request});
 const server=createServer((req,res)=>api(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function call(path,body,token='alice',headers={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{
  await t.test('server computes 1% and rounds cents',()=>{assert.equal(calculateFee(1000,1).fee,10);assert.equal(calculateFee(2000,1).fee,20);assert.equal(calculateFee(1000.55,1).fee,10.01);assert.throws(()=>calculateFee(.01,1));assert.equal(cents('15000.25'),1500025);assert.throws(()=>cents('1.001'));});
  await t.test('auth, origin and public configuration',async()=>{assert.equal((await call('/api/wallet',undefined,null)).status,401);assert.equal((await call('/api/wallet',undefined,'bad')).status,401);assert.equal((await call('/api/wallet',undefined,'alice',{Origin:'https://evil.test'})).status,403);const config=await call('/api/config',undefined,null);assert.equal(config.data.supabaseKey,'public');assert.equal(JSON.stringify(config.data).includes('secret'),false);});
  let deposit;
  await t.test('deposit quote and checkout do not credit money',async()=>{const key=randomUUID();const q=await call('/api/deposits/quote',{amount:'15000',requestKey:key,usdCredit:9999});assert.equal(q.status,200);deposit=q.data;assert.equal(deposit.usdCredit,10);assert.equal((await call('/api/wallet')).data.balance,0);assert.equal((await call('/api/deposits/quote',{amount:'15000',requestKey:key})).data.id,deposit.id);assert.equal((await call('/api/deposits/checkout',{id:deposit.id},'bob')).status,404);assert.equal((await call('/api/deposits/checkout',{id:deposit.id})).status,200);assert.equal((await call('/api/deposits/checkout',{id:deposit.id})).status,200);assert.equal(checkoutCalls,1);});
  await t.test('forged, underpaid and cross-account payments never credit',async()=>{payment={id:123,tx_ref:deposit.reference,currency:'NGN',amount:14999,status:'successful'};assert.equal((await call('/api/deposits/verify',{transactionId:123,reference:deposit.reference})).status,400);payment.amount=15000;payment.currency='USD';assert.equal((await call('/api/deposits/verify',{transactionId:123,reference:deposit.reference})).status,400);payment.currency='NGN';assert.equal((await call('/api/deposits/verify',{transactionId:123,reference:deposit.reference},'bob')).status,400);assert.equal((await call('/api/webhooks/flutterwave',{event:'charge.completed',data:{id:123}},null,{'verif-hash':'wrong'})).status,401);assert.equal((await call('/api/wallet')).data.balance,0);});
  await t.test('verified webhook and browser replay credit only once',async()=>{assert.equal((await call('/api/webhooks/flutterwave',{event:'charge.completed',data:{id:123}},null,{'verif-hash':env.FLW_WEBHOOK_SECRET})).status,200);assert.equal((await call('/api/deposits/verify',{transactionId:123,reference:deposit.reference})).data.balance,10);assert.equal((await call('/api/wallet')).data.balance,10);assert.equal((await db.query("select count(*)::int as n from prank_ledger where kind='deposit'")).rows[0].n,1);assert.equal((await call('/api/wallet',undefined,'bob')).data.balance,0);});
  const input={platform:'Coinbase',coin:'BTC',network:'Bitcoin',amount:'.05',address:'<sample-address>',email:'receiver@example.com',requestKey:randomUUID(),fee:0};let transfer;
  await t.test('preview sends nothing; ownership and duplicate debit protection',async()=>{transfer=(await call('/api/transfers/preview',input)).data;assert.equal(transfer.fee,2);assert.equal((await call('/api/transfers/preview',input)).data.id,transfer.id);assert.equal((await store.wallet(u1)).balance_cents,1000);assert.equal((await call('/api/transfers/confirm',{id:transfer.id},'bob')).status,404);const first=await call('/api/transfers/confirm',{id:transfer.id});assert.equal(first.status,200);assert.equal(first.data.balance,8);assert.equal(first.data.state,'queued');await call('/api/transfers/confirm',{id:transfer.id});assert.equal((await call('/api/wallet')).data.balance,8);const out=await store.one('prank_email_outbox',{transfer_id:transfer.id});assert.match(out.payload.html,/&lt;sample-address&gt;/);assert.match(out.payload.subject,/Fictional/);});
  await t.test('durable email sends once and keeps the same key',async()=>{let sends=0;await processEmail(store,env,async(url,options)=>{sends++;assert.equal(options.headers['Idempotency-Key'],`transfer/${transfer.id}`);return {ok:true,json:async()=>({id:'email-1'})};});assert.equal(await processEmail(store,env),false);assert.equal(sends,1);assert.equal((await call(`/api/transfers/${transfer.id}`)).data.state,'sent');});
  await t.test('first definite rejection refunds exactly once',async()=>{const q=(await call('/api/transfers/preview',{...input,requestKey:randomUUID()})).data;await call('/api/transfers/confirm',{id:q.id});assert.equal((await call('/api/wallet')).data.balance,6);await processEmail(store,env,async()=>({ok:false,status:422}));assert.equal((await call('/api/wallet')).data.balance,8);assert.equal((await call(`/api/transfers/${q.id}`)).data.state,'failed');await call('/api/transfers/confirm',{id:q.id});assert.equal((await call('/api/wallet')).data.balance,8);});
  await t.test('uncertain email failure retains debit and schedules retry',async()=>{const q=(await call('/api/transfers/preview',{...input,requestKey:randomUUID()})).data;await call('/api/transfers/confirm',{id:q.id});await processEmail(store,env,async()=>{throw Error('timeout');});assert.equal((await call('/api/wallet')).data.balance,6);assert.equal((await store.one('prank_email_outbox',{transfer_id:q.id})).state,'pending');});
  await t.test('retry after a timeout never refunds an ambiguous earlier send',async()=>{const job=(await db.query("select transfer_id from prank_email_outbox where state='pending' limit 1")).rows[0];await store.update('prank_email_outbox',{transfer_id:job.transfer_id},{next_attempt_at:'2000-01-01T00:00:00Z'});await processEmail(store,env,async(url,options)=>{assert.equal(options.headers['Idempotency-Key'],`transfer/${job.transfer_id}`);return {ok:false,status:422};});assert.equal((await store.wallet(u1)).balance_cents,600);assert.equal((await store.one('prank_email_outbox',{transfer_id:job.transfer_id})).state,'pending');});
  await t.test('old ambiguous jobs stop before the idempotency window expires',async()=>{const job=(await db.query("select transfer_id from prank_email_outbox where state='pending' limit 1")).rows[0];await store.update('prank_email_outbox',{transfer_id:job.transfer_id},{first_attempt_at:'2000-01-01T00:00:00Z',next_attempt_at:'2000-01-01T00:00:00Z'});assert.equal(await processEmail(store,env,async()=>{throw Error('Must not send');}),false);assert.equal((await store.one('prank_transfers',{id:job.transfer_id})).state,'review');});
  await t.test('insufficient balance and expired quotes cannot debit',async()=>{const big=(await call('/api/transfers/preview',{...input,amount:'1',requestKey:randomUUID()})).data;assert.equal((await call('/api/transfers/confirm',{id:big.id})).status,400);const exp=(await call('/api/transfers/preview',{...input,requestKey:randomUUID()})).data;await store.update('prank_transfers',{id:exp.id},{expires_at:'2000-01-01T00:00:00Z'});assert.match((await call('/api/transfers/confirm',{id:exp.id})).data.error,/expired/);assert.equal((await call('/api/wallet')).data.balance,6);});
  await t.test('RLS blocks cross-user reads, all writes and privileged RPC calls',async()=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${u2}';`);assert.equal((await db.query('select * from prank_ledger')).rows.length,0);await assert.rejects(db.query('update prank_wallets set balance_cents=999999'));await assert.rejects(db.query('select prank_credit_deposit($1,$2,$3)',[deposit.reference,'123',1500000]));await db.exec('reset role');});
  await t.test('wallet balances reconcile to the ledger',async()=>{const rows=(await db.query('select w.balance_cents,coalesce(sum(l.delta_cents),0)::bigint as total from prank_wallets w left join prank_ledger l on l.user_id=w.user_id group by w.user_id,w.balance_cents')).rows;for(const row of rows)assert.equal(Number(row.balance_cents),Number(row.total));});
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});

test('currency-rate API conversion, cache and stale-price rejection',async()=>{
 let calls=0;
 const pricing=createPricing({},async()=>{calls++;return {ok:true,json:async()=>({result:'success',base_code:'USD',rates:{NGN:1500},time_last_update_unix:Math.floor(Date.now()/1000)})};});
 assert.equal((await pricing.deposit(1500000)).usdCents,1000);assert.equal((await pricing.deposit(750000)).usdCents,500);assert.equal(calls,1);
 const stale=createPricing({},async()=>({ok:true,json:async()=>({result:'success',base_code:'USD',rates:{NGN:1500},time_last_update_unix:1})}));await assert.rejects(stale.deposit(100000));
 assert.equal(sameSecret('abc','abc'),true);assert.equal(sameSecret('abc','xyz'),false);assert.equal(sameSecret('',undefined),false);
 assert.throws(()=>verifyPayment({id:1,status:'failed',amount:15000,currency:'NGN',tx_ref:'x'},{tx_ref:'x',ngn_kobo:1500000}));
});
