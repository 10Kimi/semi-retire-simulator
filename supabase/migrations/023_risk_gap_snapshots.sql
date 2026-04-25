-- =============================================
-- 011_risk_gap_snapshots.sql
-- リスク許容度（診断レベル）と実PFリスクのギャップ分析用
--
-- 設計方針:
--  - PF診断実行時にスナップショットを1行追記する（時系列分析用）
--  - スケールは 1〜7 に統一（risk_assessment_simple.final_level と一致）
--  - 旧 portfolio_diagnoses.risk_level (1〜5) は変換関数で合わせられる
--  - assessment_source は 'simple' と 'detailed' の両方に対応（詳細版リスク診断が
--    稼働した際も同じテーブルで扱える）
-- =============================================

-- ------------------------------------------------------------
-- 1. 5段階→7段階 変換関数
-- ------------------------------------------------------------
-- portfolio_diagnoses に残っている旧レコード（1〜5）を
-- 統一スケール 1〜7 にマッピングするための関数。
-- マッピング: 1→1, 2→3, 3→4, 4→5, 5→7（両端に重みを寄せる）
create or replace function risk_level_5_to_7(level_5 integer)
returns integer
language sql
immutable
as $$
  select case level_5
    when 1 then 1
    when 2 then 3
    when 3 then 4
    when 4 then 5
    when 5 then 7
    else null
  end;
$$;

comment on function risk_level_5_to_7(integer) is
  '旧 portfolio_diagnoses.risk_level (1〜5) を統一スケール 1〜7 に変換する。新規の書き込みは最初から 1〜7 なので通常は不要。';

-- ------------------------------------------------------------
-- 2. risk_gap_snapshots テーブル
-- ------------------------------------------------------------
create table risk_gap_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- 診断側（どの診断に基づくか）
  assessment_source text not null check (assessment_source in ('simple', 'detailed')),
  assessment_id uuid not null,
  assessment_level_7 integer not null check (assessment_level_7 between 1 and 7),
  assessed_at timestamptz not null,

  -- PF側
  portfolio_diagnosis_id uuid references portfolio_diagnoses(id) on delete cascade not null,
  portfolio_level_7 integer not null check (portfolio_level_7 between 1 and 7),
  portfolio_volatility numeric(5, 2) not null,
  portfolio_expected_return numeric(5, 2) not null,

  -- 派生
  gap_level integer not null,
  gap_direction text generated always as (
    case
      when gap_level > 0 then 'over_risk'
      when gap_level < 0 then 'under_risk'
      else 'aligned'
    end
  ) stored,

  recorded_at timestamptz default now()
);

create index idx_risk_gap_snapshots_user_date on risk_gap_snapshots(user_id, recorded_at desc);
create index idx_risk_gap_snapshots_pf on risk_gap_snapshots(portfolio_diagnosis_id);

alter table risk_gap_snapshots enable row level security;

create policy "Users can read own snapshots"
  on risk_gap_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own snapshots"
  on risk_gap_snapshots for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. 最新ギャップビュー v_latest_risk_gap
-- ------------------------------------------------------------
create view v_latest_risk_gap
with (security_invoker = on)
as
select distinct on (user_id)
  user_id,
  assessment_source,
  assessment_id,
  assessment_level_7,
  assessed_at,
  portfolio_diagnosis_id,
  portfolio_level_7,
  portfolio_volatility,
  portfolio_expected_return,
  gap_level,
  gap_direction,
  recorded_at
from risk_gap_snapshots
order by user_id, recorded_at desc;

comment on view v_latest_risk_gap is
  'ユーザーごとの最新ギャップスナップショット。ダッシュボード・ステップメール分岐での参照用。';

-- ------------------------------------------------------------
-- 4. save_pf_with_snapshot RPC
-- ------------------------------------------------------------
-- portfolio_diagnoses と risk_gap_snapshots の両方に同トランザクションで INSERT する
-- アトミックな保存処理。診断未実施（p_assessment_id IS NULL）の場合は
-- portfolio_diagnoses のみ書き込み、スナップショットはスキップする。
create or replace function save_pf_with_snapshot(
  p_holding_amounts jsonb,
  p_total_amount numeric,
  p_expected_return numeric,
  p_volatility numeric,
  p_risk_level integer,
  p_risk_level_key text,
  p_assessment_risk_level text,
  p_assessment_source text,
  p_assessment_id uuid,
  p_assessment_level_7 integer,
  p_assessed_at timestamptz
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_pf_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1) portfolio_diagnoses に INSERT（生データ保持）
  insert into portfolio_diagnoses (
    user_id,
    holding_amounts,
    total_amount,
    expected_return,
    volatility,
    risk_level,
    risk_level_key,
    assessment_risk_level
  ) values (
    v_uid,
    p_holding_amounts,
    p_total_amount,
    p_expected_return,
    p_volatility,
    p_risk_level,
    p_risk_level_key,
    p_assessment_risk_level
  )
  returning id into v_pf_id;

  -- 2) 診断済みユーザーのみ risk_gap_snapshots にも追記
  if p_assessment_id is not null and p_assessment_level_7 is not null then
    insert into risk_gap_snapshots (
      user_id,
      assessment_source,
      assessment_id,
      assessment_level_7,
      assessed_at,
      portfolio_diagnosis_id,
      portfolio_level_7,
      portfolio_volatility,
      portfolio_expected_return,
      gap_level
    ) values (
      v_uid,
      p_assessment_source,
      p_assessment_id,
      p_assessment_level_7,
      p_assessed_at,
      v_pf_id,
      p_risk_level,
      p_volatility,
      p_expected_return,
      p_risk_level - p_assessment_level_7
    );
  end if;

  return v_pf_id;
end;
$$;

comment on function save_pf_with_snapshot is
  'PF診断をトランザクションで保存する。portfolio_diagnoses に必ず1行、診断済みユーザーのみ risk_gap_snapshots にも1行 INSERT する。';
