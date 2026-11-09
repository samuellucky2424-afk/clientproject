import {showReceipt, updateReceipt} from './receipt.js';
import {apiJson,setupAccount} from './session.js';
const assets = [
  { coin: 'USDT', name: 'Tether', symbol: '₮', networks: ['Tron (TRC20)', 'Ethereum (ERC20)', 'BNB Smart Chain (BEP20)'] },
  { coin: 'BTC', name: 'Bitcoin', symbol: '₿', networks: ['Bitcoin'] },
  { coin: 'ETH', name: 'Ethereum', symbol: 'Ξ', networks: ['Ethereum'] },
  { coin: 'USDC', name: 'USD Coin', symbol: '$', networks: ['Ethereum', 'Solana', 'Base'] },
  { coin: 'BNB', name: 'BNB', symbol: '◈', networks: ['BNB Smart Chain'] },
  { coin: 'SOL', name: 'Solana', symbol: '◎', networks: ['Solana'] },
  { coin: 'LTC', name: 'Litecoin', symbol: 'Ł', networks: ['Litecoin'] },
  { coin: 'DOGE', name: 'Dogecoin', symbol: 'Ð', networks: ['Dogecoin'] },
  { coin: 'XRP', name: 'XRP', symbol: '✕', networks: ['XRP Ledger'] },
];

const byId = id => document.getElementById(id);
let selected = assets[0];
let activeDeliveryId=null;

function update() {
  activeDeliveryId=null;
  const amount = `${byId('amount').value || '0'} ${selected.coin}`;
  byId('amountSummary').textContent = amount;
  byId('receiptTotal').textContent = amount;
  byId('addressSummary').textContent = byId('address').value || 'Not entered';
  byId('emailSummary').textContent = byId('email').value || 'Not entered';
  byId('networkSummary').textContent = byId('network').value;
  if(typeof transferRequestKey!=='undefined')transferRequestKey=crypto.randomUUID();
  byId('receiptPanel').hidden = true;
  byId('receiptStatus').textContent = 'Awaiting confirmation';
  byId('receiptId').textContent = 'Not created';
  byId('receiptDate').textContent = '—';
  byId('receiptTime').textContent = '—';
  byId('receiptFee').textContent = `0.00000000 ${selected.coin}`;
}

function choose(asset) {
  selected = asset;
  byId('asset').value = asset.coin;
  byId('network').replaceChildren(...asset.networks.map(network => {
    const option = document.createElement('option');
    option.value = network;
    option.textContent = network;
    return option;
  }));
  byId('pairSummary').textContent = `${asset.coin} / USD`;
  byId('amountUnit').textContent = asset.coin;
  byId('recipientType').textContent = `${asset.name} Address`;
  byId('symbol').textContent = asset.symbol;
  update();
}

const logoNames = {
  Binance: 'binance',
  Coinbase: 'coinbase',
  'Trust Wallet': 'trust-wallet',
  Bybit: 'bybit',
};

for (const name of Object.keys(logoNames)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pair';
  button.setAttribute('aria-pressed', String(name === 'Binance'));
  button.classList.toggle('active', name === 'Binance');

  const strong = document.createElement('b');
  strong.textContent = name;
  const small = document.createElement('small');
  small.textContent = 'Platform preference';
  const logo = document.createElement('img');
  logo.src = `assets/logos/${logoNames[name]}.svg`;
  logo.alt = '';
  logo.className = 'platform-logo';
  const label = document.createElement('span');
  label.append(strong, small);
  button.append(logo, label);

  button.onclick = () => {
    document.querySelectorAll('#platforms .pair').forEach(item => {
      const isSelected = item === button;
      item.classList.toggle('active', isSelected);
      item.setAttribute('aria-pressed', String(isSelected));
    });
    byId('platformSummary').textContent = name;
    update();
  };
  byId('platforms').append(button);
}

for (const asset of assets) {
  const option = document.createElement('option');
  option.value = asset.coin;
  option.textContent = `${asset.coin} / USD — ${asset.name}`;
  byId('asset').append(option);
}

byId('asset').onchange = () => {
  choose(assets.find(asset => asset.coin === byId('asset').value));
};

['network', 'amount', 'address', 'email'].forEach(id => {
  byId(id).addEventListener('input', update);
});

