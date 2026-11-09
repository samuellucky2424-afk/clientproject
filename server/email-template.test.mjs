import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEmail} from './email.mjs';
import {platforms} from './catalog.mjs';
import {receiptTheme} from '../flashlab-homepage/receipt-theme.mjs';

test('email embeds PNG logos and wraps long values without interpreting recipient HTML',async()=>{
 for(const platform of Object.keys(platforms)){
  const payload=await buildEmail({RESEND_FROM:'demo@example.com',APP_ORIGIN:'https://2winprankz.net'},{platform,usd_cents:200,fee_cents:2,fee_percent:1,amount:'2',coin:'USDT',network:'Tron (TRC20)',address:'x'.repeat(100)+'<img src=x>',id:'529b093b-1005-4986-a7ef-737233e1eb6a',email:'sample@example.com'});
  const attachment=payload.attachments[0];
  assert.equal(attachment.content_type,'image/png');
  assert.match(attachment.filename,/\.png$/);
  assert.deepEqual([...Buffer.from(attachment.content,'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.match(payload.html,/src="cid:platform-logo"/);
  assert.match(payload.html,/table-layout:fixed/);
  assert.match(payload.html,/&#8203;/);
  assert.ok(!payload.html.includes('<img src=x>'));
  assert.match(payload.html,/FICTIONAL DEMO/);
  assert.match(payload.text,/No cryptocurrency was transferred/);
  const theme=receiptTheme(platform);
  assert.equal(attachment.filename,theme.logo+'.png');
  assert.ok(payload.html.includes('background:'+theme.background));
  assert.ok(payload.html.includes('href="https://2winprankz.net/dashboard"'));
  assert.ok(!payload.html.includes('NaN'));
  assert.ok(payload.html.includes('$2.00 USD'));
  assert.ok(payload.html.includes('Not proof of payment'));
 }
});
