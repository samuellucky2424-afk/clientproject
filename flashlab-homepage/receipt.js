import {apiJson} from './session.js';
import './receipt.css';

let dialog, currentId;
const node = (tag, text) => {
 const element = document.createElement(tag);
 element.textContent = text;
 return element;
};
function render(t) {
 dialog.replaceChildren();
 dialog.append(node('h2', 'Transaction receipt'), node('p', .'));
 const fields = document.createElement('dl');
 const status = {pending:'Not confirmed — no service fee charged',queued:'Email queued',sent:'Email accepted for delivery',failed:'Email rejected — service fee refunded',review:'Delivery requires review'};
 for (const [label, value] of [
  ['Reference', t.id], ['Platform preference', t.platform], ['Amount (fictional)', `${t.amount} ${t.coin}`],
  ['Network', t.network], ['Recipient address', t.address], ['Recipient email', t.email],
  ['USD value (fictional)', `$${t.usdValue.toFixed(2)}`], ['Service fee', `$${t.fee.toFixed(2)} USD (${t.feePercent}%)`],
  ['Status', status[t.state] || t.state], ['Date', new Date(t.timestamp).toLocaleString()],
 ]) fields.append(node('dt', label), node('dd', value));
 dialog.append(fields);
 const close = node('button', 'Close receipt');
 close.type = 'button';
 close.onclick = () => dialog.close();
 dialog.append(close);
}
export function showReceipt(transfer) {
 if (!dialog) {
  dialog = document.createElement('dialog');
  dialog.className = 'transaction-receipt';
  dialog.setAttribute('aria-label', 'Transaction receipt');
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
