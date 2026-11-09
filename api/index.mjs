import {waitUntil} from '@vercel/functions';
import {createServerlessHandler} from '../server/serverless.mjs';
import {restoreApiPath} from '../server/vercel-routing.mjs';

const handler=createServerlessHandler(process.env,{schedule:waitUntil});
export default function api(req,res){
 restoreApiPath(req);
 return handler(req,res);
}
