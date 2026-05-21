
-- Roles enum
create type public.app_role as enum ('admin', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer role checker
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- Plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  monthly_simulation_limit int,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;

insert into public.plans(name, description, monthly_simulation_limit, features)
values ('Teste', 'Plano padrão de avaliação', null, '{"pdf_export": true, "history": true}'::jsonb);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

-- Simulations
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.simulations enable row level security;
create index simulations_user_created_idx on public.simulations(user_id, created_at desc);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions
for each row execute function public.set_updated_at();

-- RLS policies
-- profiles
create policy "Users view own profile" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Admins insert profiles" on public.profiles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Users view own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- plans
create policy "Anyone authenticated reads plans" on public.plans for select to authenticated using (true);
create policy "Admins manage plans" on public.plans for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- subscriptions
create policy "Users view own subscription" on public.subscriptions for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage subscriptions" on public.subscriptions for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- simulations
create policy "Users view own simulations" on public.simulations for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users insert own simulations" on public.simulations for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users delete own simulations" on public.simulations for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- New user trigger: profile + default plan + admin role if matches email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare default_plan_id uuid;
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  select id into default_plan_id from public.plans where name = 'Teste' limit 1;
  if default_plan_id is not null then
    insert into public.subscriptions(user_id, plan_id) values (new.id, default_plan_id)
    on conflict (user_id) do nothing;
  end if;

  if new.email = 'dalviseguroprev@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  end if;

  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
