import {authClient} from './session.js';
import {responseJson} from './response-json.mjs';

const byId=id=>document.getElementById(id);
let mode='login';
let busy=false;
let resetAuthorized=false;
let resetEmail='';
let cooldownUntil=0;
let cooldownTimer;
let pendingEmail='';
let pendingPassword='';
let pendingName='';
let pendingReferrer='';
let signupStartedAt=0;

function setMode(next){
 mode=next;
 const isSignup=mode==='signup';
 const isOtpLogin=mode==='otp-login';
 const isOtpSignup=mode==='otp-signup';
 const isOtp=isOtpLogin||isOtpSignup;
 const isResetRequest=mode==='reset-request';
 const isResetVerify=mode==='reset-verify';
 const isReset=isResetRequest||isResetVerify;
 const resetHasSession=isResetVerify&&resetAuthorized;
 const showCode=(isResetVerify&&!resetHasSession)||isOtp;
 byId('authTabs').hidden=isReset||isOtp;
 byId('agreementGroup').hidden=!isSignup;
 byId('agreeTerms').required=isSignup;
 byId('agreeTerms').checked=false;
 byId('nameGroup').hidden=!isSignup;
 byId('name').required=isSignup;
 byId('codeGroup').hidden=!showCode;
 byId('code').required=showCode;
 byId('confirmPasswordGroup').hidden=!isResetVerify;
 byId('confirmPassword').required=isResetVerify;
 byId('passwordGroup').hidden=isResetRequest||isOtp;
 byId('password').required=!isResetRequest&&!isOtp;
 byId('password').minLength=isSignup||isResetVerify?8:1;
 byId('password').autocomplete=isSignup||isResetVerify?'new-password':'current-password';
 byId('passwordLabel').textContent=isResetVerify?'New password':'Password';
 byId('email').readOnly=isResetVerify||isOtp;
 for(const id of ['login','signup']){
  const active=(id==='signup')===isSignup&&!isReset&&!isOtp;
  byId(id).hidden=isReset||isOtp;
  byId(id).classList.toggle('active',active);
  byId(id).setAttribute('aria-selected',active);
 }
 byId('forgotPassword').hidden=mode!=='login';
 byId('resendCode').hidden=!(isResetVerify||isOtp);
 byId('cancelReset').hidden=!(isReset||isOtp);
 byId('cancelReset').textContent=isOtp?'Back to login':'Back to log in';
 byId('heading').textContent=isSignup?'Create your account':isOtpSignup?'Verify your email':isOtpLogin?'Verify to log in':isResetRequest?'Reset your password':isResetVerify?'Choose a new password':'Welcome back';
 byId('intro').textContent=isSignup
  ?'Get started with 2winprankz.'
  :isOtpSignup
   ?`Enter the 6-digit code sent to ${pendingEmail} to finish creating your account.`
   :isOtpLogin
    ?`Enter the 6-digit code sent to ${pendingEmail} to finish logging in.`
    :isResetRequest
     ?'We will email you a code to reset your password.'
     :isResetVerify
      ?resetHasSession?'Set a new password for your account.':'Enter the code we emailed you and choose a new password.'
      :'Log in to your 2winprankz account.';
 byId('submit').textContent=isOtp?'Verify code':isSignup?'Create Account':isResetRequest?'Send reset code':isResetVerify?'Change password':'Log In';
 byId('submit').disabled=busy||(isSignup&&!byId('agreeTerms').checked);
 byId('message').textContent='';
 if(isResetVerify)byId('email').value=resetEmail;
 else if(isOtp)byId('email').value=pendingEmail;
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

byId('login').onclick=()=>{resetAuthorized=false;clearOtpState();setMode('login');};
byId('signup').onclick=()=>{resetAuthorized=false;clearOtpState();setMode('signup');};
byId('agreeTerms').onchange=()=>{byId('submit').disabled=busy||(mode==='signup'&&!byId('agreeTerms').checked);};
byId('forgotPassword').onclick=()=>{resetAuthorized=false;clearOtpState();resetEmail=byId('email').value.trim();setMode('reset-request');};
byId('cancelReset').onclick=()=>{
 if(mode==='otp-login'||mode==='otp-signup'){
  const email=pendingEmail;
  void authClient().then(client=>client.auth.signOut({scope:'local'})).catch(()=>{});
  clearOtpState();
  setMode('login');
  byId('email').value=email;
  return;
 }
 resetAuthorized=false;
 setMode('login');
};

function clearOtpState(){
 pendingEmail='';
 pendingPassword='';
 pendingName='';
 pendingReferrer='';
 signupStartedAt=0;
 clearInterval(cooldownTimer);
 cooldownUntil=0;
 byId('resendCode').textContent='Send another code';
}

function otpOptions(){
 const options={shouldCreateUser:mode==='otp-signup'};
 if(mode==='otp-signup')options.data={display_name:pendingName,terms_accepted_at:new Date().toISOString(),referrer:pendingReferrer};
 return options;
}

byId('resendCode').onclick=async()=>{
 if(busy||Date.now()<cooldownUntil)return;
 byId('message').textContent='';
 busy=true;
 byId('resendCode').disabled=true;
 try{
  if(mode==='otp-login'||mode==='otp-signup'){
   const client=await authClient();
   const {error}=await client.auth.signInWithOtp({email:pendingEmail,options:otpOptions()});
   if(error)throw error;
   byId('message').textContent=`A new code has been sent to ${pendingEmail}.`;
  }else{
   await postAuth('/api/auth/password-reset/request',{email:resetEmail});
   byId('message').textContent='If an account exists for that email, a new reset code has been sent.';
  }
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
  if(mode==='otp-login'||mode==='otp-signup'){
   const {data,error}=await client.auth.verifyOtp({email:pendingEmail,token:byId('code').value.trim(),type:'email'});
   if(error)throw Error('The code is invalid or expired. Send another code and try again.');
   if(mode==='otp-signup'){
    const createdAt=Date.parse(data.user?.created_at||'');
    if(!Number.isFinite(createdAt)||createdAt<signupStartedAt-5000){
     await client.auth.signOut({scope:'local'});
     clearOtpState();
     throw Error('An account already exists for this email. Please log in instead.');
    }
    const {error:passwordError}=await client.auth.updateUser({password:pendingPassword});
    if(passwordError)throw passwordError;
   }
   clearOtpState();
   byId('code').value='';
   location.href=data.user?.app_metadata?.role==='admin'?'/admin':'/dashboard';
   return;
  }
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

  const password=byId('password').value;
  if(mode==='signup'){
   const referrer=new URLSearchParams(location.search).get('ref')||undefined;
   const displayName=byId('name').value.trim();
   signupStartedAt=Date.now();
   const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true,data:{display_name:displayName,terms_accepted_at:new Date().toISOString(),referrer}}});
   if(error)throw error;
   pendingEmail=email;
   pendingPassword=password;
   pendingName=displayName;
   pendingReferrer=referrer;
   byId('password').value='';
   setMode('otp-signup');
   byId('message').textContent=`We sent a 6-digit code to ${email}. Enter it to finish creating your account.`;
   startCooldown();
   return;
  }

  const result=await client.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  await client.auth.signOut({scope:'local'});
  const {error:otpError}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
  if(otpError)throw otpError;
  pendingEmail=email;
  byId('password').value='';
  setMode('otp-login');
  byId('message').textContent=`We sent a 6-digit code to ${email}. Enter it to finish logging in.`;
  startCooldown();
 }catch(error){
  byId('message').textContent=error.message;
 }finally{
  busy=false;
  byId('submit').disabled=mode==='signup'&&!byId('agreeTerms').checked;
  if(['reset-verify','otp-login','otp-signup'].includes(mode)&&Date.now()<cooldownUntil)byId('resendCode').disabled=true;
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
