import {createClient} from '@supabase/supabase-js';
let clientPromise;
export function authClient(){
 return clientPromise ||= fetch('/api/config').then(async response=>{
  const config=await response.json();if(!config.configured)throw Error('Account service is not configured yet.');
  return createClient(config.supabaseUrl,config.supabaseKey);
 });
}
export async function apiFetch(path,options={}){
 const client=await authClient();
 const {data:{session}}=await client.auth.getSession();
 if(!session){location.href='/auth';throw Error('Please sign in.');}
 const response=await fetch(path,{...options,headers:{...options.headers,Authorization:`Bearer ${session.access_token}`}});
 if(response.status===401){await client.auth.signOut();location.href='/auth';}
 return response;
}
export async function apiJson(path,body){
 const response=await apiFetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;
}
export async function setupAccount(){
 const client=await authClient();const {data:{session}}=await client.auth.getSession();
 if(!session){location.href='/auth';return null;}
 const button=document.getElementById('signOut');if(button)button.onclick=async()=>{await client.auth.signOut();location.href='/auth';};
 const avatar=document.querySelector('.avatar');if(avatar){avatar.textContent=session.user.email.slice(0,1).toUpperCase();avatar.setAttribute('aria-label',session.user.email);}
 return session.user;
}
