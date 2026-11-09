import {readFile} from 'node:fs/promises';
import {platforms,escape} from './catalog.mjs';
export async function buildEmail(env,t){
 const [logo,color]=platforms[t.platform];
 // Inline PNG attachments work in mail clients that do not display SVG images.
 const image=await readFile(new URL(`../flashlab-homepage/assets/logos/${logo}.png`,import.meta.url));
 const amount=`${t.amount} ${t.coin}`;
 const rows=[['Amount',amount],['Network',t.network],['Wallet address',t.address],['Reference',t.id]].map(([label,value])=>{
  // Explicit break opportunities also work in clients that ignore overflow-wrap.
  const wrapped=Array.from(String(value)).reduce((chunks,char,index)=>{
   if(index%16===0)chunks.push('');
   chunks[chunks.length-1]+=char;
   return chunks;
  },[]).map(escape).join('&#8203;');
  return `<tr><td style="padding:10px 0 3px;color:#b9bec7;font-size:12px">${label}</td></tr><tr><td style="padding:0 0 10px;color:#ffffff;font-size:14px;word-break:break-all;overflow-wrap:anywhere;word-wrap:break-word">${wrapped}</td></tr>`;
 }).join('');
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#212227;font-family:Arial,sans-serif;color:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed"><tr><td align="center" style="padding:12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;table-layout:fixed"><tr><td style="padding:14px;border:1px solid ${color};color:${color};font-size:13px;font-weight:bold">PAYMENT</td></tr><tr><td align="center" style="padding:20px 12px;background:${color}"><img src="cid:platform-logo" width="48" height="48" alt="${escape(t.platform)}" style="display:block;width:48px;height:48px;border:0"><h1 style="margin:12px 0 0;font-size:26px;color:#16181c">${escape(t.platform)}</h1></td></tr><tr><td style="padding:16px;background:#212227"><h2 style="font-size:21px;margin:0 0 12px"> </h2><p style="font-size:18px;word-break:break-word">${escape(amount)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;text-align:left">${rows}</table><p style="font-size:14px;line-height:1.6"> cryptocurrency was transferred.</p></td></tr><tr><td style="padding:16px 0;font-size:12px;line-height:1.6;color:#b9bec7">  ${escape(t.platform)} notification.</td></tr></table></td></tr></table></body></html>`;
 return {from:env.RESEND_FROM,to:[t.email],subject:`YOU received a depost ${amount}`,html,
  text:`DEPOSIT CORNFIM\n${t.platform} Deposit\nAmount: ${amount}\nNetwork: ${t.network}\nwallet address: ${t.address}\nReference: ${t.id}\n .`,
  attachments:[{filename:`${logo}.png`,content:image.toString('base64'),content_type:'image/png',content_id:'platform-logo'}]};
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
