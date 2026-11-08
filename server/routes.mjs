const pages={ '/':'index', '/auth':'auth', '/dashboard':'dashboard', '/crypto':'crypto', '/terms':'terms', '/admin':'admin' };

// Keep the browser URL clean while serving the existing HTML build files.
export function pageRoutes(req,res,next){
 if(!['GET','HEAD'].includes(req.method))return next();
 const url=new URL(req.url,'http://localhost');
 let canonical=url.pathname;
 if(canonical==='/index'||canonical==='/index.html')canonical='/';
 else if(canonical.endsWith('.html')&&Object.hasOwn(pages,canonical.slice(0,-5)))canonical=canonical.slice(0,-5);
 else if(canonical.endsWith('/')&&Object.hasOwn(pages,canonical.slice(0,-1)))canonical=canonical.slice(0,-1);
 if(canonical!==url.pathname){
  res.statusCode=308;res.setHeader('Location',canonical+url.search);return res.end();
 }
 if(Object.hasOwn(pages,canonical))req.url=`/${pages[canonical]}.html${url.search}`;
 return next();
}
