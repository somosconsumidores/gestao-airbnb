create schema if not exists extensions;
alter extension btree_gist set schema extensions;

create index expenses_organization_property_idx
  on public.expenses (organization_id, property_id)
  where property_id is not null;

create index notification_events_organization_reservation_idx
  on public.notification_events (organization_id, reservation_id)
  where reservation_id is not null;

create index operational_tasks_organization_property_idx
  on public.operational_tasks (organization_id, property_id)
  where property_id is not null;

create index operational_tasks_organization_reservation_idx
  on public.operational_tasks (organization_id, reservation_id)
  where reservation_id is not null;

create index reservation_guests_organization_reservation_idx
  on public.reservation_guests (organization_id, reservation_id);

create index reservations_organization_property_idx
  on public.reservations (organization_id, property_id);
