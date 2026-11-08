-- Apply after admin.sql. Customer deposits and admin credits are reported separately.
create table public.prank_account_controls (
 user_id uuid primary key references auth.users(id),
 state text not null check(state in ('active','suspended','blocked')),
 reason text not null check(length(reason) between 5 and 500),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.prank_admin_credits (
 id uuid primary key, user_id uuid not null references auth.users(id),
 admin_id uuid not null references auth.users(id), amount_cents bigint not null check(amount_cents between 1 and 100000000),
 reason text not null check(length(reason) between 5 and 500), created_at timestamptz not null default now()
);
create index prank_admin_credits_user on public.prank_admin_credits(user_id,created_at desc);
alter table public.prank_account_controls enable row level security;
alter table public.prank_admin_credits enable row level security;
revoke all on public.prank_account_controls,public.prank_admin_credits from anon,authenticated;
grant all on public.prank_account_controls,public.prank_admin_credits to service_role;
alter table public.prank_ledger drop constraint prank_ledger_kind_check;
alter table public.prank_ledger add constraint prank_ledger_kind_check check(kind in ('deposit','transfer_fee','fee_refund','admin_credit'));

create function public.prank_admin_credit(p_admin uuid,p_user uuid,p_id uuid,p_amount bigint,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.prank_admin_credits; b bigint;
begin
 if p_admin=p_user then raise exception 'Administrators cannot top up their own wallet.'; end if;
 if p_amount is null or p_amount<1 or p_amount>100000000 or p_reason is null or length(trim(p_reason))<5 or length(p_reason)>500 then raise exception 'Check the amount and reason.'; end if;
 insert into public.prank_wallets(user_id) values(p_user) on conflict do nothing;
 -- Serialize changes to this wallet, including retries of the same credit.
 select balance_cents into b from public.prank_wallets where user_id=p_user for update;
 select * into c from public.prank_admin_credits where id=p_id;
 if found then
  if c.user_id<>p_user or c.admin_id<>p_admin or c.amount_cents<>p_amount or c.reason<>p_reason then raise exception 'Request key already used for another credit.'; end if;
 else
  insert into public.prank_admin_credits(id,user_id,admin_id,amount_cents,reason) values(p_id,p_user,p_admin,p_amount,p_reason);
  update public.prank_wallets set balance_cents=balance_cents+p_amount where user_id=p_user returning balance_cents into b;
  insert into public.prank_ledger(user_id,delta_cents,kind,reference_id) values(p_user,p_amount,'admin_credit',p_id);
 end if;
 return jsonb_build_object('balance',b/100.0,'id',p_id);
end $$;
revoke all on function public.prank_admin_credit(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.prank_admin_credit(uuid,uuid,uuid,bigint,text) to service_role;

create or replace function public.prank_admin_users(p_page integer) returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from (
 select a.id,a.email,a.created_at,a.last_sign_in_at,a.email_confirmed_at,
 coalesce(w.balance_cents,0)/100.0 as balance,coalesce(c.state,'active') as account_state,c.reason as account_reason,
 (select count(*) from public.prank_referrals r where r.referrer_id=a.id) as referrals
 from auth.users a left join public.prank_wallets w on w.user_id=a.id left join public.prank_account_controls c on c.user_id=a.id
 where not coalesce(a.is_anonymous,false) order by a.created_at desc,a.id limit 50 offset greatest(p_page-1,0)*50) u;
$$;
