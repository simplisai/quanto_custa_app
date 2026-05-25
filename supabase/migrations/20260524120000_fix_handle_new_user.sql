
-- Fix handle_new_user() function to remove ON CONFLICT which causes errors
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare default_plan_id uuid;
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  select id into default_plan_id from public.plans where name = 'Teste' limit 1;
  if default_plan_id is not null then
    insert into public.subscriptions(user_id, plan_id) values (new.id, default_plan_id);
  end if;

  if new.email = 'dalviseguroprev@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
    insert into public.user_roles(user_id, role) values (new.id, 'user');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'user');
  end if;

  return new;
end $$;
