import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {restoreApiPath} from './vercel-routing.mjs';
import {createServerlessHandler} from './serverless.mjs';
import {readFile} from 'node:fs/promises';

test('production origin reaches authentication while foreign origins are rejected',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const handler=createServerlessHandler({...config.env,SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'test',SUPABASE_PUBLISHABLE_KEY:'test'},{store:{}});
 const server=createServer((req,res)=>{void handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const [origin,status,message] of [['https://2winprankz.net',401,'Please sign in.'],['https://evil.test',403,'Origin rejected']]){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/transfers/preview`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
   assert.equal(response.status,status);
   assert.equal((await response.json()).error,message);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Vercel rewrite preserves nested API paths and pagination',()=>{
 for(const route of ['config','transfers/preview','deposits/quote','admin/users','webhooks/flutterwave','jobs/email']){
  const req={url:`/api/index?__api_path=${encodeURIComponent(route)}&page=2`};
  restoreApiPath(req);assert.equal(req.url,`/api/${route}?page=2`);
 }
 const direct={url:'/api/transfers/preview'};restoreApiPath(direct);assert.equal(direct.url,'/api/transfers/preview');
 const invalid={url:'/api/index?__api_path=https%3A%2F%2Fevil.test'};restoreApiPath(invalid);assert.equal(invalid.url,'/api/not-found');
});

test('rewritten transfer POST reaches the JSON authentication handler',async()=>{
 const handler=createServerlessHandler({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'test',SUPABASE_PUBLISHABLE_KEY:'test'},{store:{}});
 const server=createServer((req,res)=>{restoreApiPath(req);void handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/index?__api_path=transfers%2Fpreview`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,401);assert.match(response.headers.get('content-type'),/application\/json/);
  assert.deepEqual(await response.json(),{error:'Please sign in.'});
 }finally{await new Promise(resolve=>server.close(resolve));}
});
