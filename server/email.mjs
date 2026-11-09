import {readFile} from 'node:fs/promises';
import {platforms,escape} from './catalog.mjs';
export async function buildEmail(env,t){
     const [logo,color]=platforms[t.platform];
     const svg=await readFile(new URL(`../flashlab-homepage/assets/logos/${logo}.svg`,import.meta.url));
     const rows=[['Amount',`${t.amount} ${t.coin}`],['Network',t.network],['Wallet address',t.address],['Reference',t.id]].map(([k,v])=>`<tr><td style="padding:10px;color:#aaa">${k}</td><td style="padding:10px;color:white">${escape(v)}</td></tr>`).join('');
     const html=`<div style="background:#212227;padding:25px;font-family:Arial;color:white;max-width:560px;margin:auto"><p style="border:1px solid ${color};padding:14px;color:${color}">.</p><div style="background:${color};padding:25px;text-align:center"><img src="cid:platform-logo" width="48" alt="${escape(t.platform)} logo"><h1 style="color:#16181c">${escape(t.platform)}</h1><div style="background:#212227;padding:25px"><h2>Deposit</h2><p>${escape(t.amount)} ${escape(t.coin)}</p><table style="width:100%;text-align:left">${rows}</table><p>cryptocurrency was transferred  & redited.</p></div></div><p>. ${escape(t.platform)} notification.</p></div>`;

return {from:env.RESEND_FROM,to:[t.email],subject:`Fictional crypto preview ? ${t.amount} ${t.coin}`,html,attachments:[{filename:`${logo}.svg`,content:svg.toString('base64'),content_id:'platform-logo'}]};
}
export async function processEmail(store,env,request=fetch){
 if(!env.RESEND_API_KEY)return false;
 const j=await store.rpc('prank_claim_email');if(!j)return false;
 let outcome='retry',providerId=null,error=null;
 try{
  const r=await request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`transfer/${j.transfer_id}`},body:JSON.stringify(j.payload),signal:AbortSignal.timeout(20000)});
  if(r.ok){const data=await r.json();if(!data.id)throw Error('Missing provider receipt');outcome='sent';providerId=data.id;}
  else {error=`Provider HTTP ${r.status}`;if([400,401,403,404,413,422].includes(r.status))outcome='failed';}
 }catch{error='Email delivery outcome is uncertain; retrying with the same key.';}
 await store.rpc('prank_finish_email',{p_id:j.transfer_id,p_lease:j.lease_id,p_outcome:outcome,p_provider_id:providerId,p_error:error});
 return true;
}
