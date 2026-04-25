/**
 * 匿名シミュレーションログ DB クライアント
 *
 * simulation_logs テーブル（migration 024）への書き込み専用。
 * RLS で INSERT のみ anon キーから許可、SELECT は service_role 限定。
 *
 * 呼び出しは fire-and-forget（UI 阻害しない）。
 * IP・User-Agent は送らない。referrer はホスト名のみ。
 */

import { supabase } from './supabase';
import { getAnonSessionId, getReferrerHost } from './anonSession';

export type SimulationLogInput = {
  /** ツールパス。例: '/risk', '/pf', '/tools/simulation' */
  toolPath: string;
  /** イベント種別。例: 'page_view', 'simulation_complete', 'cta_click' */
  eventType: string;
  /** ツール固有の入出力サマリ等。匿名化済み数値・カテゴリのみ。省略可 */
  payload?: Record<string, unknown>;
};

/**
 * 匿名ログを 1 件挿入する。
 * 失敗時は console.error にログを残し、呼び出し側に例外は伝播させない（fire-and-forget）。
 */
export async function logSimulationEvent(input: SimulationLogInput): Promise<void> {
  try {
    const { error } = await supabase.from('simulation_logs').insert({
      anon_session_id: getAnonSessionId(),
      tool_path: input.toolPath,
      event_type: input.eventType,
      payload: input.payload ?? null,
      referrer_host: getReferrerHost(),
    });
    if (error) {
      console.error('Failed to insert simulation log:', error);
    }
  } catch (e) {
    console.error('Failed to insert simulation log (network):', e);
  }
}
