const themes = {
 Binance: {logo:'binance', background:'#f0b90b', ink:'#181a20', accent:'#f0b90b', buttonInk:'#181a20'},
 Coinbase: {logo:'coinbase', background:'#0879ed', ink:'#ffffff', accent:'#0879ed', buttonInk:'#ffffff'},
 'Trust Wallet': {logo:'trust-wallet', background:'#3375ee', ink:'#ffffff', accent:'#3375ee', buttonInk:'#ffffff'},
 Bybit: {logo:'bybit', background:'#171b26', ink:'#ffffff', accent:'#f7a600', buttonInk:'#171b26'},
};
export function receiptTheme(platform) {
 if (!Object.hasOwn(themes, platform)) throw Error('Unsupported receipt platform');
 return themes[platform];
}
