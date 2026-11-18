-- ============================================================
-- 044: /pf は割合だけを保存し、金額を消す（FI_project #110、D-065）
-- ============================================================
-- 利用者の金額（円・万円）はサーバーに置かない。portfolio_diagnoses の
-- holding_amounts（資産クラス別の保有額）・total_amount（合計）を
-- holding_weights（資産クラス別の割合 %、合計100）に置き換えてから消す。
--
-- 適用はオーナーが Mac で `supabase db push`（D-032）。1 つのトランザクションで流れる。
-- 適用したあと、新しいアプリのコード（save_pf_weights_with_snapshot を呼ぶ）を push する。
-- 適用からコードの反映までのあいだ、古い画面の /pf の保存は失敗する
-- （保存は fire-and-forget なので画面の結果は出る。金額は書かれない）。
--
-- 注意：消した金額も Supabase のバックアップには保持期間のあいだ残る（D-065 前提 (d)）。

-- 1) 割合の列を足し、金額の列の NOT NULL を外す
alter table portfolio_diagnoses add column if not exists holding_weights jsonb;
alter table portfolio_diagnoses alter column holding_amounts drop not null;
alter table portfolio_diagnoses alter column total_amount drop not null;

comment on column portfolio_diagnoses.holding_weights is
  '資産クラス別の割合（%、小数4桁、合計100）。0 のクラスは入れない。金額は保存しない（D-065）';
comment on column portfolio_diagnoses.holding_amounts is
  '廃止（044 以降つねに null）。金額は保存しない（D-065）';
comment on column portfolio_diagnoses.total_amount is
  '廃止（044 以降つねに null）。金額は保存しない（D-065）';

-- 2) 既存の行の保有額を割合に置き換える
--    合計は total_amount ではなく保有額の和から出す（食い違っていても割合の合計が100になる）
--    異常値（オブジェクトでない・数でない値）があっても止まらないよう、
--    キャストは case で型を確かめてから行う（AND の評価順に頼らない）
update portfolio_diagnoses d
set holding_weights = coalesce((
  select jsonb_object_agg(v.key, round(v.amount / s.total * 100, 4))
  from (
    select e.key,
           case when jsonb_typeof(e.value) = 'number' then (e.value)::numeric end as amount
    from jsonb_each(
      case when jsonb_typeof(d.holding_amounts) = 'object' then d.holding_amounts else '{}'::jsonb end
    ) e
  ) v
  cross join (
    select sum(greatest(
             case when jsonb_typeof(x.value) = 'number' then (x.value)::numeric end, 0
           )) as total
    from jsonb_each(
      case when jsonb_typeof(d.holding_amounts) = 'object' then d.holding_amounts else '{}'::jsonb end
    ) x
  ) s
  where v.amount > 0
    and s.total > 0
), '{}'::jsonb)
where d.holding_weights is null;

-- 3) 金額を消す
update portfolio_diagnoses
set holding_amounts = null,
    total_amount = null
where holding_amounts is not null or total_amount is not null;

-- 4) これからも金額が入らないようにする（直接の INSERT も含めて弾く）
alter table portfolio_diagnoses alter column holding_weights set not null;
alter table portfolio_diagnoses
  add constraint portfolio_diagnoses_no_amounts
  check (holding_amounts is null and total_amount is null);

-- 5) 金額を受け取る旧 RPC を消す
drop function if exists save_pf_with_snapshot(
  jsonb, numeric, numeric, numeric, integer, text, text, text, uuid, integer, timestamptz
);

-- 6) 割合だけを受け取る RPC
--    割合の形でないもの（数でない・0〜100 の外・合計が 99.9〜100.1 の外。空は可）は弾く。
--    金額を間違って送ったときにサーバーに残さないため。
create or replace function save_pf_weights_with_snapshot(
  p_holding_weights jsonb,
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
  v_sum numeric;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_holding_weights is null or jsonb_typeof(p_holding_weights) <> 'object' then
    raise exception 'holding_weights must be an object';
  end if;

  if exists (
    select 1 from jsonb_each(p_holding_weights) e
    where jsonb_typeof(e.value) <> 'number'
  ) then
    raise exception 'holding_weights must be numbers';
  end if;

  if exists (
    select 1 from jsonb_each(p_holding_weights) e
    where (e.value)::numeric < 0 or (e.value)::numeric > 100
  ) then
    raise exception 'holding_weights must be percentages (0-100)';
  end if;

  select count(*), coalesce(sum((e.value)::numeric), 0) into v_count, v_sum
  from jsonb_each(p_holding_weights) e;
  if v_count > 0 and (v_sum < 99.9 or v_sum > 100.1) then
    raise exception 'holding_weights must sum to 100';
  end if;

  insert into portfolio_diagnoses (
    user_id,
    holding_weights,
    expected_return,
    volatility,
    risk_level,
    risk_level_key,
    assessment_risk_level
  ) values (
    v_uid,
    p_holding_weights,
    p_expected_return,
    p_volatility,
    p_risk_level,
    p_risk_level_key,
    p_assessment_risk_level
  )
  returning id into v_pf_id;

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

revoke all on function save_pf_weights_with_snapshot(
  jsonb, numeric, numeric, integer, text, text, text, uuid, integer, timestamptz
) from public, anon;
grant execute on function save_pf_weights_with_snapshot(
  jsonb, numeric, numeric, integer, text, text, text, uuid, integer, timestamptz
) to authenticated;

comment on function save_pf_weights_with_snapshot is
  'PF診断を割合と指標だけで保存する（金額は受け取らない、D-065）。portfolio_diagnoses に必ず1行、診断済みユーザーのみ risk_gap_snapshots にも1行 INSERT する。';
