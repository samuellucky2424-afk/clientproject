import {receiptTheme} from './receipt-theme.mjs';
import {apiJson} from './session.js';
import './receipt.css';

let dialog, currentId;
const node = (tag, text) => {
 const element = document.createElement(tag);
 element.textContent = text;
 return element;
};
function blobDataUrl(blob) {
 return new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Unable to read receipt image'));
  reader.readAsDataURL(blob);
 });
}
function loadImage(source) {
 return new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Unable to render receipt image'));
  image.src = source;
 });
}
function wrapText(context, text, maxWidth) {
 const lines = [];
 for (const word of String(text).split(/\s+/)) {
  if (!word) continue;
  const line = lines.length ? lines[lines.length - 1] : '';
  if (line && context.measureText(`${line} ${word}`).width <= maxWidth) {
   lines[lines.length - 1] = `${line} ${word}`;
   continue;
  }
  if (context.measureText(word).width <= maxWidth) {
   lines.push(word);
   continue;
  }
  let part = '';
  for (const character of word) {
   if (part && context.measureText(part + character).width > maxWidth) {
    lines.push(part);
    part = '';
   }
   part += character;
  }
  if (part) lines.push(part);
 }
 return lines.length ? lines : [''];
}
function drawText(context, text, x, y, maxWidth, lineHeight, align = 'left') {
 const lines = wrapText(context, text, maxWidth);
 context.textAlign = align;
 lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
 return y + lines.length * lineHeight;
}
function receiptFields(transfer, amount, usd) {
 const status = {pending:'Not confirmed - no service fee charged',queued:'Email queued',sent:'Email accepted for delivery',failed:'Email rejected - service fee refunded',review:'Delivery requires review'};
 return [
  ['Reference', transfer.id], ['Platform preference', transfer.platform], ['Amount', amount],
  ['Network', transfer.network], ['Recipient address', transfer.address], ['Recipient email', transfer.email],
  ['USD value', usd], ['Service fee', `$${transfer.fee.toFixed(2)} USD (${transfer.feePercent}%)`],
  ['status', status[transfer.state] || transfer.state], ['Date', new Date(transfer.timestamp).toLocaleString()],
 ];
}
function drawReceipt(context, transfer, logo, width, totalHeight) {
 const theme = receiptTheme(transfer.platform);
 const cardX = 10, cardWidth = width - 20;
 const innerX = cardX + 28, innerWidth = cardWidth - 56;
 context.font = '600 25px Arial,Helvetica,sans-serif';
 const platformLines = wrapText(context, transfer.platform, width - 40);
 context.fillStyle = theme.background;
 context.fillRect(0, 0, width, 10000);
 context.drawImage(logo, (width - 38) / 2, 22, 38, 38);
 context.fillStyle = theme.ink;
 context.textAlign = 'center';
 let headerY = 83;
 platformLines.forEach((line, index) => context.fillText(line, width / 2, headerY + index * 30));
 const cardY = headerY + platformLines.length * 30 + 18;
 context.fillStyle = '#fff';
 context.fillRect(cardX, cardY, cardWidth, totalHeight ? totalHeight - cardY - 10 : 10);
 let y = cardY + 20;
 context.fillStyle = '#eefaf8';
 context.strokeStyle = '#b6deda';
 context.fillRect(innerX, y, innerWidth, 30);
 context.strokeRect(innerX, y, innerWidth, 30);
 context.fillStyle = '#16696d';
 context.font = '700 10px Arial,Helvetica,sans-serif';
 context.textAlign = 'center';
 context.fillText('Approved', width / 2, y + 20);
 y += 56;
 context.beginPath();
 context.arc(width / 2, y + 48, 47, 0, Math.PI * 2);
 context.strokeStyle = theme.accent;
 context.lineWidth = 3;
 context.stroke();
 context.fillStyle = theme.accent;
 context.font = '400 58px Arial,Helvetica,sans-serif';
 context.fillText('✓', width / 2, y + 67);
 y += 116;
 context.fillStyle = '#3e4243';
 context.font = '500 23px Arial,Helvetica,sans-serif';
 context.fillText('Transfer sent', width / 2, y);
 y += 25;
 const amount = `${transfer.amount} ${transfer.coin}`;
 const usd = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(transfer.usdValue);
 context.fillStyle = '#747a7a';
 context.font = '15px Arial,Helvetica,sans-serif';
 y = drawText(context, `${amount} (${usd} USD)`, width / 2, y, innerWidth, 23, 'center') + 8;
 context.strokeStyle = '#e8eeea';
 context.lineWidth = 1;
 context.beginPath();
 context.moveTo(innerX, y);
 context.lineTo(innerX + innerWidth, y);
 context.stroke();
 y += 28;
 context.fillStyle = '#7a7e7b';
 context.font = '16px Arial,Helvetica,sans-serif';
 y = drawText(context, `You just sent ${amount} (${usd} USD) from your external ${transfer.network} account. It may take up to 3 network confirmations before your Bitcoin is available to trade ${transfer.platform} receipt.`, innerX, y, innerWidth, 27) + 18;
 context.fillStyle = theme.accent;
 context.fillRect(innerX, y, innerWidth, 50);
 context.fillStyle = theme.buttonInk;
 context.font = '16px Arial,Helvetica,sans-serif';
 context.fillText('View transaction', width / 2, y + 31);
 y += 70;
 for (const [label, value] of receiptFields(transfer, amount, usd)) {
  context.fillStyle = '#555f65';
  context.font = '700 13px Arial,Helvetica,sans-serif';
  context.fillText(label, innerX + 4, y);
  y += 19;
  context.fillStyle = '#737d83';
  context.font = '13px Arial,Helvetica,sans-serif';
  y = drawText(context, value, innerX + 4, y, innerWidth - 8, 19) + 5;
 }
 context.fillStyle = '#637c81';
 context.font = '10px Arial,Helvetica,sans-serif';
 context.fillText('Proof of payment.', width / 2, y + 15);
 const height = y + 40;
 context.strokeStyle = '#d4ece5';
 context.strokeRect(cardX, cardY, cardWidth, height - cardY - 10);
 context.fillStyle = theme.background;
 context.fillRect(0, height - 10, width, 10);
 return height;
}
async function downloadReceiptPng(transfer) {
 const width = Math.ceil(dialog.getBoundingClientRect().width);
 if (!width) throw new Error('Receipt is not visible');
 const response = await fetch(`/assets/logos/${receiptTheme(transfer.platform).logo}.png`);
 if (!response.ok) throw new Error(`Unable to load receipt logo (${response.status})`);
 const logo = await loadImage(await blobDataUrl(await response.blob()));
 const scale = 2;
 const canvas = document.createElement('canvas');
 canvas.width = width * scale;
 canvas.height = 1;
 let context = canvas.getContext('2d');
 if (!context) throw new Error('Unable to create PNG canvas');
 context.scale(scale, scale);
 const height = Math.ceil(drawReceipt(context, transfer, logo, width));
 canvas.height = height * scale;
 context = canvas.getContext('2d');
 if (!context) throw new Error('Unable to create PNG canvas');
 context.scale(scale, scale);
 drawReceipt(context, transfer, logo, width, height);
 const png = await new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode receipt PNG')), 'image/png');
 });
 const pngUrl = URL.createObjectURL(png);
 const link = document.createElement('a');
 link.href = pngUrl;
 link.download = `receipt-${String(transfer.id).replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
 link.click();
 setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
}
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
 const source = node('span', ' ');
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
 for (const [label, value] of receiptFields(t, amount, usd)) fields.append(node('dt', label), node('dd', value));
 details.append(summary, fields);
 const footer = node('p', 'Proof of payment.');
 footer.className = 'demo-receipt-footer';
 const download = node('button', 'Save reciept');
 download.type = 'button';
 download.className = 'demo-receipt-download';
 const downloadStatus = node('p', '');
 downloadStatus.className = 'demo-receipt-download-status';
 downloadStatus.setAttribute('role', 'status');
 download.onclick = async () => {
  download.disabled = true;
  download.textContent = 'Preparing ...';
  downloadStatus.textContent = '';
  try {
   await downloadReceiptPng(t);
  } catch (error) {
   console.error('Unable to download receipt', error);
   downloadStatus.textContent = ' download failed. Please try again.';
  } finally {
   download.disabled = false;
   download.textContent = 'Save receipt';
  }
 };
 card.append(badge, check, title, total, divider, copy, details, download, downloadStatus, footer);
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
