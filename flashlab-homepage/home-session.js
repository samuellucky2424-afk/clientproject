import {authClient} from './session.js';
// Visitors go straight to login; existing sessions can open their dashboard.
try {
 const client=await authClient();
 const {data:{session}}=await client.auth.getSession();
 if(session){
  const destination=session.user.app_metadata?.role==='admin'?'/admin':'/dashboard';
  for(const link of document.querySelectorAll('.get-started'))link.href=destination;
 }
} catch {
 // Keep the login links usable if the account service cannot be reached.
}
