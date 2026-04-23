/**
 * schema.org 構造化データのファクトリ関数
 *
 * JsonLd コンポーネントに渡す JSON オブジェクトを生成する。
 * 用途:
 *   - SoftwareApplication: 各診断ツール/シミュレーションツールに付与（ツール性の明示）
 *   - Organization: サイト運営主体の明示（E-E-A-T 補強、/about で出す）
 *   - BreadcrumbList: パンくずリスト（内部リンク構造の機械可読化、LP・ツールページで使用）
 */

const ORIGIN = 'https://fire.largogk.jp'

/**
 * 運営組織スキーマ（合同会社ラルゴ）
 * /about や index.html レベルで1回出せば十分。全ページで重複させない。
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '合同会社ラルゴ',
  url: ORIGIN,
  logo: `${ORIGIN}/logo.png`,
  // Phase 1 以降で X・note アカウント URL を sameAs に追加予定
  sameAs: [] as string[],
}

export type SoftwareApplicationParams = {
  /** ツール名（例: "資産運用シミュレーター"） */
  name: string
  /** ツール説明（120文字前後推奨） */
  description: string
  /** ツールのURL（origin からの相対パス、例: "/tools/simulation"） */
  url: string
  /** applicationCategory、デフォルト "FinanceApplication" */
  category?: string
}

/**
 * SoftwareApplication スキーマ（無料ツール前提、price=0）
 * 有料ツール（/ma, /rb, /portfolio）には別途価格設定したバージョンを作る必要あり。
 */
export function softwareApplicationSchema(
  params: SoftwareApplicationParams,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: params.name,
    description: params.description,
    url: `${ORIGIN}${params.url}`,
    applicationCategory: params.category ?? 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    provider: {
      '@type': 'Organization',
      name: '合同会社ラルゴ',
      url: ORIGIN,
    },
  }
}

export type BreadcrumbItem = {
  /** 表示名（例: "ツール", "資産運用シミュレーション"） */
  name: string
  /** origin からの相対パス。末尾（現在地）は省略可（機械可読な末尾リンクは不要） */
  path?: string
}

/**
 * BreadcrumbList スキーマ
 * 末尾の現在地には path を渡さないこと（position が正しく付与される）。
 */
export function breadcrumbListSchema(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      ...(item.path ? { item: `${ORIGIN}${item.path}` } : {}),
    })),
  }
}
