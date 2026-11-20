import {authClient} from './session.js';
import {responseJson} from './response-json.mjs';

const byId=id=>document.getElementById(id);
let mode='login';
let busy=false;
let resetAuthorized=false;
let resetEmail='';
let cooldownUntil=0;
let cooldownTimer;

function setMode(next){
 mode=next;
 const isSignup=mode==='signup';
 const isResetRequest=mode==='reset-request';
 const isResetVerify=mode==='reset-verify';
 const isReset=isResetRequest||isResetVerify;
 const resetHasSession=isResetVerify&&resetAuthorized;
 byId('authTabs').hidden=isReset;
 byId('agreementGroup').hidden=!isSignup;
 byId('agreeTerms').required=isSignup;
 byId('agreeTerms').checked=false;
 byId('nameGroup').hidden=!isSignup;
 byId('name').required=isSignup;
 byId('codeGroup').hidden=!isResetVerify||resetHasSession;
 byId('code').required=isResetVerify&&!resetHasSession;
 byId('confirmPasswordGroup').hidden=!isResetVerify;
 byId('confirmPassword').required=isResetVerify;
 byId('passwordGroup').hidden=isResetRequest;
 byId('password').required=!isResetRequest;
 byId('password').minLength=isSignup||isResetVerify?8:1;
 byId('password').autocomplete=isSignup||isResetVerify?'new-password':'current-password';
 byId('passwordLabel').textContent=isResetVerify?'New password':'Password';
 byId('email').readOnly=isResetVerify;
 for(const id of ['login','signup']){
  const active=(id==='signup')===isSignup&&!isReset;
  byId(id).hidden=isReset;
  byId(id).classList.toggle('active',active);
  byId(id).setAttribute('aria-selected',active);
 }
 byId('forgotPassword').hidden=mode!=='login';
 byId('resendCode').hidden=!isResetVerify;
 byId('cancelReset').hidden=!isReset;
 byId('heading').textContent=isSignup?'Create your account':isResetRequest?'Reset your password':isResetVerify?'Choose a new password':'Welcome back';
 byId('intro').textContent=isSignup
  ?'Get started with 2winprankz.'
  :isResetRequest
   ?'We will email you a code to reset your password.'
   :isResetVerify
    ?resetHasSession?'Set a new password for your account.':'Enter the code we emailed you and choose a new password.'
    :'Log in to your 2winprankz account.';
 byId('submit').textContent=isSignup?'Create Account':isResetRequest?'Send reset code':isResetVerify?'Change password':'Log In';
 byId('submit').disabled=busy||(isSignup&&!byId('agreeTerms').checked);
 byId('message').textContent='';
 if(isResetVerify)byId('email').value=resetEmail;
 else if(isResetRequest)byId('email').readOnly=false;
}

function startCooldown(){
 cooldownUntil=Date.now()+60000;
 clearInterval(cooldownTimer);
 const update=()=>{
  const remaining=Math.ceil((cooldownUntil-Date.now())/1000);
  byId('resendCode').disabled=remaining>0||busy;
  byId('resendCode').textContent=remaining>0?`Send another code (${remaining}s)`:'Send another code';
  if(remaining<=0)clearInterval(cooldownTimer);
 };
 update();
 cooldownTimer=setInterval(update,1000);
}

async function postAuth(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return responseJson(response,'Password reset service');
}

byId('login').onclick=()=>{resetAuthorized=false;setMode('login');};
byId('signup').onclick=()=>{resetAuthorized=false;setMode('signup');};
byId('agreeTerms').onchange=()=>{byId('submit').disabled=busy||(mode==='signup'&&!byId('agreeTerms').checked);};
byId('forgotPassword').onclick=()=>{resetAuthorized=false;resetEmail=byId('email').value.trim();setMode('reset-request');};
byId('cancelReset').onclick=()=>{resetAuthorized=false;setMode('login');};

byId('resendCode').onclick=async()=>{
 if(busy||Date.now()<cooldownUntil)return;
 byId('message').textContent='';
 busy=true;
 byId('resendCode').disabled=true;
 try{
  await postAuth('/api/auth/password-reset/request',{email:resetEmail});
  byId('message').textContent='If an account exists for that email, a new reset code has been sent.';
  startCooldown();
 }catch(error){
  byId('message').textContent=error.message;
  byId('resendCode').disabled=false;
 }finally{
  busy=false;
  byId('submit').disabled=false;
 }
};

