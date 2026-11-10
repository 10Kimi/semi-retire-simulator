/**
 * 暗号資産の見分け方（/rb では配分の計算の対象外にする）。
 * リストを変えたら FI_project `personal-monitor/monitor/crypto.py` 側のリストも同じ中身にそろえる
 */

/** 交換業者：金融機関の列に含まれていたら暗号資産 */
export const CRYPTO_EXCHANGES = [
  'bitFlyer', 'Coincheck', 'GMOコイン', 'SBI VCトレード', 'bitbank', 'BITPOINT',
  '楽天ウォレット', 'Zaif', 'BitTrade', 'OKJ', 'Binance Japan', 'LINE BITMAX',
];

/** 通貨名：名前に含まれていたら暗号資産。英字だけの名前は前後が英字でないときだけ一致 */
export const CRYPTO_CURRENCY_NAMES = ['ビットコイン', 'イーサリアム', 'リップル', 'BTC', 'ETH', 'XRP'];

/** 照合用：NFKC・小文字・空白をすべて除く */
function key(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

const ASCII_ONLY = /^[a-z]+$/;

function containsCurrency(name: string, currency: string): boolean {
  const c = key(currency);
  if (!ASCII_ONLY.test(c)) return key(name).includes(c);
  // 英字の境界は空白を残した表記で見る（"BTC JPY" の空白を詰めて "btcjpy" にしないため）
  const n = name.normalize('NFKC').toLowerCase();
  return new RegExp(`(^|[^a-z])${c}($|[^a-z])`).test(n);
}

/** 預金・現金の区分の1行が暗号資産か */
export function isCryptoHolding(name: string, institution: string): boolean {
  const inst = key(institution);
  if (inst && CRYPTO_EXCHANGES.some(e => inst.includes(key(e)))) return true;
  return CRYPTO_CURRENCY_NAMES.some(c => containsCurrency(name, c));
}
