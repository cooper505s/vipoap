const PREVIEW_WRITES=new Set(['/api/engineer-applications','/api/admin/applications']);
export async function onRequest({request,next}) {
  const url=new URL(request.url),preview=url.hostname.endsWith('.pages.dev');
  if(url.hostname==='www.vipoap.co.uk') {
    url.hostname='vipoap.co.uk';url.protocol='https:';url.port='';
    return Response.redirect(url.toString(),308);
  }
  if(preview&&!['GET','HEAD','OPTIONS'].includes(request.method)&&!PREVIEW_WRITES.has(url.pathname)) {
    return Response.json({error:'This preview does not send bookings, payments or account changes to live services.'},{status:403,headers:{'cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
  }
  const response=await next(),headers=new Headers(response.headers);
  if(preview)headers.set('x-robots-tag','noindex, nofollow');
  const page=url.pathname.replace(/\.html$/,'');
  if(page.startsWith('/admin')||['/app/account','/review','/additional-time'].includes(page)||url.searchParams.has('access')||url.searchParams.has('token'))headers.set('x-robots-tag','noindex, nofollow');
  if(url.pathname.startsWith('/api/'))headers.set('cache-control','no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
