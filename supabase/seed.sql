insert into public.organizations (id, name) overriding system value
values (1, 'Gestão Airbnb Sandro & Joana')
on conflict (id) do update set name = excluded.name;

insert into public.properties (id, organization_id, name, address, color, status) overriding system value
values
  (1, 1, 'Apt Ataulfo de Paiva', 'Leblon, Rio de Janeiro', '#E65C00', 'active'),
  (2, 1, 'Apt Bartolomeu Mitre', 'Leblon, Rio de Janeiro', '#2F6B5F', 'active'),
  (3, 1, 'Studio Gávea', 'Gávea, Rio de Janeiro', '#7C5C9E', 'active')
on conflict (id) do update set name = excluded.name, address = excluded.address, color = excluded.color, status = excluded.status;

select setval(pg_get_serial_sequence('public.organizations', 'id'), greatest((select max(id) from public.organizations), 1));
select setval(pg_get_serial_sequence('public.properties', 'id'), greatest((select max(id) from public.properties), 1));
