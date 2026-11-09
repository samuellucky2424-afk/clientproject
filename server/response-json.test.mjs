import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responseJson} from '../flashlab-homepage/response-json.mjs';

test('API reader accepts JSON success and preserves actionable server errors',async()=>{
 assert.deepEqual(await responseJson(new Response('{"balance":10}')),{balance:10});
 await assert.rejects(responseJson(new Response('{"error":"Insufficient balance"}',{status:400})),/Insufficient balance/);
});
test('HTML error pages and empty responses produce service errors instead of JSON parse errors',async()=>{
 await assert.rejects(responseJson(new Response('<html>Not found</html>',{status:404}),'Transfer service'),/Transfer service could not be found.*404/);
 await assert.rejects(responseJson(new Response('Bad Gateway',{status:502}),'Transfer service'),/temporarily unavailable.*502/);
 await assert.rejects(responseJson(new Response('<!doctype html>Login page'),'Transfer service'),/unexpected response.*200/);
 await assert.rejects(responseJson(new Response('')),/unexpected response/);
 for(const body of ['null','[]','"not an object"'])await assert.rejects(responseJson(new Response(body)),/invalid response/);
});
