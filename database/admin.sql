-- Apply after schema.sql. All administration goes through the authenticated server.
create table public.prank_video_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 request_key uuid not null, title text not null check(length(title) between 3 and 100),
 details text not null check(length(details) between 10 and 2000),
 contact text not null check(length(contact) between 3 and 200),
 state text not null default 'pending' check(state in ('pending','accepted','completed','declined')),
 admin_note text not null default '' check(length(admin_note)<=1000), reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,request_key)
);
create index prank_video_user on public.prank_video_requests(user_id,created_at desc);
create table public.prank_referrals (
 user_id uuid primary key references auth.users(id), referrer_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), check(user_id<>referrer_id)
);
create index prank_referrer on public.prank_referrals(referrer_id);
alter table public.prank_video_requests enable row level security;
alter table public.prank_referrals enable row level security;
revoke all on public.prank_video_requests,public.prank_referrals from anon,authenticated;
grant all on public.prank_video_requests,public.prank_referrals to service_role;
grant select on public.prank_video_requests,public.prank_referrals to authenticated;
create policy own_requests on public.prank_video_requests for select to authenticated using ((select auth.uid())=user_id);
create policy own_referrals on public.prank_referrals for select to authenticated using ((select auth.uid()) in (user_id,referrer_id));

create function public.prank_admin_overview() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'users',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
 'activeUsers',(select count(*) from auth.users where last_sign_in_at>now()-interval '30 days'),
 'balance',(select coalesce(sum(balance_cents),0)/100.0 from public.prank_wallets),
 'revenue',(select -coalesce(sum(delta_cents),0)/100.0 from public.prank_ledger where kind in ('transfer_fee','fee_refund')),
 'transactions',(select count(*) from public.prank_transfers where state<>'pending'),
 'deposits',(select coalesce(sum(usd_cents),0)/100.0 from public.prank_deposits where state='credited'),
 'referrals',(select count(*) from public.prank_referrals),
 'pendingRequests',(select count(*) from public.prank_video_requests where state='pending'),
 'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.day),'[]'::jsonb) from (
 select day::date as day,coalesce(-sum(l.delta_cents),0)/100.0 as revenue from generate_series(current_date-13,current_date,'1 day') day
 left join public.prank_ledger l on l.created_at>=day and l.created_at<day+interval '1 day' and l.kind in ('transfer_fee','fee_refund') group by day) d));
$$;
create function public.prank_admin_users(p_page integer) returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from (
 select a.id,a.email,a.created_at,a.last_sign_in_at,a.email_confirmed_at,
 coalesce(w.balance_cents,0)/100.0 as balance,
 (select count(*) from public.prank_referrals r where r.referrer_id=a.id) as referrals
 from auth.users a left join public.prank_wallets w on w.user_id=a.id
 where not coalesce(a.is_anonymous,false) order by a.created_at desc,a.id limit 50 offset greatest(p_page-1,0)*50) u;
$$;
revoke all on function public.prank_admin_overview(),public.prank_admin_users(integer) from public,anon,authenticated;
grant execute on function public.prank_admin_overview(),public.prank_admin_users(integer) to service_role;
