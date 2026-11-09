// Vercel forwards every API depth to one function through an explicit rewrite.
export function restoreApiPath(req){
 const url=new URL(req.url,'http://localhost');
 const route=url.searchParams.get('__api_path');
 url.searchParams.delete('__api_path');
 if(route!==null){
  // Only restore an API pathname. Authorization remains in the API handler.
  url.pathname=/^[a-z0-9/-]+$/i.test(route)?`/api/${route}`:'/api/not-found';
 }
 req.url=url.pathname+url.search;
}