let pendingQuote;
let transferRequestKey=crypto.randomUUID();
const bybitDemo=import.meta.env.DEV&&new URLSearchParams(location.search).get('preview')==='bybit';
if(!bybitDemo)setupAccount().catch(error=>byId('transferMessage').textContent=error.message);
const api=apiJson;
byId('cryptoForm').onsubmit = async event => {
 event.preventDefault();
 if (!byId('cryptoForm').reportValidity()) return;
 const button=event.submitter; button.disabled=true; byId('transferMessage').textContent='Preparing preview...';
 try {
  pendingQuote=await api('/api/transfers/preview',{requestKey:transferRequestKey,platform:byId('platformSummary').textContent,coin:selected.coin,amount:byId('amount').value,network:byId('network').value,address:byId('address').value,email:byId('email').value});
  byId('confirmDetails').replaceChildren();
  for(const [label,value] of [['Platform',pendingQuote.platform],['Amount',`${pendingQuote.amount} ${pendingQuote.coin}`],['Network',pendingQuote.network],['Recipient address',pendingQuote.address],['Recipient email',pendingQuote.email],['Transfer value (USD)',`$${pendingQuote.usdValue.toFixed(2)}`],['Rate (CoinGecko)',`1 ${pendingQuote.coin} = $${pendingQuote.usdRate} USD`],['Rate updated',pendingQuote.priceTimestamp],[`Service fee (${pendingQuote.feePercent}%)`,`$${pendingQuote.fee.toFixed(2)} USD`]]) {
   const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;byId('confirmDetails').append(dt,dd);
  }
  renderBybitReceipt(pendingQuote);
  await updatePaymentOptions();
  byId('receiptPanel').hidden=true; byId('confirmError').textContent='';byId('transferMessage').textContent='';byId('confirmTransfer').showModal();
 } catch(error) {byId('transferMessage').textContent=error.message;} finally{button.disabled=false;}
};
byId('cancelTransfer').onclick=()=>{byId('confirmTransfer').close();byId('receiptPanel').hidden=true;pendingQuote=null;};
byId('confirmTransfer').addEventListener('cancel',event=>{if(byId('sendTransfer').disabled)event.preventDefault();else {byId('receiptPanel').hidden=true;pendingQuote=null;}});
byId('sendTransfer').onclick=async()=>{
 if(!pendingQuote)return;
 byId('sendTransfer').disabled=true;byId('cancelTransfer').disabled=true;byId('confirmError').textContent='';
 try {
  const completed=await api('/api/transfers/confirm',{id:pendingQuote.id});
  byId('confirmTransfer').close();
  sessionStorage.removeItem('pendingTransfer');
  renderCompleted(completed);
  byId('transferMessage').textContent=`Preview queued. Service fee charged. Balance: $${completed.balance.toFixed(2)} USD.`;
  transferRequestKey=crypto.randomUUID();
  void trackDelivery(completed.id);
  pendingQuote=null;
 }catch(error){byId('confirmError').textContent=error.message;try{await updatePaymentOptions();}catch{}}finally{byId('sendTransfer').disabled=false;byId('cancelTransfer').disabled=false;}
};
function renderCompleted(completed) {
 activeDeliveryId=completed.id;
 byId('receiptPanel').hidden=true;
 showReceipt(completed);
}

choose(selected);

async function trackDelivery(id){
 for(let attempt=0;attempt<20;attempt++){
  await new Promise(resolve=>setTimeout(resolve,3000));
  if(activeDeliveryId!==id)return;
  try{
   const result=await apiJson(`/api/transfers/${id}`);
   updateReceipt(result);
   if(result.state==='sent'){byId('receiptStatus').textContent='Preview email submitted';byId('transferMessage').textContent='Email accepted for delivery.';return;}
   if(result.state==='failed'){byId('receiptStatus').textContent='Email rejected';byId('transferMessage').textContent='Email could not be sent. The service fee was refunded.';return;}
   if(result.state==='review'){byId('transferMessage').textContent='Email status requires review. The fee will not be charged again.';return;}
  }catch{break;}
 }
 byId('transferMessage').textContent='Email is queued. Its delivery status is available in your account history.';
}

