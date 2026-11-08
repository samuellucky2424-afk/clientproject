import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
try{await db.exec(await readFile('database/schema.sql','utf8'));await db.exec('alter table auth.users add column email text, add column created_at timestamptz default now(), add column last_sign_in_at timestamptz, add column email_confirmed_at timestamptz, add column is_anonymous boolean default false');await db.exec(await readFile('database/admin.sql','utf8'));await db.exec(await readFile('database/admin-controls.sql','utf8'));await db.exec(await readFile('database/features.sql','utf8'));}catch(error){console.error(error.message);process.exit(1);}
console.log('Database schema compiled successfully.');
await db.close();
