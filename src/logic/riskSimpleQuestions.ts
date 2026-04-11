import type { RiskQuestion } from '../types/riskSimple';

export const RISK_SIMPLE_QUESTIONS: RiskQuestion[] = [
  // ── Capacity（6問） ──
  {
    id: 'C1',
    section: 'capacity',
    title: '現在の金融資産（投資可能な資産）',
    options: [
      { label: '〜500万円',         value: 1 },
      { label: '500〜1,500万円',    value: 2 },
      { label: '1,500〜3,000万円',  value: 3 },
      { label: '3,000〜5,000万円',  value: 4 },
      { label: '5,000万〜1億円',    value: 5 },
      { label: '1億〜3億円',        value: 6 },
      { label: '3億円〜',           value: 7 },
    ],
  },
  {
    id: 'C2',
    section: 'capacity',
    title: '過去3年間の平均年収（税込）',
    subtitle: '外資系はコミッションでブレが大きいため、過去3年平均でお答えください',
    options: [
      { label: '〜600万円',         value: 1 },
      { label: '600〜1,000万円',    value: 2 },
      { label: '1,000〜1,500万円',  value: 3 },
      { label: '1,500〜2,500万円',  value: 4 },
      { label: '2,500〜4,000万円',  value: 5 },
      { label: '4,000〜6,000万円',  value: 6 },
      { label: '6,000万円〜',       value: 7 },
    ],
  },
  {
    id: 'C3',
    section: 'capacity',
    title: '住宅ローン等の負債残高は、現在の金融資産の何割ですか？',
    options: [
      { label: '負債なし',              value: 0 },
      { label: '1割未満',              value: -0.3 },
      { label: '1〜3割',               value: -0.7 },
      { label: '3〜5割',               value: -1.2 },
      { label: '5割〜1倍',             value: -1.8 },
      { label: '1倍以上（負債が資産を超える）', value: -2.5 },
    ],
  },
  {
    id: 'C4',
    section: 'capacity',
    title: '今後15年以内の大型支出は、現在の金融資産の何割ですか？',
    subtitle: '教育費・親族への金銭的支援等',
    options: [
      { label: 'ほぼなし',    value: 0 },
      { label: '1割未満',    value: -0.3 },
      { label: '1〜3割',     value: -0.7 },
      { label: '3〜5割',     value: -1.2 },
      { label: '5割以上',    value: -1.8 },
    ],
  },
  {
    id: 'C5',
    section: 'capacity',
    title: '投資可能な期間',
    options: [
      { label: '5年未満',   value: 1 },
      { label: '5〜10年',   value: 3 },
      { label: '10〜20年',  value: 5 },
      { label: '20年超',    value: 7 },
    ],
  },
  {
    id: 'C6',
    section: 'capacity',
    title: '現在の年齢',
    options: [
      { label: '20代以下', value: 1.5 },
      { label: '30代',     value: 1 },
      { label: '40代',     value: 0 },
      { label: '50代',     value: -0.5 },
      { label: '60代',     value: -1 },
      { label: '70代以上', value: -1.5 },
    ],
  },

  // ── Tolerance（5問） ──
  {
    id: 'T1',
    section: 'tolerance',
    title: '「投資」という言葉から連想するもの',
    options: [
      { label: '損失',       value: 1 },
      { label: '不確かさ',   value: 3 },
      { label: 'チャンス',   value: 5 },
      { label: 'ワクワク感', value: 7 },
    ],
  },
  {
    id: 'T2',
    section: 'tolerance',
    title: '以下の選択肢があります。あなたならどれを選びますか？',
    options: [
      { label: '確実に10万円もらう',                    value: 1 },
      { label: '50%の確率で50万円（外れたら0円）',       value: 3 },
      { label: '25%の確率で100万円（外れたら0円）',      value: 5 },
      { label: '5%の確率で1,000万円（外れたら0円）',     value: 7 },
    ],
  },
  {
    id: 'T3',
    section: 'tolerance',
    title: '以下の4つの投資があります。どれが一番魅力的ですか？',
    options: [
      { label: '最良 +20万円 ／ 最悪 0円（損失なし）',   value: 1 },
      { label: '最良 +80万円 ／ 最悪 −20万円',          value: 3 },
      { label: '最良 +260万円 ／ 最悪 −80万円',         value: 5 },
      { label: '最良 +480万円 ／ 最悪 −240万円',        value: 7 },
    ],
  },
  {
    id: 'T4',
    section: 'tolerance',
    title: '老後資産を構築するためのポートフォリオとして、今の運用方針にどのくらい自信がありますか？',
    options: [
      { label: '正直自信がない。何かあればすぐ見直したい',               value: 1 },
      { label: 'あまり自信はない。暴落したら動揺すると思う',             value: 3 },
      { label: 'だいたい自信がある。多少の暴落なら保有し続けられる',      value: 5 },
      { label: '強く自信がある。長期で持ち続けるべきPFだと確信している',  value: 7 },
    ],
  },
  {
    id: 'T5',
    section: 'tolerance',
    title: 'リーマンショック級の暴落（資産が40〜50%下落）が来たとき、あなたはどうしますか？',
    options: [
      { label: '早めに売って損失を抑える',   value: 1 },
      { label: '辛いけどひたすら耐える',     value: 3 },
      { label: '何もせず保有し続ける',       value: 5 },
      { label: '買い増す',                  value: 7 },
    ],
  },
];

export const CAPACITY_QUESTIONS = RISK_SIMPLE_QUESTIONS.filter(q => q.section === 'capacity');
export const TOLERANCE_QUESTIONS = RISK_SIMPLE_QUESTIONS.filter(q => q.section === 'tolerance');
export const TOTAL_QUESTIONS = RISK_SIMPLE_QUESTIONS.length;
