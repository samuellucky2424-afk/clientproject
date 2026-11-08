-- Apply after admin-controls.sql.
create table public.prank_features (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 title text not null check(length(title) between 2 and 80), description text not null check(length(description)<=1500),
 action text not null check(action in ('crypto','video','details','link')), url text not null default '' check(length(url)<=500),
 enabled boolean not null default true, sort_order integer not null default 0 check(sort_order between 0 and 9999),
 fee_cents bigint check(fee_cents between 1 and 100000000), updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.prank_features enable row level security;
revoke all on public.prank_features from anon,authenticated;
grant all on public.prank_features to service_role;
insert into public.prank_features(slug,title,description,action,sort_order) values
 ('crypto','Crypto prank','Create a clearly labelled fictional crypto transfer preview.','crypto',10),
 ('new-phone','New phone','Contact the team for details about the new phone service.','details',20),
 ('video','Video calling','Request a V2V call with your name, email and WhatsApp number.','video',30);
alter table public.prank_video_requests add column full_name text check(length(full_name) between 2 and 100),
 add column email text check(length(email)<=254), add column whatsapp text check(length(whatsapp) between 8 and 16),
 add column fee_cents bigint check(fee_cents between 1 and 100000000);
alter table public.prank_ledger drop constraint prank_ledger_kind_check;
alter table public.prank_ledger add constraint prank_ledger_kind_check check(kind in ('deposit','transfer_fee','fee_refund','admin_credit','video_fee'));

create function public.prank_submit_video(p_user uuid,p_key uuid,p_name text,p_email text,p_whatsapp text,p_title text,p_details text,p_fee bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.prank_features; r public.prank_video_requests; b bigint;
begin
 select * into f from public.prank_features where slug='video' for share;
 insert into public.prank_wallets(user_id) values(p_user) on conflict do nothing;
 select balance_cents into b from public.prank_wallets where user_id=p_user for update;
 select * into r from public.prank_video_requests where user_id=p_user and request_key=p_key;
 if found then return to_jsonb(r); end if;
 if not f.enabled or f.fee_cents is null then raise exception 'Video calling is not available for requests yet.'; end if;
 if p_fee is null or p_fee<>f.fee_cents then raise exception 'The V2V fee changed. Review the latest fee and submit again.'; end if;
 if p_name is null or p_email is null or p_whatsapp is null or p_title is null or p_details is null then raise exception 'Complete all request details.'; end if;
 if b<f.fee_cents then raise exception 'Insufficient wallet balance. Top up your wallet before submitting.'; end if;
 insert into public.prank_video_requests(user_id,request_key,full_name,email,whatsapp,title,details,contact,fee_cents)
 values(p_user,p_key,p_name,p_email,p_whatsapp,p_title,p_details,p_whatsapp,f.fee_cents) returning * into r;
 update public.prank_wallets set balance_cents=balance_cents-f.fee_cents where user_id=p_user;
 insert into public.prank_ledger(user_id,delta_cents,kind,reference_id) values(p_user,-f.fee_cents,'video_fee',r.id);
 return to_jsonb(r);
end $$;
revoke all on function public.prank_submit_video(uuid,uuid,text,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.prank_submit_video(uuid,uuid,text,text,text,text,text,bigint) to service_role;

create or replace function public.prank_admin_overview() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'users',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
 'activeUsers',(select count(*) from auth.users where last_sign_in_at>now()-interval '30 days'),
 'balance',(select coalesce(sum(balance_cents),0)/100.0 from public.prank_wallets),
 'revenue',(select -coalesce(sum(delta_cents),0)/100.0 from public.prank_ledger where kind in ('transfer_fee','fee_refund','video_fee')),
 'transactions',(select count(*) from public.prank_transfers where state<>'pending'),
 'deposits',(select coalesce(sum(usd_cents),0)/100.0 from public.prank_deposits where state='credited'),
 'referrals',(select count(*) from public.prank_referrals),
 'pendingRequests',(select count(*) from public.prank_video_requests where state='pending'),
 'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.day),'[]'::jsonb) from (
 select day::date as day,coalesce(-sum(l.delta_cents),0)/100.0 as revenue from generate_series(current_date-13,current_date,'1 day') day
 left join public.prank_ledger l on l.created_at>=day and l.created_at<day+interval '1 day' and l.kind in ('transfer_fee','fee_refund','video_fee') group by day) d));
$$;
