alter table public.expenses
  add column expense_type text not null default 'one_time',
  add column recurrence_day smallint,
  add column active boolean not null default true,
  add constraint expenses_type_check check (expense_type in ('one_time', 'recurring')),
  add constraint expenses_recurrence_check check (
    (expense_type = 'recurring' and recurrence_day between 1 and 31)
    or (expense_type = 'one_time' and recurrence_day is null)
  );

create index expenses_recurring_active_idx
  on public.expenses (organization_id, recurrence_day)
  where expense_type = 'recurring' and active;

comment on column public.expenses.incurred_on is
  'Data da despesa pontual ou data inicial de vigência da despesa recorrente.';
comment on column public.expenses.recurrence_day is
  'Dia do mês usado para projetar despesas recorrentes; limitado de 1 a 31.';

with initial_expenses(description, amount, category, recurrence_day) as (
  values
    ('Pagamento Debora', 1210.00::numeric, 'other', 1),
    ('Plano de Saúde', 2145.00::numeric, 'other', 2),
    ('Van Liessin', 1109.00::numeric, 'other', 3),
    ('Condomínio Dona Nina', 2183.00::numeric, 'maintenance', 5),
    ('Assinaturas', 450.00::numeric, 'other', 5),
    ('Flamengo', 1200.00::numeric, 'other', 6),
    ('Lea Faxina', 350.00::numeric, 'cleaning', 7),
    ('Cartão C6', 12000.00::numeric, 'other', 8),
    ('Condominio Novo Rio', 1352.00::numeric, 'maintenance', 10),
    ('Light Bartolomeu', 300.00::numeric, 'utilities', 12),
    ('Liessin', 6679.00::numeric, 'other', 13),
    ('Lea Faxina', 350.00::numeric, 'cleaning', 14),
    ('CEG', 725.00::numeric, 'utilities', 15),
    ('Pagamento Debora', 900.00::numeric, 'other', 16),
    ('Condomínio Studio', 1400.00::numeric, 'maintenance', 17),
    ('Lea Faxina', 350.00::numeric, 'cleaning', 21),
    ('Light Ataulfo', 800.00::numeric, 'utilities', 27),
    ('Lea Faxina', 350.00::numeric, 'cleaning', 28)
)
insert into public.expenses (
  organization_id,
  description,
  category,
  amount,
  incurred_on,
  expense_type,
  recurrence_day,
  notes
)
select
  organizations.id,
  initial_expenses.description,
  initial_expenses.category,
  initial_expenses.amount,
  date '2026-09-01' + (initial_expenses.recurrence_day - 1),
  'recurring',
  initial_expenses.recurrence_day,
  'Cadastro inicial de Finanças Pessoais'
from public.organizations
cross join initial_expenses
where organizations.name = 'Gestão Airbnb Sandro & Joana'
  and not exists (
    select 1
    from public.expenses existing
    where existing.organization_id = organizations.id
      and existing.notes = 'Cadastro inicial de Finanças Pessoais'
  );
