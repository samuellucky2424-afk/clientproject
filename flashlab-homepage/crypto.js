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
  byId('emailPreview').hidden = true;
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
setupAccount().catch(error=>byId('transferMessage').textContent=error.message);
const api=apiJson;
byId('cryptoForm').onsubmit = async event => {
 event.preventDefault();
 if (!byId('cryptoForm').reportValidity()) return;
 const button=event.submitter; button.disabled=true; byId('transferMessage').textContent='Preparing preview...';
 try {
  pendingQuote=await api('/api/transfers/preview',{requestKey:transferRequestKey,platform:byId('platformSummary').textContent,coin:selected.coin,amount:byId('amount').value,network:byId('network').value,address:byId('address').value,email:byId('email').value});
  byId('confirmDetails').replaceChildren();
  for(const [label,value] of [['Platform',pendingQuote.platform],['Amount',`${pendingQuote.amount} ${pendingQuote.coin}`],['Network',pendingQuote.network],['Recipient address',pendingQuote.address],['Recipient email',pendingQuote.email],['Transfer value (USD)',`$${pendingQuote.usdValue.toFixed(2)}`],['Rate (CoinGecko)',`1 ${pendingQuote.coin} = $${pendingQuote.usdRate} USD`],['Rate updated',pendingQuote.priceTimestamp],['Service fee (1%)',`$${pendingQuote.fee.toFixed(2)} USD`]]) {
   const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;byId('confirmDetails').append(dt,dd);
  }
  byId('receiptPanel').hidden=false; byId('confirmError').textContent='';byId('transferMessage').textContent='';byId('confirmTransfer').showModal();
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
  renderCompleted(completed);
  byId('transferMessage').textContent=`Preview queued. Service fee charged. Balance: $${completed.balance.toFixed(2)} USD.`;
  transferRequestKey=crypto.randomUUID();
  void trackDelivery(completed.id);
  pendingQuote=null;
 }catch(error){byId('confirmError').textContent=error.message;}finally{byId('sendTransfer').disabled=false;byId('cancelTransfer').disabled=false;}
};
function renderCompleted(completed) {
  activeDeliveryId=completed.id;
  byId('amountSummary').textContent=`${completed.amount} ${completed.coin}`;
  byId('receiptTotal').textContent=`${completed.amount} ${completed.coin}`;
  const now = new Date(completed.timestamp);
  const timestamp = now.toISOString();
  const reference = completed.id;
  const platform = completed.platform;

  byId('receiptStatus').textContent = completed.state==='sent'?'Preview email submitted':'Preview email queued';
  byId('receiptId').textContent = reference;
  byId('receiptDate').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(now);
  byId('receiptTime').textContent = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(now);

  byId('mailTo').textContent = completed.email;
  byId('mailPlatform').textContent = platform;
  byId('mailService').textContent = platform;
  byId('emailPreview').dataset.platform = logoNames[platform];
  for (const id of ['mailSenderLogo', 'mailBrandLogo']) {
    byId(id).src = `assets/logos/${logoNames[platform]}.svg`;
    byId(id).alt = `${platform} logo`;
  }
  byId('mailDepositCopy').textContent = `This fictional ${platform} email shows a sample deposit of ${completed.amount} ${completed.coin} on ${completed.network}. No funds have been received or credited.`;
  byId('mailAmount').textContent = `${completed.amount} ${completed.coin}`;
  byId('mailChain').textContent = completed.network;
  byId('mailAddress').textContent = completed.address;
  byId('mailTime').textContent = timestamp.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  byId('mailRef').textContent = reference;
  byId('emailPreview').hidden = false;
  byId('emailPreview').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'nearest',
  });
};

choose(selected);

async function trackDelivery(id){
 for(let attempt=0;attempt<20;attempt++){
  await new Promise(resolve=>setTimeout(resolve,3000));
  if(activeDeliveryId!==id)return;
  try{
   const result=await apiJson(`/api/transfers/${id}`);
   if(result.state==='sent'){byId('receiptStatus').textContent='Preview email submitted';byId('transferMessage').textContent='Email accepted for delivery.';return;}
   if(result.state==='failed'){byId('receiptStatus').textContent='Email rejected';byId('transferMessage').textContent='Email could not be sent. The service fee was refunded.';return;}
   if(result.state==='review'){byId('transferMessage').textContent='Email status requires review. The fee will not be charged again.';return;}
  }catch{break;}
 }
 byId('transferMessage').textContent='Email is queued. Its delivery status is available in your account history.';
}
