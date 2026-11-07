import {apiJson,setupAccount} from './session.js';
const seeds=[
'omg 😲','Jesus called on video call? 😆',"I’m blown away!",'How did a 2-year-old video call me? Where’s your mama? 😂','No wayyyyyy!',"Wait, did you just send me 50k? Omg don’t fuckkin play with me lol",'I’m sooo excited! You mean all that was a prank?','Am I dreaming?',
'Who gave this baby my number?','My jaw just left the group chat 😭','Somebody come and see this!','Wait. Pause. Rewind.','I need a minute 😂','You have to be joking!','My brain is buffering…','This is a plot twist and a half!','My face said everything 😲','I almost dropped my phone!','This reaction deserves an award!','You got me good!','I was already planning my speech 😂','I need to sit down for this one.','My eyebrows just touched the ceiling!','Somebody pinch me!','The way I screamed 😭','You really had me believing that!','I wasn’t ready for this!','My mama needs to hear this story!','This is going straight to the group chat!','I just forgot how to blink 😳','Wait, the baby has Wi-Fi?','Who taught the toddler to press call?','That was a professional-level gotcha!','I laughed so hard I lost my slippers 😂','My serious face lasted two seconds.','You owe me a new set of nerves!','That reveal was criminally funny!','I nearly called the whole family!','I thought today was a normal day.','My tea nearly flew across the room!','You cannot be serious right now 😆','My reaction has its own reaction!','I need this moment on replay!','I was fooled with confidence 😂','Even my phone is confused.','The suspense almost finished me!','Hold on, let me put my glasses on.','This is premium group-chat material!','That baby has better signal than me!','My heart did a little backflip!','I just said WHAT in five languages.','Who approved this level of chaos?','That twist deserves a standing ovation!','I had a whole celebration ready 😭','I’m laughing and questioning everything!','I went from shocked to howling!','My neighbours heard that scream 😂','You really chose chaos today!','That was the fastest mood swing ever!','I need popcorn for this plot twist!'
];
const tails=['',' I cannot stop laughing.',' Somebody explain this to me.',' My face is still frozen.',' That reveal was everything.',' Please tell me you recorded my reaction.',' Let me catch my breath.',' I am sending this to my bestie.',' My day just got interesting.',' I have so many questions.',' This deserves an instant replay.',' The group chat will hear about this.',' I walked straight into that one.',' I should have seen it coming.',' My poker face has resigned.',' My whole mood just changed.',' I laughed before I could speak.',' Tell me how you thought of that.',' The timing was too perfect.',' I was not emotionally prepared.',' That reaction was completely unplanned.',' I need a behind-the-scenes explanation.',' My laugh just woke the house.',' This story is getting retold forever.',' I can’t even finish my sentence.',' Give me a second to recover.',' I really believed the plot twist.',' You just made my afternoon.',' I almost stood up to applaud.',' The surprise got me twice.'];
// 1,800 unique combinations: one every 400ms gives a 12-minute loop.
const phrases=[];for(const tail of tails)for(const seed of seeds)phrases.push(seed+tail);
for(let i=phrases.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[phrases[i],phrases[j]]=[phrases[j],phrases[i]]}
const layer=document.getElementById('reactions'),motion=document.getElementById('motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches,index=0,slot=0,timer;
const slots=[[3,20],[65,19],[2,67],[64,69],[7,43],[62,42],[27,8],[28,79]];
function emit(){if(paused||document.hidden)return;const el=document.createElement('span');const n=slot++%slots.length;const mobile=innerWidth<=650;const [x,y]=mobile?[[2,19],[42,29],[2,68],[38,78],[3,41],[40,56],[20,7],[15,87]][n]:slots[n];el.className='reaction '+['','alt','ink','hand'][index%4];el.textContent='“'+phrases[index++%phrases.length]+'”';el.style.left=x+'%';el.style.top=y+'%';el.style.maxWidth=mobile?'56%':'32%';el.style.setProperty('--tilt',(n%2?3:-3)+'deg');layer.append(el);const box=layer.parentElement;el.style.left=Math.max(12,Math.min(box.clientWidth-el.offsetWidth-12,box.clientWidth*x/100))+"px";el.style.top=Math.max(48,Math.min(box.clientHeight-el.offsetHeight-42,box.clientHeight*y/100))+"px";el.addEventListener('animationend',()=>el.remove(),{once:true});setTimeout(()=>el.remove(),3400)}
function update(){motion.textContent=paused?'▶ Play reactions':'Ⅱ Pause reactions';motion.setAttribute('aria-pressed',String(paused));clearInterval(timer);layer.replaceChildren();if(!paused){emit();timer=setInterval(emit,400)}}
motion.onclick=()=>{paused=!paused;update()};reduced.addEventListener('change',e=>{paused=e.matches;update()});document.addEventListener('visibilitychange',()=>{if(document.hidden)layer.replaceChildren()});update();
const dialog=document.getElementById('choice');document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{if(b.dataset.kind==='crypto'){location.href='/crypto';return;}const video=b.dataset.kind==='video';document.getElementById('choiceTitle').textContent=video?'Video Prank':'Crypto / Flashing Prank';document.getElementById('choiceText').textContent=video?'Your video prank space is coming next. Dream up a fictional surprise call, then let everyone in on the joke.':'Your crypto prank space is coming next. It will use clearly labelled fictional rewards and fictional activity. No real funds are sent.';dialog.showModal()});dialog.querySelector('.close').onclick=()=>dialog.close();dialog.querySelector('.dialog-done').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});

