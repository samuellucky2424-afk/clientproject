import {authClient} from './session.js';
const byId=id=>document.getElementById(id);let signup=false;
function setMode(value){signup=value;byId('agreementGroup').hidden=!signup;byId('agreeTerms').required=signup;byId('agreeTerms').checked=false;byId('submit').disabled=signup;byId('nameGroup').hidden=!signup;byId('name').required=signup;byId('heading').textContent=signup?'Create your account':'Welcome back';byId('intro').textContent=signup?'Get started with 2winprankz.':'Log in to your 2winprankz account.';byId('submit').textContent=signup?'Create Account':'Log In';byId('password').autocomplete=signup?'new-password':'current-password';for(const id of ['login','signup']){const on=(id==='signup')===signup;byId(id).classList.toggle('active',on);byId(id).setAttribute('aria-selected',on);}byId('message').textContent='';}
byId('login').onclick=()=>setMode(false);byId('signup').onclick=()=>setMode(true);
byId('agreeTerms').onchange=()=>{byId('submit').disabled=signup&&!byId('agreeTerms').checked;};
byId('authForm').onsubmit=async event=>{
 event.preventDefault();if(!event.currentTarget.reportValidity()||(signup&&!byId('agreeTerms').checked))return;
 byId('submit').disabled=true;byId('message').textContent='Connecting…';
 try{
  const client=await authClient();const credentials={email:byId('email').value.trim(),password:byId('password').value};
  const result=signup?await client.auth.signUp({...credentials,options:{emailRedirectTo:`${location.origin}/auth`,data:{display_name:byId('name').value.trim(),terms_accepted_at:new Date().toISOString()}}}):await client.auth.signInWithPassword(credentials);
  if(result.error)throw result.error;
  byId('password').value='';
  if(result.data.session)location.href='/dashboard';else byId('message').textContent='Check your email to confirm your account, then log in.';
 }catch(error){byId('message').textContent=error.message;}finally{byId('submit').disabled=signup&&!byId('agreeTerms').checked;}
};
if(new URLSearchParams(location.search).get('mode')==='signup')setMode(true);
