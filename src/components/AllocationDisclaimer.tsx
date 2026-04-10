import { useState } from 'react';

type Variant = 'light' | 'dark';

export default function AllocationDisclaimer({ variant = 'light' }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);

  const styles = variant === 'dark'
    ? { bg: 'bg-slate-800/50', border: 'border-slate-700', text: 'text-slate-400', btn: 'text-slate-300 hover:text-slate-100' }
    : { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', btn: 'text-gray-600 hover:text-gray-800' };

  return (
    <div className={`${styles.bg} rounded-xl border ${styles.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between text-sm ${styles.btn}`}
      >
        <span>ⓘ この配分について</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={`px-4 pb-4 text-xs ${styles.text} leading-relaxed space-y-2`}>
          <p>
            この配分は投資可能資産を対象とした計算結果です。
            生活費6ヶ月分程度の緊急資金は別途現金で確保することを前提としています。
          </p>
          <p>
            外貨資産のリターン・リスクは円ベースで計算しています。
            為替変動はボラティリティの中に織り込まれています。
          </p>
          <p>
            期待リターンはGPIF第5期高成長実現ケース（楽観シナリオ）をベースとした計算上の目安です。
            実際のリターンは異なる場合があります。
          </p>
          <p>
            Lv6・7では株式資産への高集中が計算結果として示されます。
            集中投資には大きな価格変動リスクが伴います。
          </p>
          <p>
            この画面の表示はすべて計算結果です。最終的な投資判断はご自身でお願いします。
          </p>
        </div>
      )}
    </div>
  );
}
