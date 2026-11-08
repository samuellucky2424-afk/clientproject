import { defineConfig, loadEnv } from 'vite';
import { createApi } from './server/api.mjs';
import {startWorker} from './server/runtime.mjs';
import {resolve} from 'node:path';
import {cp,mkdir} from 'node:fs/promises';
import {pageRoutes} from './server/routes.mjs';
export default defineConfig(({mode})=>({
 appType:'mpa',
 build:{outDir:resolve('dist'),rollupOptions:{input:Object.fromEntries(['index','auth','dashboard','crypto','terms','admin'].map(name=>[name,resolve(`flashlab-homepage/${name}.html`)]))}},
 plugins:[{name:'application-api',async closeBundle(){
  await cp(resolve('flashlab-homepage/assets/logos'),resolve('dist/assets/logos'),{recursive:true});
  await mkdir(resolve('dist/assets/images'),{recursive:true});
  await cp(resolve('flashlab-homepage/assets/images/receipt-qr.svg'),resolve('dist/assets/images/receipt-qr.svg'));
 },configureServer(server){
  const env={...process.env,...loadEnv(mode,process.cwd(),'')};
  env.APP_ORIGIN ||= 'http://127.0.0.1:5173';
  server.middlewares.use(pageRoutes);
  server.middlewares.use(createApi(env));
  const stop=startWorker(env);server.httpServer?.once('close',stop);
 }}]
}));
