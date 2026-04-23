/**
 * JsonLd — 構造化データ（schema.org）を注入する共通コンポーネント
 *
 * React 19 は <script type="application/ld+json"> を JSX に書くと
 * そのまま HTML に出力される（head hoisting は <script> には適用されない点に注意）。
 * body 内に出力されるが、Google / 各種クローラーは body 内の JSON-LD も正しく解釈する。
 *
 * 使用例:
 *   <JsonLd data={softwareApplicationSchema({...})} />
 *   <JsonLd data={breadcrumbListSchema([...])} />
 */

type Props = {
  data: Record<string, unknown>
}

export function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify は既にエスケープ済み文字列を返すため XSS 安全
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