byId('authForm').onsubmit=async event=>{
 event.preventDefault();
 if(!event.currentTarget.reportValidity()||(mode==='signup'&&!byId('agreeTerms').checked))return;
 if(mode==='reset-verify'&&byId('password').value!==byId('confirmPassword').value){
  byId('message').textContent='The new passwords do not match.';
  byId('confirmPassword').focus();
  return;
 }
 busy=true;
 byId('submit').disabled=true;
 byId('message').textContent='Connecting…';
 try{
  const client=await authClient();
  const email=byId('email').value.trim().toLowerCase();
  if(mode==='reset-request'){
   await postAuth('/api/auth/password-reset/request',{email});
   resetEmail=email;
   byId('code').value='';
   byId('password').value='';
   byId('confirmPassword').value='';
   resetAuthorized=false;
   setMode('reset-verify');
   byId('message').textContent='If an account exists for that email, a reset code has been sent.';
   startCooldown();
   return;
  }
  if(mode==='reset-verify'){
   if(!resetAuthorized){
    const result=await postAuth('/api/auth/password-reset/verify',{email:resetEmail,token:byId('code').value.trim()});
    const {error}=await client.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
    if(error)throw error;
    resetAuthorized=true;
    setMode('reset-verify');
   }
   const {error}=await client.auth.updateUser({password:byId('password').value});
   if(error)throw error;
   await client.auth.signOut({scope:'local'});
   resetAuthorized=false;
   clearInterval(cooldownTimer);
   byId('password').value='';
   byId('confirmPassword').value='';
   byId('code').value='';
   setMode('login');
   byId('email').value=resetEmail;
   byId('message').textContent='Your password has been changed. Log in with your new password.';
   return;
  }

  const credentials={email,password:byId('password').value};
  if(mode==='signup'){
   const result=await client.auth.signUp({...credentials,options:{emailRedirectTo:`${location.origin}/auth?verified=1`,data:{display_name:byId('name').value.trim(),terms_accepted_at:new Date().toISOString(),referrer:new URLSearchParams(location.search).get('ref')||undefined}}});
   if(result.error)throw result.error;
   if(result.data.session&&!result.data.user?.email_confirmed_at)await client.auth.signOut({scope:'local'});
   byId('password').value='';
   byId('message').textContent='Check your email for a verification link. You must verify your address before logging in.';
   return;
  }

  const result=await client.auth.signInWithPassword(credentials);
  if(result.error)throw result.error;
  if(!result.data.user?.email_confirmed_at){
   await client.auth.signOut({scope:'local'});
   byId('password').value='';
   throw Error('Please verify your email address before logging in. Check your inbox for the verification link.');
  }
  byId('password').value='';
  location.href=result.data.user.app_metadata?.role==='admin'?'/admin':'/dashboard';
 }catch(error){
  byId('message').textContent=error.message;
 }finally{
  busy=false;
  byId('submit').disabled=mode==='signup'&&!byId('agreeTerms').checked;
  if(mode==='reset-verify'&&Date.now()<cooldownUntil)byId('resendCode').disabled=true;
 }
};

async function initialize(){
 const params=new URLSearchParams(location.search);
 setMode(params.get('mode')==='signup'?'signup':'login');
 byId('authPanel').hidden=false;
 byId('authLoading').hidden=true;
 const confirmationError=params.get('error_description');
 if(confirmationError)byId('message').textContent=confirmationError;
 else if(params.get('verified')==='1')byId('message').textContent='Your email has been verified. You can now log in.';
 try{
  const client=await authClient();
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  if(data.session?.user?.email_confirmed_at){
   if(params.get('flow')==='password-reset'){
    resetEmail=data.session.user.email||'';
    resetAuthorized=true;
    setMode('reset-verify');
    byId('message').textContent='Your email is verified. Choose a new password to finish resetting it.';
    return;
   }
   location.replace(data.session.user.app_metadata?.role==='admin'?'/admin':'/dashboard');
  }
 }catch(error){
  byId('message').textContent=error.message;
 }
}

initialize();
