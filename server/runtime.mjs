import {createStore} from './store.mjs';
import {processEmail} from './email.mjs';
export function startWorker(env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY||!env.RESEND_API_KEY)return ()=>{};
 const store=createStore(env);let busy=false;
 const tick=async()=>{if(busy)return;busy=true;try{for(let n=0;n<10;n++){if(!await processEmail(store,env))break;}}catch(error){console.error('Email worker:',error.message);}finally{busy=false;}};
 const timer=setInterval(tick,5000);timer.unref();void tick();return ()=>clearInterval(timer);
}
