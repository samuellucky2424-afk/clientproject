import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createServerlessHandler} from './serverless.mjs';

test('Vercel job endpoint validates its secret and processes bounded batches',async()=>{
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'server-test',SUPABASE_PUBLISHABLE_KEY:'public-test',RESEND_API_KEY:'email-test',CRON_SECRET:'cron-test'};
 let calls=0;
 const handler=createServerlessHandler(env,{store:{},process:async()=>{calls++;return true;}});
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(`${base}/api/jobs/email`)).status,401);assert.equal(calls,0);
  const result=await fetch(`${base}/api/jobs/email`,{headers:{Authorization:'Bearer cron-test'}});
  assert.deepEqual(await result.json(),{processed:2});assert.equal(calls,2);
  assert.equal((await fetch(`${base}/api/jobs/email`,{method:'DELETE',headers:{Authorization:'Bearer cron-test'}})).status,405);
  const config=await fetch(`${base}/api/config`);assert.equal((await config.json()).supabaseKey,'public-test');
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Vercel adapter schedules an immediate email drain after successful confirmation',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const transfer={id,user_id:id,platform:'Coinbase',coin:'BTC',amount:.05,network:'Bitcoin',address:'sample',email:'receiver@example.com',fee_cents:200,usd_cents:20000,usd_rate:4000,price_timestamp:new Date().toISOString(),state:'queued',created_at:new Date().toISOString()};
 let dispatches=0;const scheduled=[];
 const store={user:async()=>({id}),rpc:async name=>name==='prank_rate_limit'?true:transfer,one:async table=>table==='prank_account_controls'?null:transfer,wallet:async()=>({balance_cents:800})};
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'server-test',SUPABASE_PUBLISHABLE_KEY:'public-test',RESEND_API_KEY:'email-test',RESEND_FROM:'preview@example.com'};
 const handler=createServerlessHandler(env,{store,schedule:promise=>scheduled.push(promise),process:async()=>{dispatches++;return false;}});
 const server=createServer((req,res)=>{req.body={id};void handler(req,res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/transfers/confirm`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify({id})});
  assert.equal(response.status,200);assert.equal((await response.json()).state,'queued');await Promise.all(scheduled);assert.equal(scheduled.length,1);assert.equal(dispatches,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
