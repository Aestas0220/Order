'use strict';
// Authentication is checked by the Worker, never by a password in public source.
(()=>{
 const endpoint='https://laidain-order-api.yanluo2333.workers.dev';
 const view=new URLSearchParams(location.search).get('view')||'home';
 const name='laidain-cloud-token-'+view,native=window.fetch.bind(window);
 const stored=()=>localStorage.getItem(name)||(view==='display'?localStorage.getItem('laidain-cloud-token-cashier'):null);
 window.fetch=async(url,options={})=>{
  if(!String(url).startsWith('/api/'))return native(url,options);
  const headers=new Headers(options.headers||{}),t=stored();if(t)headers.set('Authorization','Bearer '+t);
  const response=await native(endpoint+url,{...options,headers,credentials:'omit',cache:'no-store'});
  if(url==='/api/login'&&response.ok){const data=await response.clone().json();localStorage.setItem(name,data.token)}
  if(response.status===401&&url!=='/api/login'){localStorage.removeItem(name);if(view==='display')localStorage.removeItem('laidain-cloud-token-cashier')}
  return response;
 };
 window.orderBridge={
  logout(){localStorage.removeItem(name);if(view==='display')localStorage.removeItem('laidain-cloud-token-cashier')},
  async export(){
   const r=await fetch('/api/export');const rows=await r.json();if(!r.ok)throw Error(rows.error||'导出失败');
   const cell=x=>'"'+String(x).replaceAll('"','""')+'"';
   const content='\ufeff号码,状态,金额,付款方式,商品,备注\r\n'+rows.map(o=>[o.number,o.status,(o.total/100).toFixed(2),o.payment,o.items.map(i=>i.name+' × '+i.qty).join('；'),o.note].map(cell).join(',')).join('\r\n');
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.download='来点订单.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  }
 };
})();
