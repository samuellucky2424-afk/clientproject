import {readFile} from 'node:fs/promises';
import {escape} from './catalog.mjs';
import {receiptTheme} from '../flashlab-homepage/receipt-theme.mjs';
export async function buildEmail(env,t){
 const theme=receiptTheme(t.platform);
 const image=await readFile(new URL(`../flashlab-homepage/assets/logos/${theme.logo}.png`,import.meta.url));
 const amount=`${t.amount} ${t.coin}`;
 const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(t.usd_cents)/100);
 const wrap=value=>Array.from(String(value)).reduce((chunks,char,index)=>{
  if(index%16===0)chunks.push('');
  chunks[chunks.length-1]+=char;
  return chunks;
 },[]).map(escape).join('&#8203;');
 const rows=[['Amount',amount],['Network',t.network],['Wallet address',t.address],['reference',t.id],['Service fee',`$${(Number(t.fee_cents)/100).toFixed(2)} USD (${t.fee_percent ?? 1}%)`]].map(([label,value])=>`<tr><td style="padding:10px 0 3px;color:#555f65;font-size:12px;font-weight:bold">${label}</td></tr><tr><td style="padding:0 0 10px;color:#737d83;font-size:13px;word-break:break-all;overflow-wrap:anywhere;word-wrap:break-word">${wrap(value)}</td></tr>`).join('');
 let action='';
 if(env.APP_ORIGIN){
  const origin=new URL(env.APP_ORIGIN);
  if(['https:','http:'].includes(origin.protocol)) action=`<a href="${escape(origin.origin+'/dashboard')}" style="display:block;padding:16px 12px;background:${theme.accent};color:${theme.buttonInk};text-decoration:none;font-size:16px;border-radius:2px">View transaction</a>`;
 }
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#edf1f5;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed"><tr><td align="center" style="padding:12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:410px;table-layout:fixed;background:${theme.background}"><tr><td align="center" style="padding:26px 20px 22px;color:${theme.ink}"><img src="cid:platform-logo" width="38" height="38" alt="${escape(t.platform)} logo" style="display:block;width:38px;height:38px;margin:0 auto 8px;border:0"><h1 style="margin:0;font-size:30px;font-weight:600;line-height:1.3">${escape(t.platform)}</h1><p style="font-size:9px;letter-spacing:1.5px;margin:10px 0 0">2WINPRANKZ / FICTIONAL DEMO</p></td></tr><tr><td style="padding:0 10px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;background:#ffffff;border:1px solid #d4ece5;border-radius:3px"><tr><td align="center" style="padding:20px 24px 24px"><p style="margin:0 0 26px;padding:8px 5px;border:1px solid #b6deda;background:#eefaf8;color:#16696d;font-size:10px;line-height:1.5;font-weight:bold">FICTIONAL DEMO - NO FUNDS MOVED</p><div style="width:90px;height:90px;line-height:90px;border:3px solid ${theme.accent};border-radius:50%;color:${theme.accent};font-size:55px;margin:0 auto 30px">&#10003;</div><h2 style="font-size:23px;line-height:1.3;font-weight:normal;color:#3e4243;margin:0 0 5px">Demo transfer received</h2><p style="font-size:15px;color:#747a7a;line-height:1.6;margin:0;word-break:break-word">${escape(amount)} (${escape(usd)} USD)</p><hr style="border:0;border-top:1px solid #e8eeea;margin:28px 0"><p style="font-size:16px;line-height:1.85;color:#7a7e7b;margin:0 0 30px;overflow-wrap:anywhere">This fictional preview shows ${escape(amount)} (${escape(usd)} USD) from a simulated external ${escape(t.network)} account. No cryptocurrency was received, transferred, or credited. This is not an official ${escape(t.platform)} receipt.</p>${action}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;text-align:left;margin-top:20px">${rows}</table><p style="margin:22px 0 0;font-size:10px;line-height:1.6;color:#637c81">Entertainment preview by 2winprankz. Not proof of payment.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`;
 return {from:env.RESEND_FROM,to:[t.email],subject:`You just received - ${amount}`,html,
  text:`Approved \n${t.platform} Deposit receipt\nAmount: ${amount} (${usd} USD)\nNetwork: ${t.network}\n Wallet address: ${t.address}\nreference: ${t.id}\n It may take up to 3 network confirmations before your Bitcoin is available to trade ${t.platform}.`,
  attachments:[{filename:`${theme.logo}.png`,content:image.toString('base64'),content_type:'image/png',content_id:'platform-logo'}]};
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
