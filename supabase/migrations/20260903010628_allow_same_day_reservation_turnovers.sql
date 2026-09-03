alter table public.reservations
  drop constraint reservations_no_overlap;

alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    property_id with =,
    daterange(
      (checkin_at at time zone 'America/Sao_Paulo')::date,
      (checkout_at at time zone 'America/Sao_Paulo')::date,
      '[)'
    ) with &&
  )
  where (status <> 'cancelled');
