import type { RiskQuestion } from '../types/riskSimple';

export const RISK_DETAIL_QUESTIONS: RiskQuestion[] = [
  // ── Capacity（8問） ──
  {
    id: 'C1',
    section: 'capacity',
    title: '現在の金融資産（投資可能な資産・緊急資金を除く）',
    options: [
      { label: '500万円未満',         value: 1 },
      { label: '500〜1,500万円',      value: 2 },
      { label: '1,500〜3,000万円',    value: 3 },
      { label: '3,000〜5,000万円',    value: 4 },
      { label: '5,000万〜1億円',      value: 5 },
      { label: '1億〜3億円',          value: 6 },
      { label: '3億円以上',           value: 7 },
    ],
  },
  {
    id: 'C2',
    section: 'capacity',
    title: '過去3年間の平均年収（税込）',
    subtitle: 'ボーナス・コミッション含む総額',
    options: [
      { label: '600万円未満',         value: 1 },
      { label: '600〜1,000万円',      value: 2 },
      { label: '1,000〜1,500万円',    value: 3 },
      { label: '1,500〜2,500万円',    value: 4 },
      { label: '2,500〜4,000万円',    value: 5 },
      { label: '4,000〜6,000万円',    value: 6 },
      { label: '6,000万円以上',       value: 7 },
    ],
  },
  {
    id: 'C3',
    section: 'capacity',
    title: '住宅ローン等の負債残高は、現在の金融資産の何割ですか？',
    options: [
      { label: '負債なし',    value: 0 },
      { label: '1割未満',    value: -0.3 },
      { label: '1〜3割',     value: -0.7 },
      { label: '3〜5割',     value: -1.0 },
      { label: '5割以上',    value: -1.5 },
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
      { label: '1〜3割',     value: -0.8 },
      { label: '3割以上',    value: -1.0 },
    ],
  },
  {
    id: 'C5',
    section: 'capacity',
    title: '投資可能な期間はどのくらいですか？',
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
    title: '現在のご年齢は？',
    options: [
      { label: '20代以下', value: 1.5 },
      { label: '30代',     value: 1 },
      { label: '40代',     value: 0 },
      { label: '50代',     value: -0.5 },
      { label: '60代',     value: -1 },
      { label: '70代以上', value: -1.5 },
    ],
  },
  {
    id: 'C7',
    section: 'capacity',
    title: '収入の安定性',
    subtitle: 'あなたの収入源に最も近いものを選んでください',
    options: [
      { label: '公務員・国家資格職（医師・弁護士等）',       value: 1.0 },
      { label: '国内大手上場企業（固定給中心）',            value: 1.0 },
      { label: '外資系企業（固定給中心）',                  value: 0.9 },
      { label: '外資系企業（コミッション・ボーナス比率大）',  value: 0.7 },
      { label: '中小・未上場企業（固定給中心）',            value: 0.8 },
      { label: '自営業・フリーランス',                     value: 0.7 },
      { label: '経営者・役員（業績連動）',                  value: 0.6 },
    ],
  },
  {
    id: 'C8',
    section: 'capacity',
    title: '家族構成・扶養人数',
    options: [
      { label: '独身・扶養なし',        value: 0.5 },
      { label: '配偶者のみ（共働き）',   value: 0.3 },
      { label: '配偶者のみ（専業）',     value: 0 },
      { label: '子供1人',              value: -0.3 },
      { label: '子供2人',              value: -0.6 },
      { label: '子供3人以上',           value: -1.0 },
    ],
  },

  // ── Tolerance（12問） ──
  {
    id: 'T1',
    section: 'tolerance',
    title: '全体的に見て、あなたはリスクを取ることを厭わない人間だと思いますか？',
    options: [
      { label: 'まったくそう思わない',       value: 1 },
      { label: 'あまりそう思わない',         value: 3 },
      { label: 'どちらかといえばそう思う',    value: 5 },
      { label: '強くそう思う',              value: 7 },
    ],
  },
  {
    id: 'T3',
    section: 'tolerance',
    title: '万一失業した場合、今の生活水準を維持できる期間はどのくらいですか？（緊急資金ベース）',
    options: [
      { label: '3ヶ月未満',   value: 1 },
      { label: '3〜6ヶ月',    value: 3 },
      { label: '6ヶ月〜1年',  value: 5 },
      { label: '1年以上',     value: 7 },
    ],
  },
  {
    id: 'T4',
    section: 'tolerance',
    title: '資産運用についての知識はどの程度ありますか？',
    options: [
      { label: 'ほとんどない',           value: 1 },
      { label: '基本的なことは知っている', value: 3 },
      { label: 'かなり詳しい',           value: 5 },
      { label: '専門的な知識がある',      value: 7 },
    ],
  },
  {
    id: 'T6',
    section: 'tolerance',
    title: '「リスク」という言葉を聞いたとき、最初に頭に浮かぶのはどれですか？',
    options: [
      { label: '損失',       value: 1 },
      { label: '不確かさ',   value: 3 },
      { label: 'チャンス',   value: 5 },
      { label: 'ワクワク感', value: 7 },
    ],
  },
  {
    id: 'T8',
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
    id: 'T9',
    section: 'tolerance',
    title: 'クイズ番組で10万円を獲得しました。次の選択肢から1つ選んでください。',
    options: [
      { label: '確実に5万円もらう',                       value: 1 },
      { label: '50%の確率で10万円、50%の確率で0円',        value: 7 },
    ],
  },
  {
    id: 'T10',
    section: 'tolerance',
    title: '同じクイズ番組で、今度は1,000万円を獲得しました。同じ選択肢です。',
    options: [
      { label: '確実に500万円もらう',                       value: 1 },
      { label: '50%の確率で1,000万円、50%の確率で0円',       value: 7 },
    ],
  },
  {
    id: 'T11',
    section: 'tolerance',
    title: '親戚から1,000万円を相続しました。全額を1つだけに投資するとしたら？',
    options: [
      { label: '預金・MMF',                          value: 1 },
      { label: '株式と債券の混合投資信託',               value: 3 },
      { label: '個別株15銘柄のポートフォリオ',           value: 5 },
      { label: 'コモディティ（金・銀等）',               value: 7 },
    ],
  },
  {
    id: 'T12',
    section: 'tolerance',
    title: '200万円を投資するとしたら、どの配分が一番魅力的ですか？',
    options: [
      { label: '低リスク60% / 中リスク30% / 高リスク10%', value: 1 },
      { label: '低リスク30% / 中リスク40% / 高リスク30%', value: 3 },
      { label: '低リスク10% / 中リスク40% / 高リスク50%', value: 7 },
    ],
  },
  {
    id: 'T13',
    section: 'tolerance',
    title: '信頼できる知人が未上場スタートアップへの出資を誘っています。成功すれば50〜100倍、失敗すれば全損。成功確率20%。いくら出しますか？',
    options: [
      { label: '出資しない',                    value: 1 },
      { label: '少額（余裕資金の5%以内）',       value: 3 },
      { label: 'ある程度（余裕資金の10〜20%）',  value: 5 },
      { label: '積極的に（余裕資金の30%以上）',   value: 7 },
    ],
  },
  {
    id: 'T14',
    section: 'tolerance',
    title: 'リーマンショック級の暴落（資産が40〜50%下落）が来たとき、あなたはどうしますか？',
    options: [
      { label: '早めに売って損失を抑える',   value: 1 },
      { label: '辛いけどひたすら耐える',     value: 3 },
      { label: '何もせず保有し続ける',       value: 5 },
      { label: '買い増す',                  value: 7 },
    ],
  },
  {
    id: 'T15',
    section: 'tolerance',
    title: '過去5年間、年率25%のリターンを出し続けているアクティブファンドがあります。今のインデックスファンドから乗り換えますか？',
    options: [
      { label: 'すぐ乗り換える',               value: 1 },
      { label: '詳しく調べてから乗り換える',     value: 3 },
      { label: '少額だけ試してみる',            value: 5 },
      { label: '乗り換えない',                 value: 7 },
    ],
  },
];

export const DETAIL_CAPACITY_QUESTIONS = RISK_DETAIL_QUESTIONS.filter(q => q.section === 'capacity');
export const DETAIL_TOLERANCE_QUESTIONS = RISK_DETAIL_QUESTIONS.filter(q => q.section === 'tolerance');
export const DETAIL_TOTAL_QUESTIONS = RISK_DETAIL_QUESTIONS.length;
