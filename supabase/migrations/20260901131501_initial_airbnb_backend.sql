create extension if not exists btree_gist;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.organization_members (
  organization_id bigint not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role text not null default 'admin' check (role in ('admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id, organization_id);

create or replace function private.is_organization_member(target_organization_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_organization_member(bigint) from public, anon;
grant execute on function private.is_organization_member(bigint) to authenticated, service_role;

create table public.properties (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  address text not null check (char_length(trim(address)) between 5 and 500),
  color text not null default '#E65C00' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);
create index properties_organization_status_idx on public.properties (organization_id, status);
create index properties_created_by_idx on public.properties (created_by) where created_by is not null;

create table public.reservations (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  property_id bigint not null,
  primary_guest_name text not null check (char_length(trim(primary_guest_name)) between 2 and 160),
  guest_phone text,
  stay_amount numeric(12,2) not null check (stay_amount >= 0),
  checkin_at timestamptz not null,
  checkout_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_valid_period check (checkout_at > checkin_at),
  constraint reservations_property_fkey foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade,
  constraint reservations_organization_id_id_key unique (organization_id, id),
  constraint reservations_no_overlap exclude using gist (
    property_id with =,
    tstzrange(checkin_at, checkout_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index reservations_organization_checkin_idx on public.reservations (organization_id, checkin_at desc);
create index reservations_property_checkin_idx on public.reservations (property_id, checkin_at desc);
create index reservations_upcoming_idx on public.reservations (organization_id, checkin_at) where status in ('pending', 'confirmed');
create index reservations_created_by_idx on public.reservations (created_by) where created_by is not null;

create table public.reservation_guests (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  reservation_id bigint not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  created_at timestamptz not null default now(),
  constraint reservation_guests_reservation_fkey foreign key (organization_id, reservation_id)
    references public.reservations(organization_id, id) on delete cascade
);
create index reservation_guests_reservation_id_idx on public.reservation_guests (reservation_id);
create index reservation_guests_organization_id_idx on public.reservation_guests (organization_id);

create table public.notification_recipients (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index notification_recipients_enabled_idx on public.notification_recipients (organization_id) where enabled;

create table public.expenses (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  property_id bigint,
  description text not null check (char_length(trim(description)) between 2 and 240),
  category text not null check (category in ('cleaning', 'maintenance', 'utilities', 'taxes', 'platform_fee', 'supplies', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  incurred_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_property_fkey foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade
);
create index expenses_organization_date_idx on public.expenses (organization_id, incurred_on desc);
create index expenses_property_date_idx on public.expenses (property_id, incurred_on desc) where property_id is not null;
create index expenses_created_by_idx on public.expenses (created_by) where created_by is not null;

create table public.operational_tasks (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  property_id bigint,
  reservation_id bigint,
  title text not null check (char_length(trim(title)) between 2 and 180),
  task_type text not null check (task_type in ('checkin', 'checkout', 'cleaning', 'maintenance', 'inspection', 'other')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_tasks_completion_check check ((status = 'completed') = (completed_at is not null)),
  constraint operational_tasks_property_fkey foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade,
  constraint operational_tasks_reservation_fkey foreign key (organization_id, reservation_id)
    references public.reservations(organization_id, id) on delete cascade
);
create index operational_tasks_organization_due_idx on public.operational_tasks (organization_id, status, due_at);
create index operational_tasks_property_id_idx on public.operational_tasks (property_id) where property_id is not null;
create index operational_tasks_reservation_id_idx on public.operational_tasks (reservation_id) where reservation_id is not null;
create index operational_tasks_assigned_to_idx on public.operational_tasks (assigned_to) where assigned_to is not null;
create index operational_tasks_created_by_idx on public.operational_tasks (created_by) where created_by is not null;

create table public.notification_events (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  reservation_id bigint,
  event_type text not null check (event_type in ('reservation_created', 'checkin_reminder', 'checkout_reminder', 'manual')),
  recipient_email text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  constraint notification_events_reservation_fkey foreign key (organization_id, reservation_id)
    references public.reservations(organization_id, id) on delete set null (reservation_id)
);
create index notification_events_organization_created_idx on public.notification_events (organization_id, created_at desc);
create index notification_events_reservation_id_idx on public.notification_events (reservation_id) where reservation_id is not null;

create schema if not exists extensions;
alter extension btree_gist set schema extensions;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger properties_set_updated_at before update on public.properties for each row execute function private.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations for each row execute function private.set_updated_at();
create trigger notification_recipients_set_updated_at before update on public.notification_recipients for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function private.set_updated_at();
create trigger operational_tasks_set_updated_at before update on public.operational_tasks for each row execute function private.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_guests enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.expenses enable row level security;
alter table public.operational_tasks enable row level security;
alter table public.notification_events enable row level security;

create policy organizations_select_members on public.organizations for select to authenticated using ((select private.is_organization_member(id)));
create policy organization_members_select_members on public.organization_members for select to authenticated using ((select private.is_organization_member(organization_id)));

create policy properties_select_members on public.properties for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy properties_insert_members on public.properties for insert to authenticated with check ((select private.is_organization_member(organization_id)) and created_by = (select auth.uid()));
create policy properties_update_members on public.properties for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy properties_delete_members on public.properties for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy reservations_select_members on public.reservations for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy reservations_insert_members on public.reservations for insert to authenticated with check ((select private.is_organization_member(organization_id)) and created_by = (select auth.uid()));
create policy reservations_update_members on public.reservations for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy reservations_delete_members on public.reservations for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy reservation_guests_select_members on public.reservation_guests for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy reservation_guests_insert_members on public.reservation_guests for insert to authenticated with check ((select private.is_organization_member(organization_id)));
create policy reservation_guests_update_members on public.reservation_guests for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy reservation_guests_delete_members on public.reservation_guests for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy notification_recipients_select_members on public.notification_recipients for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy notification_recipients_insert_members on public.notification_recipients for insert to authenticated with check ((select private.is_organization_member(organization_id)));
create policy notification_recipients_update_members on public.notification_recipients for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy notification_recipients_delete_members on public.notification_recipients for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy expenses_select_members on public.expenses for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy expenses_insert_members on public.expenses for insert to authenticated with check ((select private.is_organization_member(organization_id)) and created_by = (select auth.uid()));
create policy expenses_update_members on public.expenses for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy expenses_delete_members on public.expenses for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy operational_tasks_select_members on public.operational_tasks for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy operational_tasks_insert_members on public.operational_tasks for insert to authenticated with check ((select private.is_organization_member(organization_id)) and created_by = (select auth.uid()));
create policy operational_tasks_update_members on public.operational_tasks for update to authenticated using ((select private.is_organization_member(organization_id))) with check ((select private.is_organization_member(organization_id)));
create policy operational_tasks_delete_members on public.operational_tasks for delete to authenticated using ((select private.is_organization_member(organization_id)));

create policy notification_events_select_members on public.notification_events for select to authenticated using ((select private.is_organization_member(organization_id)));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.organizations, public.organization_members, public.notification_events to authenticated;
grant select, insert, update, delete on public.properties, public.reservations, public.reservation_guests, public.notification_recipients, public.expenses, public.operational_tasks to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy property_images_select_members on storage.objects for select to authenticated using (bucket_id = 'property-images' and (select private.is_organization_member((storage.foldername(name))[1]::bigint)));
create policy property_images_insert_members on storage.objects for insert to authenticated with check (bucket_id = 'property-images' and (select private.is_organization_member((storage.foldername(name))[1]::bigint)) and owner_id = (select auth.uid()::text));
create policy property_images_update_members on storage.objects for update to authenticated using (bucket_id = 'property-images' and (select private.is_organization_member((storage.foldername(name))[1]::bigint))) with check (bucket_id = 'property-images' and (select private.is_organization_member((storage.foldername(name))[1]::bigint)));
create policy property_images_delete_members on storage.objects for delete to authenticated using (bucket_id = 'property-images' and (select private.is_organization_member((storage.foldername(name))[1]::bigint)));
