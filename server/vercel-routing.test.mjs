import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {restoreApiPath} from './vercel-routing.mjs';
import {createServerlessHandler} from './serverless.mjs';

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
