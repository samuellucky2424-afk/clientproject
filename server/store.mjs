import {createClient} from '@supabase/supabase-js';
export function createStore(env) {
 const client=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const check=({data,error})=>{if(error){console.error('Database operation failed:',error.code);throw Error('Database operation failed. Please retry.');}return data;};
 return {
  async user(token){const {data,error}=await client.auth.getUser(token);if(error||!data.user||data.user.is_anonymous||!data.user.email_confirmed_at)return null;return data.user;},
  async rows(table,filters={},limit=50,offset=0){let q=client.from(table).select('*');for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.order('created_at',{ascending:false}).order(['prank_referrals','prank_wallets'].includes(table)?'user_id':'id',{ascending:false}).range(offset,offset+limit-1));},
  async one(table,filters){let q=client.from(table).select('*');for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.maybeSingle());},
  async insert(table,body){return check(await client.from(table).insert(body).select().single());},
  async update(table,filters,body){let q=client.from(table).update(body);for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.select());},
  async upsert(table,body){return check(await client.from(table).upsert(body).select().single());},
  async wallet(userId){check(await client.from('prank_wallets').upsert({user_id:userId},{onConflict:'user_id',ignoreDuplicates:true}));return check(await client.from('prank_wallets').select('*').eq('user_id',userId).single());},
  async rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error){if(error.code==='P0001')throw Error(error.message);console.error('Database RPC failed:',name,error.code);throw Error('Database operation failed. Please retry.');}return data;}
 };
}
