import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createApi} from './api.mjs';
import {startWorker} from './runtime.mjs';
import {pageRoutes} from './routes.mjs';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const env=process.env;
if(!env.APP_ORIGIN)throw Error('Set APP_ORIGIN to the public site URL.');
const origin=new URL(env.APP_ORIGIN);
if(env.NODE_ENV==='production'&&origin.protocol!=='https:')throw Error('Production APP_ORIGIN must use HTTPS.');
const root=resolve('dist'),api=createApi(env);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 try{await api(req,res,()=>pageRoutes(req,res,async()=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;return res.end();}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile()){res.statusCode=404;return res.end('Not found');}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control',extname(file)==='.html'?'no-cache':'public, max-age=3600');
  res.end(req.method==='HEAD'?undefined:await readFile(file));
 }));}catch{if(!res.writableEnded){res.statusCode=404;res.end('Not found');}}
});
server.requestTimeout=30000;server.headersTimeout=15000;
const stopWorker=startWorker(env);
server.listen(Number(env.PORT)||3000,()=>console.log(`Server listening on port ${Number(env.PORT)||3000}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopWorker();server.close(()=>process.exit(0));});
