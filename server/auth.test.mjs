import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createApi} from './api.mjs';

const env={
 APP_ORIGIN:'https://app.example.com',
 SUPABASE_URL:'https://project.supabase.co',
 SUPABASE_SECRET_KEY:'test-secret',
 SUPABASE_PUBLISHABLE_KEY:'test-publishable',
};

async function withApi({limited=false,upstream},run){
 const calls=[];
 const store={rpc:async(name,args)=>{calls.push({name,args});return !limited;}};
 const request=async(url,options)=>{calls.push({url:new URL(url),options});return upstream;};
 const api=createApi(env,{store,request});
 const server=createServer((req,res)=>void api(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  await run(async(path,body)=>{
   const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:env.APP_ORIGIN,'X-Forwarded-For':'203.0.113.7'},body:JSON.stringify(body)});
   return {status:response.status,body:await response.json()};
  },calls);
 }finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
}

test('password reset requests use Supabase recovery and hide whether the email exists',async()=>{
 await withApi({upstream:{ok:true,status:200}},async(call,calls)=>{
  const result=await call('/api/auth/password-reset/request',{email:' User@Example.com '});
  assert.equal(result.status,200);
  assert.match(result.body.message,/If an account exists/);
  const request=calls.find(call=>call.url);
  assert.equal(request.url.pathname,'/auth/v1/recover');
  assert.equal(request.url.searchParams.get('redirect_to'),'https://app.example.com/auth?flow=password-reset');
  assert.equal(JSON.parse(request.options.body).email,'user@example.com');
  assert.equal(request.options.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
  const emailLimit=calls.find(call=>call.args?.p_key.includes('reset-request-email'));
  assert.ok(emailLimit);
  assert.equal(emailLimit.args.p_limit,3);
  assert.equal(emailLimit.args.p_seconds,3600);
  assert.equal(emailLimit.args.p_key.includes('user@example.com'),false);
});
});

test('password reset verifies a recovery OTP and returns only the new session credentials',async()=>{
 const session={access_token:'access-token',refresh_token:'refresh-token',user:{email:'user@example.com',id:'user-id'}};
 await withApi({upstream:{ok:true,status:200,json:async()=>session}},async(call,calls)=>{
  const result=await call('/api/auth/password-reset/verify',{email:'user@example.com',token:'123456'});
  assert.equal(result.status,200);
  assert.deepEqual(result.body,{access_token:'access-token',refresh_token:'refresh-token'});
  const request=calls.find(call=>call.url);
  assert.equal(request.url.pathname,'/auth/v1/verify');
  assert.deepEqual(JSON.parse(request.options.body),{email:'user@example.com',token:'123456',type:'recovery'});
  const attemptLimit=calls.find(call=>call.args?.p_key.includes('reset-verify-email'));
  assert.equal(attemptLimit.args.p_limit,5);
  assert.equal(attemptLimit.args.p_seconds,900);
});
});

test('reset email limits reject requests before calling Supabase',async()=>{
 await withApi({limited:true,upstream:{ok:true,status:200}},async(call,calls)=>{
  const result=await call('/api/auth/password-reset/request',{email:'user@example.com'});
  assert.equal(result.status,429);
  assert.equal(calls.some(call=>call.url),false);
});
});

test('invalid or expired reset OTPs are rejected without exposing provider details',async()=>{
 await withApi({upstream:{ok:false,status:400}},async(call)=>{
  const result=await call('/api/auth/password-reset/verify',{email:'user@example.com',token:'123456'});
  assert.equal(result.status,400);
  assert.equal(result.body.error,'The code is invalid or expired. Request a new code.');
 });
});
