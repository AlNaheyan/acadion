-- Remove retired calendar credentials and their dependent export records.
delete from public.calendar_connections where provider <> 'google';

alter table public.calendar_connections
  drop constraint if exists calendar_connections_provider_check;

alter table public.calendar_connections
  add constraint calendar_connections_provider_check check (provider = 'google');
