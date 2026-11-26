import {authClient,setupAccount} from './session.js';
import {responseJson} from './response-json.mjs';

const byId=id=>document.getElementById(id);
let client;
let account;
let cooldownUntil=0;
let cooldownTimer;
let otpRequested=false;

function message(id,text,error=false){
 const el=byId(id);
 el.textContent=text;
 el.classList.toggle('error',Boolean(error));
}

async function postAuth(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return responseJson(response,'Profile settings');
}

function startCooldown(){
 cooldownUntil=Date.now()+60000;
 clearInterval(cooldownTimer);
 const update=()=>{
  const remaining=Math.ceil((cooldownUntil-Date.now())/1000);
  byId('resendOtp').disabled=remaining>0;
  byId('resendOtp').textContent=remaining>0?`Send another code (${remaining}s)`:'Send another code';
  if(remaining<=0)clearInterval(cooldownTimer);
 };
 update();
 cooldownTimer=setInterval(update,1000);
}

function clearOtpState(){
 otpRequested=false;
 clearInterval(cooldownTimer);
 cooldownUntil=0;
 byId('passwordForm').reset();
 byId('passwordForm').hidden=true;
 byId('resendOtp').hidden=true;
 byId('requestOtp').disabled=false;
 byId('requestOtp').textContent='Send OTP code';
}

async function sendOtp(){
 await postAuth('/api/auth/password-reset/request',{email:byId('email').value.trim()});
 otpRequested=true;
 byId('passwordForm').hidden=false;
 byId('resendOtp').hidden=false;
 byId('requestOtp').textContent='Resend OTP code';
 startCooldown();
 message('passwordMessage','A 6-digit code has been sent to your email address.');
}

async function initialize(){
 try{
  account=await setupAccount();
  if(!account)return;
  client=await authClient();
  const email=account.email||'';
  const name=account.user_metadata?.display_name||account.user_metadata?.name||'';
  byId('email').value=email;
  byId('displayName').value=name;
  byId('avatar').textContent=(name||email||'G').slice(0,1).toUpperCase();
  byId('avatar').setAttribute('aria-label',name||email||'Account');
  byId('authLoading').hidden=true;
  byId('profilePanel').hidden=false;
 }catch(error){
  message('authLoading',error.message,true);
 }
}

byId('nameForm').onsubmit=async event=>{
 event.preventDefault();
 const name=byId('displayName').value.trim();
 if(!name)return;
 const button=byId('saveName');
 button.disabled=true;
 message('nameMessage','Saving name...');
 try{
  const {error}=await client.auth.updateUser({data:{display_name:name}});
  if(error)throw error;
  byId('avatar').textContent=name.slice(0,1).toUpperCase();
  byId('avatar').setAttribute('aria-label',name);
  message('nameMessage','Your name has been updated.');
 }catch(error){
  message('nameMessage',error.message,true);
 }finally{
  button.disabled=false;
 }
};

byId('requestOtp').onclick=async()=>{
 if(byId('requestOtp').disabled)return;
 byId('requestOtp').disabled=true;
 message('passwordMessage','Sending code...');
 try{
  await sendOtp();
 }catch(error){
  message('passwordMessage',error.message,true);
  byId('requestOtp').disabled=false;
 }
};

byId('resendOtp').onclick=async()=>{
 if(byId('resendOtp').disabled||Date.now()<cooldownUntil)return;
 byId('resendOtp').disabled=true;
 message('passwordMessage','Sending another code...');
 try{
  await sendOtp();
 }catch(error){
  message('passwordMessage',error.message,true);
  byId('resendOtp').disabled=false;
 }
};

byId('passwordForm').onsubmit=async event=>{
 event.preventDefault();
 if(!otpRequested){
  message('passwordMessage','Request an OTP code first.',true);
  return;
 }
 const token=byId('otp').value.trim();
 const password=byId('newPassword').value;
 if(!/^\d{6}$/.test(token)){
  message('passwordMessage','Enter the 6-digit code from your email.',true);
  return;
 }
 if(password!==byId('confirmPassword').value){
  message('passwordMessage','The new passwords do not match.',true);
  return;
 }
 if(!event.currentTarget.reportValidity())return;
 const button=byId('changePassword');
 button.disabled=true;
 message('passwordMessage','Verifying code...');
 try{
  const result=await postAuth('/api/auth/password-reset/verify',{email:byId('email').value.trim(),token});
  const {error:sessionError}=await client.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
  if(sessionError)throw sessionError;
  const {error}=await client.auth.updateUser({password});
  if(error)throw error;
  clearOtpState();
  message('passwordMessage','Your password has been changed successfully.');
 }catch(error){
  message('passwordMessage',error.message||'The code is invalid or expired.',true);
 }finally{
  button.disabled=false;
 }
};

void initialize();
