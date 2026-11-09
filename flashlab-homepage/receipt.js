import {receiptTheme} from './receipt-theme.mjs';
import {apiJson} from './session.js';
import './receipt.css';

let dialog, currentId;
const node = (tag, text) => {
 const element = document.createElement(tag);
 element.textContent = text;
 return element;
};
function render(t) {
 const theme = receiptTheme(t.platform);
 for (const [property, value] of Object.entries({'--receipt-bg':theme.background,'--receipt-ink':theme.ink,'--receipt-accent':theme.accent,'--receipt-button-ink':theme.buttonInk})) dialog.style.setProperty(property,value);
 const expanded = dialog.querySelector('details')?.open ?? false;
 dialog.replaceChildren();
 const header = node('header', '');
 header.className = 'demo-receipt-header';
 const brand = node('div', '');
 const logo = document.createElement('img');
 logo.src = `/assets/logos/${theme.logo}.png`;
 logo.alt = '';
 logo.width = 38; logo.height = 38;
 brand.append(logo, node('span', t.platform));
 brand.className = 'demo-receipt-brand';
 const source = node('span', '2WINPRANKZ / FICTIONAL DEMO');
 const close = node('button', '\u00d7');
 close.type = 'button';
 close.className = 'demo-receipt-close';
 close.setAttribute('aria-label', 'Close demo receipt');
 close.onclick = () => dialog.close();
 header.append(brand, source, close);
 const card = node('article', '');
 card.className = 'demo-receipt-card';
 const badge = node('p', 'Approved');
 badge.className = 'demo-receipt-badge';
 const check = node('div', '\u2713');
 check.className = 'demo-receipt-check';
 check.setAttribute('aria-hidden', 'true');
 const title = node('h2', 'Transfer sent');
 title.id = 'demoReceiptTitle';
 const amount = `${t.amount} ${t.coin}`;
 const usd = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(t.usdValue);
 const total = node('p', `${amount} (${usd} USD)`);
 total.className = 'demo-receipt-total';
 const divider = document.createElement('hr');
 const copy = node('p', `You just sent ${amount} (${usd} USD) from your external ${t.network} account. It may take up to 3 network confirmations before your Bitcoin is available to trade ${t.platform} receipt.`);
 copy.className = 'demo-receipt-copy';
 const details = document.createElement('details');
 details.open = expanded;
 const summary = node('summary', 'View transaction');
 const fields = document.createElement('dl');
 const status = {pending:'Not confirmed - no service fee charged',queued:'Email queued',sent:'Email accepted for delivery',failed:'Email rejected - service fee refunded',review:'Delivery requires review'};
 for (const [label, value] of [
  ['Demo reference', t.id], ['Platform preference', t.platform], ['Amount (fictional)', amount],
  ['Network', t.network], ['Sample recipient address', t.address], ['Recipient email', t.email],
  ['USD value (fictional)', usd], ['Service fee', `$${t.fee.toFixed(2)} USD (${t.feePercent}%)`],
  ['Email status', status[t.state] || t.state], ['Date', new Date(t.timestamp).toLocaleString()],
 ]) fields.append(node('dt', label), node('dd', value));
 details.append(summary, fields);
 const footer = node('p', 'Proof of payment.');
 footer.className = 'demo-receipt-footer';
 card.append(badge, check, title, total, divider, copy, details, footer);
 dialog.append(header, card);
}
export function showReceipt(transfer) {
 if (!dialog) {
  dialog = document.createElement('dialog');
  dialog.className = 'transaction-receipt';
  dialog.setAttribute('aria-labelledby', 'demoReceiptTitle');
  document.body.append(dialog);
 }
 currentId = transfer.id;
 render(transfer);
 if (!dialog.open) dialog.showModal();
}
export function updateReceipt(transfer) {
 if (dialog?.open && currentId === transfer.id) render(transfer);
}
export async function openReceipt(id, admin = false) {
 const transfer = await apiJson(`${admin ? '/api/admin/transfers/' : '/api/transfers/'}${encodeURIComponent(id)}`);
 showReceipt(transfer);
}
