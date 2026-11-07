import {createApi} from './api.mjs';
import {createStore} from './store.mjs';
import {processEmail} from './email.mjs';
import {sameSecret} from './flutterwave.mjs';

export function createServerlessHandler(env,{schedule,store:providedStore,process:providedProcess}={}){
 let store=providedStore;
 const api=createApi(env,providedStore?{store:providedStore}:{});
 const ready=()=>Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&env.RESEND_API_KEY);
 async function drain(){
  if(!ready())return 0;
  store ||= createStore(env);
  let processed=0;
  // Two 20-second provider calls fit within the 60-second function budget.
  while(processed<2&&await (providedProcess||processEmail)(store,env))processed++;
  return processed;
 }
 return async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/jobs/email'){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(!['GET','POST'].includes(req.method)){res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}));}
   if(!env.CRON_SECRET||!sameSecret(req.headers.authorization,`Bearer ${env.CRON_SECRET}`)){res.statusCode=401;return res.end(JSON.stringify({error:'Unauthorized'}));}
   if(!ready()){res.statusCode=503;return res.end(JSON.stringify({error:'Email worker is not configured'}));}
   try{return res.end(JSON.stringify({processed:await drain()}));}catch(error){console.error('Email job failed:',error.message);res.statusCode=503;return res.end(JSON.stringify({error:'Email job failed; retry later'}));}
  }
  await api(req,res,()=>{res.statusCode=404;res.end(JSON.stringify({error:'Not found'}));});
  // Register background work with Vercel rather than relying on an always-running timer.
  if(schedule&&res.statusCode===200&&((req.method==='POST'&&path==='/api/transfers/confirm')||(req.method==='GET'&&/^\/api\/transfers\/[\da-f-]+$/i.test(path)))){
   schedule(drain().catch(error=>console.error('Email dispatch failed:',error.message)));
  }
 };
}
