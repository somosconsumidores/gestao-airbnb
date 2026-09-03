create table public.cash_adjustments (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 2 and 240),
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  occurred_at timestamptz not null,
  notes text,
  source_key text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

create index cash_adjustments_organization_date_idx
  on public.cash_adjustments (organization_id, occurred_at desc);

create trigger cash_adjustments_set_updated_at
  before update on public.cash_adjustments
  for each row execute function private.set_updated_at();

alter table public.cash_adjustments enable row level security;

create policy cash_adjustments_select_members
  on public.cash_adjustments for select to authenticated
  using ((select private.is_organization_member(organization_id)));

create policy cash_adjustments_insert_members
  on public.cash_adjustments for insert to authenticated
  with check (
    (select private.is_organization_member(organization_id))
    and created_by = (select auth.uid())
  );

create policy cash_adjustments_update_members
  on public.cash_adjustments for update to authenticated
  using ((select private.is_organization_member(organization_id)))
  with check ((select private.is_organization_member(organization_id)));

create policy cash_adjustments_delete_members
  on public.cash_adjustments for delete to authenticated
  using ((select private.is_organization_member(organization_id)));

revoke all on public.cash_adjustments from anon;
grant select, insert, update, delete on public.cash_adjustments to authenticated;
grant usage, select on sequence public.cash_adjustments_id_seq to authenticated;

insert into public.cash_adjustments (
  organization_id,
  description,
  entry_type,
  amount,
  occurred_at,
  notes,
  source_key
)
select
  organizations.id,
  'Ajuste extraordinário',
  'income',
  1919.00,
  timestamptz '2026-09-03 00:00:00-03',
  'Ajuste informado para conciliar o saldo bancário em R$ 1.064.',
  'opening-adjustment-2026-09-03'
from public.organizations
where organizations.name = 'Gestão Airbnb Sandro & Joana'
on conflict (organization_id, source_key) do nothing;
