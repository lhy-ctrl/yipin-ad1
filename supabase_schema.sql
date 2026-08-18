-- ============================================
-- 易品广告记账系统 - Supabase 建表脚本
-- 请在 Supabase 项目的 SQL Editor 中执行
-- ============================================

-- 启用 UUID 扩展（用于生成ID）
create extension if not exists "pgcrypto";

-- ============================================
-- 1. 客户表
-- ============================================
create table if not exists public.customers (
  id text primary key,
  name text not null,
  contact text default '',
  phone text default '',
  address text default '',
  vip_type text default 'normal',
  created_at timestamptz default now()
);

-- ============================================
-- 2. 账单表（明细用 jsonb 存储）
-- ============================================
create table if not exists public.bills (
  id text primary key,
  customer_id text not null,
  date text default '',
  year integer,
  status text default 'unpaid',
  total numeric default 0,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- 为已有表添加year列（如果不存在）
alter table public.bills add column if not exists year integer;
-- 从date字段填充year
update public.bills set year = cast(substring(date from 1 for 4) as integer) where date ~ '^\d{4}[-/]' and year is null;
update public.bills set year = extract(year from created_at)::integer where year is null;

-- ============================================
-- 3. 项目库表
-- ============================================
create table if not exists public.projects (
  id text primary key,
  name text not null,
  price numeric default 0,
  cost numeric default 0,
  vip1_discount numeric default 1.0,
  vip2_discount numeric default 1.0,
  vip3_discount numeric default 1.0,
  created_at timestamptz default now()
);

-- ============================================
-- 4. 自动备份表
-- ============================================
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  customer_count integer default 0,
  bill_count integer default 0,
  project_count integer default 0,
  created_at timestamptz default now()
);

-- ============================================
-- 启用行级安全（RLS）
-- ============================================
alter table public.customers enable row level security;
alter table public.bills enable row level security;
alter table public.projects enable row level security;
alter table public.backups enable row level security;

-- ============================================
-- RLS 策略：只允许认证用户读写
-- ============================================
create policy "认证用户可读客户" on public.customers
  for select using (auth.role() = 'authenticated');

create policy "认证用户可写客户" on public.customers
  for insert with check (auth.role() = 'authenticated');

create policy "认证用户可更新客户" on public.customers
  for update using (auth.role() = 'authenticated');

create policy "认证用户可删除客户" on public.customers
  for delete using (auth.role() = 'authenticated');

create policy "认证用户可读账单" on public.bills
  for select using (auth.role() = 'authenticated');

create policy "认证用户可写账单" on public.bills
  for insert with check (auth.role() = 'authenticated');

create policy "认证用户可更新账单" on public.bills
  for update using (auth.role() = 'authenticated');

create policy "认证用户可删除账单" on public.bills
  for delete using (auth.role() = 'authenticated');

create policy "认证用户可读项目" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "认证用户可写项目" on public.projects
  for insert with check (auth.role() = 'authenticated');

create policy "认证用户可更新项目" on public.projects
  for update using (auth.role() = 'authenticated');

create policy "认证用户可删除项目" on public.projects
  for delete using (auth.role() = 'authenticated');

create policy "认证用户可读备份" on public.backups
  for select using (auth.role() = 'authenticated');

create policy "认证用户可写备份" on public.backups
  for insert with check (auth.role() = 'authenticated');

create policy "认证用户可删除备份" on public.backups
  for delete using (auth.role() = 'authenticated');

-- ============================================
-- 完成提示
-- ============================================
-- 执行完成后，请在 Supabase 后台：
-- 1. Authentication → Users → Add user → 创建你的登录邮箱和密码
-- 2. Project Settings → API → 复制 Project URL 和 anon public key
-- 3. 把 URL 和 key 填入应用的配置中
