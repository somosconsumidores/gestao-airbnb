alter table public.expenses
  add constraint expenses_organization_id_id_key unique (organization_id, id);

create table public.expense_monthly_overrides (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  expense_id bigint not null,
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(12,2) not null check (amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_monthly_overrides_expense_fkey
    foreign key (organization_id, expense_id)
    references public.expenses(organization_id, id) on delete cascade,
  unique (organization_id, expense_id, month)
);

create index expense_monthly_overrides_created_by_idx
  on public.expense_monthly_overrides (created_by)
  where created_by is not null;

create trigger expense_monthly_overrides_set_updated_at
  before update on public.expense_monthly_overrides
  for each row execute function private.set_updated_at();

alter table public.expense_monthly_overrides enable row level security;

create policy expense_monthly_overrides_select_members
  on public.expense_monthly_overrides for select to authenticated
  using ((select private.is_organization_member(organization_id)));

create policy expense_monthly_overrides_insert_members
  on public.expense_monthly_overrides for insert to authenticated
  with check (
    (select private.is_organization_member(organization_id))
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.expenses
      where expenses.id = expense_monthly_overrides.expense_id
        and expenses.organization_id = expense_monthly_overrides.organization_id
        and expenses.expense_type = 'recurring'
    )
  );

create policy expense_monthly_overrides_update_members
  on public.expense_monthly_overrides for update to authenticated
  using ((select private.is_organization_member(organization_id)))
  with check (
    (select private.is_organization_member(organization_id))
    and exists (
      select 1 from public.expenses
      where expenses.id = expense_monthly_overrides.expense_id
        and expenses.organization_id = expense_monthly_overrides.organization_id
        and expenses.expense_type = 'recurring'
    )
  );

create policy expense_monthly_overrides_delete_members
  on public.expense_monthly_overrides for delete to authenticated
  using ((select private.is_organization_member(organization_id)));

revoke all on public.expense_monthly_overrides from anon;
grant select, insert, update, delete on public.expense_monthly_overrides to authenticated;
grant usage, select on sequence public.expense_monthly_overrides_id_seq to authenticated;
