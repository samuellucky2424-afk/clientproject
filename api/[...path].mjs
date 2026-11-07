import {waitUntil} from '@vercel/functions';
import {createServerlessHandler} from '../server/serverless.mjs';

export default createServerlessHandler(process.env,{schedule:waitUntil});
