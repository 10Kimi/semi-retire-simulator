-- =============================================
-- Portfolio Diagnoses テーブル
-- PF診断ツール（ボトムアップ型）の結果保存用
-- =============================================

create table portfolio_diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  holding_amounts jsonb not null,           -- {"japan_equity": 500, "us_equity": 1000, ...}
  total_amount numeric not null,            -- 合計保有額（万円）
  expected_return numeric(5,2) not null,    -- 期待リターン（%）
  volatility numeric(5,2) not null,         -- ボラティリティ（%）
  risk_level integer not null,              -- リスクレベル（1〜5）
  risk_level_key text not null,             -- 'conservative', 'balanced' 等
  assessment_risk_level text,               -- 診断済みリスクレベル（null = 未診断）
  created_at timestamp with time zone default now()
);

-- インデックス
create index idx_portfolio_diagnoses_user on portfolio_diagnoses(user_id);
create index idx_portfolio_diagnoses_date on portfolio_diagnoses(created_at desc);

-- Row Level Security
alter table portfolio_diagnoses enable row level security;

create policy "Users can read own diagnoses"
  on portfolio_diagnoses for select
  using (auth.uid() = user_id);

create policy "Users can insert own diagnoses"
  on portfolio_diagnoses for insert
  with check (auth.uid() = user_id);