let transferPayment,transferPaymentKey=crypto.randomUUID();
async function updatePaymentOptions(){const wallet=await api('/api/wallet');const insufficient=wallet.balance<pendingQuote.fee;byId('sendTransfer').hidden=insufficient;byId('payTransfer').hidden=!insufficient;byId('transferPaymentQuote').hidden=true;transferPayment=null;transferPaymentKey=crypto.randomUUID();byId('payTransfer').textContent=insufficient?`Pay fee ? wallet short by $${(pendingQuote.fee-wallet.balance).toFixed(2)}`:'Pay service fee';}
byId('payTransfer').onclick=async()=>{byId('payTransfer').disabled=true;try{transferPayment=await api('/api/transfers/payment',{id:pendingQuote.id,requestKey:transferPaymentKey});byId('transferPaymentText').textContent=`Pay NGN ${transferPayment.ngnAmount.toFixed(2)} to add $${transferPayment.usdCredit.toFixed(2)} to your wallet for the service fee. Minimum payment is NGN 100; remaining credit stays in your wallet. After payment, return to review the latest transfer price and confirm.`;byId('transferPaymentQuote').hidden=false;byId('confirmError').textContent='';}catch(error){byId('confirmError').textContent=error.message;}finally{byId('payTransfer').disabled=false;}};
byId('transferCheckout').onclick=async()=>{if(!transferPayment||!pendingQuote)return;byId('transferCheckout').disabled=true;try{sessionStorage.setItem('pendingTransfer',JSON.stringify(pendingQuote));const result=await api('/api/deposits/checkout',{id:transferPayment.id});location.assign(result.url);}catch(error){byId('confirmError').textContent=error.message;byId('transferCheckout').disabled=false;}};
if(new URLSearchParams(location.search).get('resume')==='1'){
 try{const saved=JSON.parse(sessionStorage.getItem('pendingTransfer'));if(saved){const asset=assets.find(a=>a.coin===saved.coin);if(asset)choose(asset);for(const button of document.querySelectorAll('#platforms .pair'))if(button.querySelector('b').textContent===saved.platform)button.click();byId('amount').value=saved.amount;byId('network').value=saved.network;byId('address').value=saved.address;byId('email').value=saved.email;update();byId('transferMessage').textContent='Your transfer details are restored. Review the latest price and confirm to use your wallet credits.';}}catch{byId('transferMessage').textContent='Could not restore transfer details. Please enter them again.';}
}

function renderBybitReceipt(transfer){
 byId('receiptPanel').dataset.platform=logoNames[transfer.platform];
 if(transfer.platform!=='Bybit')return;
 const amount=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:8,useGrouping:false}).format(Number(transfer.amount));
 byId('bybitAmount').textContent=`${amount} ${transfer.coin}`;
 byId('bybitTotal').textContent=`${amount} ${transfer.coin}`;
 const [local,domain]=transfer.email.split('@');
 byId('bybitReceiver').textContent=`${local.slice(0,2)}***@${domain.slice(0,2)}***`;
 byId('bybitAddress').textContent=`${transfer.address.slice(0,5)}...${transfer.address.slice(-4)} (sample address)`;
 byId('bybitDate').textContent=new Date(transfer.timestamp||transfer.priceTimestamp).toISOString().slice(0,19).replace('T',' ');
 byId('bybitOrder').textContent=`DEMO-${transfer.id}`;
 byId('bybitCopyMessage').textContent='Entertainment demo by 2winprankz. Not a Bybit payment receipt. App download is a visual placeholder.';
}
byId('copyBybitOrder').onclick=async()=>{try{await navigator.clipboard.writeText(byId('bybitOrder').textContent);byId('bybitCopyMessage').textContent='Demo order ID copied. Fictional preview - no funds transferred.';}catch{byId('bybitCopyMessage').textContent='Copy is unavailable. You can select the demo order ID above.';}};
byId('bybitDetails').onclick=()=>{const details=document.querySelector('#receiptPanel .receipt-extra');details.open=true;details.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};

if(bybitDemo){
 const sample={id:'00000000-0000-4000-8000-000000000000',platform:'Bybit',coin:'USDT',amount:'10',email:'sample@example.com',address:'DEMO-RECIPIENT-ADDRESS',timestamp:new Date().toISOString()};
 for(const button of document.querySelectorAll('#platforms .pair'))if(button.querySelector('b').textContent==='Bybit')button.click();
 byId('amount').value='10';byId('email').value=sample.email;byId('address').value=sample.address;
 update();renderBybitReceipt(sample);byId('receiptPanel').hidden=false;
 byId('transferMessage').textContent='Design preview with sample data. No payment or email is sent.';
 byId('receiptPanel').scrollIntoView({block:'start'});
}
