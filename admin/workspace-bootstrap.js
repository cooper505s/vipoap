// Run in the head before legacy sign-in markup can paint.
(()=>{
 let signedIn=false;try{signedIn=Boolean(sessionStorage.getItem('vipoapAdmin')||sessionStorage.getItem('vipoapAdminSession'))}catch{}
 if(!signedIn)return;
 const style=document.createElement('style');style.textContent='html.workspace-pending body>main{visibility:hidden!important}html.workspace-pending body:before{content:"Opening workspace…";position:fixed;inset:0;display:grid;place-items:center;background:#f4f6f9;color:#102957;font:14px system-ui;z-index:9999}';document.head.append(style);document.documentElement.classList.add('workspace-pending');
 const observer=new MutationObserver(()=>{if(document.body?.classList.contains('workspace-ready')){document.documentElement.classList.remove('workspace-pending');observer.disconnect();}});observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
 // A failed script load must offer recovery without flashing an obsolete login.
 setTimeout(()=>{if(!document.documentElement.classList.contains('workspace-pending'))return;const retry=document.createElement('button');retry.textContent='Workspace could not open. Reload';retry.style.cssText='position:fixed;top:55%;left:50%;transform:translateX(-50%);z-index:10000;padding:12px';retry.onclick=()=>location.reload();document.body.append(retry)},15000);
})();