const topUpDialog=document.getElementById('topUpDialog');
let depositQuote,depositRequestKey=crypto.randomUUID();
const displayBalance=value=>{document.getElementById('walletBalance').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);};
function showWalletError(error){const message=error instanceof Error?error.message:String(error);document.getElementById('walletMessage').textContent=message==='Backend is not configured. See BACKEND_SETUP.md.'?'':message;}
async function loadWallet(){try{const data=await apiJson('/api/wallet');displayBalance(data.balance);}catch(error){document.getElementById('walletBalance').textContent='Unavailable';showWalletError(error);}}
setupAccount().then(loadWallet).catch(showWalletError);
window.addEventListener('pageshow',loadWallet);
document.getElementById('topUp').onclick=()=>topUpDialog.showModal();
topUpDialog.querySelector('.close').onclick=()=>topUpDialog.close();
document.getElementById('topUpAmount').oninput=()=>{depositQuote=null;depositRequestKey=crypto.randomUUID();document.getElementById('depositQuote').hidden=true;};
document.getElementById('topUpForm').onsubmit=async event=>{
 event.preventDefault();const input=document.getElementById('topUpAmount');if(!input.reportValidity())return;
 const button=event.submitter;button.disabled=true;document.getElementById('depositMessage').textContent='Getting the exchange rate?';
 try{
  depositQuote=await apiJson('/api/deposits/quote',{amount:input.value,requestKey:depositRequestKey});
  document.getElementById('depositQuoteText').textContent=`Pay NGN ${depositQuote.ngnAmount.toLocaleString('en-NG',{minimumFractionDigits:2})} to credit $${depositQuote.usdCredit.toFixed(2)} USD. Rate: NGN ${depositQuote.rate.toFixed(2)} per $1. Rate updated: ${new Date(depositQuote.rateTimestamp).toLocaleString()}.`;
  document.getElementById('depositQuote').hidden=false;document.getElementById('depositMessage').textContent='Review this amount before continuing to checkout.';
 }catch(error){document.getElementById('depositMessage').textContent=error.message;}finally{button.disabled=false;}
};
document.getElementById('depositCheckout').onclick=async event=>{
 if(!depositQuote)return;event.currentTarget.disabled=true;
 try{const data=await apiJson('/api/deposits/checkout',{id:depositQuote.id});location.assign(data.url);}
 catch(error){document.getElementById('depositMessage').textContent=error.message;document.getElementById('depositCheckout').disabled=false;}
};
const returnParams=new URLSearchParams(location.search);
async function verifyReturnedDeposit(){
 const message=document.getElementById('walletMessage'),retry=document.getElementById('retryDeposit');retry.hidden=true;
 message.textContent='Verifying your payment with Flutterwave?';
 try{
  const data=await apiJson('/api/deposits/verify',{transactionId:returnParams.get('transaction_id'),reference:returnParams.get('tx_ref')});
  displayBalance(data.balance);message.textContent='Payment verified. Your wallet has been credited.';history.replaceState({},'',location.pathname);
 }catch(error){message.textContent=error.message;retry.hidden=false;}
}
if(returnParams.has('transaction_id')&&returnParams.has('tx_ref'))void verifyReturnedDeposit();
else if(returnParams.has('deposit_return'))document.getElementById('walletMessage').textContent='Payment has not been confirmed yet. Your wallet updates after verification.';
document.getElementById('retryDeposit').onclick=verifyReturnedDeposit;

async function loadHistory(){
 const list=document.getElementById('walletHistory'),message=document.getElementById('historyMessage');message.textContent='Loading activity?';
 try{
  const data=await apiJson('/api/history');list.replaceChildren();
  const entries=[...data.deposits.map(d=>({title:`NGN ${d.ngnAmount.toFixed(2)} deposit`,detail:`USD credit: $${d.usdCredit.toFixed(2)} ? ${d.state}`,reference:d.reference})),...data.transfers.map(t=>({title:`${t.amount} ${t.coin} fictional preview`,detail:`Service fee: $${t.fee.toFixed(2)} ? ${t.state}`,reference:t.id}))];
  for(const entry of entries){const row=document.createElement('article'),title=document.createElement('strong'),detail=document.createElement('p'),reference=document.createElement('small');row.className='activity-row';title.textContent=entry.title;detail.textContent=entry.detail;reference.textContent=entry.reference;row.append(title,detail,reference);list.append(row);}
  message.textContent=entries.length?'':'No wallet activity yet.';
 }catch(error){message.textContent=error.message;}
}
document.getElementById('refreshHistory').onclick=()=>{void loadWallet();void loadHistory();};
void loadHistory();
