create index cash_adjustments_created_by_idx
  on public.cash_adjustments (created_by)
  where created_by is not null;
