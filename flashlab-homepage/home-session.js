import {authClient} from './session.js';

// Visitors are sent to sign-up; an existing session goes straight to setup.
// Feature cards point at the real feature only once we know there is a session.
const featureDestinations = {v2v:'/dashboard',crypto:'/crypto'};

try {
 const client=await authClient();
 const {data:{session}}=await client.auth.getSession();
 if(session){
  const home=session.user.app_metadata?.role==='admin'?'/admin':'/dashboard';
  for(const link of document.querySelectorAll('[data-start]'))link.href=home;
  for(const link of document.querySelectorAll('[data-login-link]')){link.href=home;link.textContent='My dashboard';}
  for(const [feature,destination] of Object.entries(featureDestinations))
   for(const link of document.querySelectorAll(`[data-feature="${feature}"]`))link.href=destination;
 }
} catch {
 // Keep the sign-up links usable if the account service cannot be reached.
}
