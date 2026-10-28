const PREVIEW_WRITES=new Set(['/api/engineer-applications','/api/admin/applications']);
// Pages _headers rules do not cover every Function response. Preserve the same
// baseline explicitly when middleware wraps a static page or returns an API error.
const SECURITY_HEADERS={
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(self), geolocation=(), microphone=(), payment=(self "https://js.stripe.com" "https://hooks.stripe.com")',
  'content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://connect-js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.stripe.com; font-src 'self'; connect-src 'self' https://api.stripe.com https://*.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://connect-js.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://*.stripe.com; upgrade-insecure-requests"
};
function secure(response) {
  const headers=new Headers(response.headers);
  for(const [key,value] of Object.entries(SECURITY_HEADERS))headers.set(key,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export async function onRequest({request,next}) {
  const url=new URL(request.url),preview=url.hostname.endsWith('.pages.dev');
  if(url.hostname==='www.vipoap.co.uk') {
    url.hostname='vipoap.co.uk';url.protocol='https:';url.port='';
    return secure(Response.redirect(url.toString(),308));
  }
  if(preview&&!['GET','HEAD','OPTIONS'].includes(request.method)&&!PREVIEW_WRITES.has(url.pathname)) {
    return secure(Response.json({error:'This preview does not send bookings, payments or account changes to live services.'},{status:403,headers:{'cache-control':'no-store','x-robots-tag':'noindex, nofollow'}}));
  }
  const response=await next(),headers=new Headers(response.headers);
  if(preview)headers.set('x-robots-tag','noindex, nofollow');
  const page=url.pathname.replace(/\.html$/,'');
  if(page.startsWith('/admin')||['/app/account','/review','/additional-time'].includes(page)||url.searchParams.has('access')||url.searchParams.has('token'))headers.set('x-robots-tag','noindex, nofollow');
  if(url.pathname.startsWith('/api/'))headers.set('cache-control','no-store');
  return secure(new Response(response.body,{status:response.status,statusText:response.statusText,headers}));
}
