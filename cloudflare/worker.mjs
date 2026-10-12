// Cloudflare Worker; bind D1 as DB and set ACCESS_PASSWORD as a Secret.
const ORIGIN='https://aestas0220.github.io';
const encoder=new TextEncoder();
const bad=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function token(secret,role){const payload=b64(encoder.encode(JSON.stringify({role,exp:Date.now()+7*86400000,nonce:crypto.randomUUID()})));const sig=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload));return payload+'.'+b64(new Uint8Array(sig))}
async function session(request,secret){
 try{const text=request.headers.get('Authorization')||'';if(!text.startsWith('Bearer '))return null;const [payload,sig,...extra]=text.slice(7).split('.');if(extra.length||!payload||!sig||text.length>2048)return null;
 if(!await crypto.subtle.verify('HMAC',await key(secret),unb64(sig),encoder.encode(payload)))return null;
 const s=JSON.parse(new TextDecoder().decode(unb64(payload)));return s.exp>Date.now()&&['cashier','kitchen','display'].includes(s.role)?s.role:null;
 }catch{return null}
}
async function passwordMatches(a,b){const x=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(a))),y=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(b)));let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
const defaults=[{id:'noodle',name:'火鸡面 · 标准版',price:990,category:'火鸡面'},{id:'noodle_plus',name:'火鸡面 · 大满贯',price:1290,category:'火鸡面'},{id:'egg',name:'加料 · 卤蛋',price:150,category:'加料'},{id:'sausage',name:'加料 · 火腿肠',price:200,category:'加料'},{id:'jelly',name:'冰粉',price:1490,category:'饮品甜品'},{id:'soda',name:'气泡水',price:1490,category:'饮品甜品'},{id:'cola',name:'冻柠乐',price:890,category:'饮品甜品'},{id:'plum',name:'酸梅汤',price:690,category:'饮品甜品'},{id:'ice_low',name:'雪糕 · 2.9元档',price:290,category:'雪糕'},{id:'ice_mid',name:'雪糕 · 5.9元档（请核对）',price:590,category:'雪糕',enabled:false},{id:'ice_high',name:'雪糕 · 8.9元档',price:890,category:'雪糕'}];
async function init(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS order_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, window INTEGER NOT NULL, attempts INTEGER NOT NULL)').run();
 await db.prepare('INSERT OR IGNORE INTO order_state (id,revision,body) VALUES (1,0,?)').bind(JSON.stringify({revision:0,next:1,orders:[],menu:defaults})).run();
}
function createApi(db){
 async function transaction(write,fn){
  for(let retry=0;retry<12;retry++){
   const row=await db.prepare('SELECT revision,body FROM order_state WHERE id=1').first();if(!row)bad('数据库尚未初始化',503);
   const s=JSON.parse(row.body),result=fn(s);if(!write)return result;
   const saved=await db.prepare('UPDATE order_state SET revision=revision+1,body=? WHERE id=1 AND revision=?').bind(JSON.stringify(s),row.revision).run();
   if(saved.meta.changes===1)return result;
  }
  bad('同时操作较多，请稍后重试。同一笔订单不会重复发号。',409);
 }
const err=(message,status=400,code='')=>{throw Object.assign(Error(message),{status,code})};
async function localApi(path,data={},role='cashier'){
 if(path==='/api/session')return {role};
 if(path==='/api/settings'&&role==='cashier')return {cloud:true};
 if(path==='/api/display'||(path==='/api/state'&&role!=='display'))return transaction(false,s=>({revision:s.revision,orders:path==='/api/display'?s.orders.filter(o=>['preparing','ready'].includes(o.status)).map(({number,status,updated})=>({number,status,updated})):s.orders,menu:path==='/api/display'?[]:s.menu,now:Date.now()/1000}));
 if(path==='/api/orders'&&role==='cashier')return transaction(true,s=>{
  if(typeof data.requestKey!=='string'||data.requestKey.length<16||!Array.isArray(data.items)||!data.items.length||data.items.length>40||!['cash','wechat','alipay'].includes(data.payment)||!Number.isInteger(data.expectedTotal)||data.expectedTotal<1||typeof data.note!=='string'||data.note.length>100)err('订单内容无效');
  const fingerprint=JSON.stringify(data);const old=s.orders.find(o=>o.key===data.requestKey);if(old){if(old.fingerprint!==fingerprint)err('提交标识已使用，请核对订单',409);return {order:old}}
  const seen=new Set(),items=data.items.map(i=>{const m=s.menu.find(m=>m.id===i.id);if(!m||m.enabled===false||seen.has(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>99)err('商品不可用，请刷新菜单');seen.add(i.id);return {id:m.id,name:m.name,price:m.price,qty:i.qty}}),total=items.reduce((t,i)=>t+i.price*i.qty,0);if(total!==data.expectedTotal)err('菜单价格已变化，请核对后重试',409,'price_changed');
  const o={number:s.next++,key:data.requestKey,fingerprint,items,total,payment:data.payment,note:data.note,status:'preparing',created:Date.now()/1000,updated:Date.now()/1000,version:1};s.orders.unshift(o);s.revision++;return {order:o};
 });
 if(path==='/api/status'&&['cashier','kitchen'].includes(role))return transaction(true,s=>{const o=s.orders.find(o=>o.number===data.number);if(!o)err('订单不存在',404);if(o.version!==data.version)err('订单已被修改，请刷新后重试',409);const allowed={preparing:['ready','cancelled'],ready:['preparing','picked','cancelled'],picked:['ready'],cancelled:['preparing']};if(!allowed[o.status].includes(data.status)||(role==='kitchen'&&(o.status==='cancelled'||data.status==='cancelled')))err('不能这样更改订单状态',409);o.status=data.status;o.updated=Date.now()/1000;o.version++;s.revision++;return {order:o}});
 if(path==='/api/menu'&&role==='cashier')return transaction(true,s=>{if(!Array.isArray(data.menu)||data.menu.length!==defaults.length)err('菜单格式无效');const ids=new Set();for(const m of data.menu){if(!defaults.some(x=>x.id===m.id)||ids.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>40||!Number.isInteger(m.price)||m.price<1||m.price>99999||typeof m.enabled!=='boolean')err('请检查商品和价格');ids.add(m.id)}s.menu=data.menu;s.revision++;return {ok:true}});
 if(path==='/api/export'&&role==='cashier')return transaction(false,s=>s.orders);
 err('此设备不能进行这项操作',403);
}
 return localApi;
}
export default {async fetch(request,env){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 try{
  const origin=request.headers.get('Origin');if(origin&&origin!==ORIGIN)return json({error:'不允许此网站访问'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/api/health')return json({ok:!!env.DB,passwordConfigured:!!env.ACCESS_PASSWORD,version:'cloud1'});
  if(!env.DB)bad('订单数据库还未连接',503);
  if(!env.ACCESS_PASSWORD||env.ACCESS_PASSWORD.length<8)bad('请在 Cloudflare 设置至少 8 位固定密码',503);
  if(!['GET','POST'].includes(request.method))bad('请求方式不支持',405);
  if(Number(request.headers.get('Content-Length')||0)>24000)bad('请求内容过长',413);
  let data={};if(request.method==='POST'){const raw=await request.text();if(raw.length>24000)bad('请求内容过长',413);try{data=JSON.parse(raw)}catch{bad('请求内容无效')};if(!data||typeof data!=='object'||Array.isArray(data))bad('请求内容无效')}
  if(path==='/api/login'){
   if(request.method!=='POST')bad('请提交密码',405);
   if(typeof data.pin!=='string'||data.pin.length>200||!['cashier','kitchen','display'].includes(data.role))bad('登录信息无效');
   await init(env.DB);
   const window=Math.floor(Date.now()/600000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
   const id=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env.ACCESS_PASSWORD),encoder.encode(ip))));
   const attempt=await env.DB.prepare('INSERT INTO login_attempts (id,window,attempts) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(id,window).first();
   if(attempt.attempts>20)bad('尝试次数较多，请 10 分钟后重试',429);
   if(!await passwordMatches(data.pin,env.ACCESS_PASSWORD))bad('密码不正确',401);
   await env.DB.prepare('DELETE FROM login_attempts WHERE id=? OR window<?').bind(id,window-1).run();
   return json({role:data.role,token:await token(env.ACCESS_PASSWORD,data.role)});
  }
  const role=await session(request,env.ACCESS_PASSWORD);
  if(path==='/api/session')return json({role});
  if(!role)bad('请先输入固定密码登录',401);
  const write=['/api/orders','/api/status','/api/menu'].includes(path);
  if(write&&request.method!=='POST')bad('此操作需要提交内容',405);
  const api=createApi(env.DB);const result=await api(path,data,role);
  if(path==='/api/state')result.orders=result.orders.map(({key,fingerprint,...o})=>o);
  return json(result);
 }catch(e){return json({error:e.status?e.message:'服务器暂时无法保存，请稍后重试',code:e.code||''},e.status||503)}
}};
