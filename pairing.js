'use strict';
// PeerJS Cloud exchanges connection metadata; order data is handled by localApi.
let pairingHost=null,pairingCode=null,pairingExpiry=0,kitchenPeer=null;
const prefix='aestas-order-v2-';
const peerOptions={secure:true,config:{iceServers:[]}};
const pendingConnections=new Set();
function peerFailure(e){return e.type==='peer-unavailable'?'找不到这个收银台，请核对四位码，或让收银台重新生成。':'配对服务连接失败，请检查互联网；确认可以访问 0.peerjs.com。'}
orderBridge.offer=async function(attempt=0){
 if(pairingHost&&!pairingHost.destroyed&&!pairingHost.disconnected&&Date.now()<pairingExpiry)return pairingCode;
 const digits=new Uint32Array(1);crypto.getRandomValues(digits);const code=String(1000+digits[0]%9000),peer=new Peer(prefix+code,peerOptions);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{peer.destroy();reject(Error('配对服务暂时没有回应，请稍后重试'))},15000);
  peer.on('open',()=>{clearTimeout(timer);pairingHost=peer;hostPeers.push(peer);pairingCode=code;pairingExpiry=Date.now()+10*60000;resolve(code)});
  peer.on('error',e=>{clearTimeout(timer);if(e.type==='unavailable-id'&&attempt<5){peer.destroy();orderBridge.offer(attempt+1).then(resolve,reject)}else reject(Error(peerFailure(e)))});
  peer.on('connection',conn=>{
   if(Date.now()>pairingExpiry||pendingConnections.size>=3){conn.close();return}
   let approved=false;pendingConnections.add(conn);const approvalTimer=setTimeout(()=>{if(!approved)conn.close();pendingConnections.delete(conn)},45000);
   conn.on('close',()=>{clearTimeout(approvalTimer);pendingConnections.delete(conn)});
   conn.on('error',()=>conn.close());
   conn.on('open',()=>window.dispatchEvent(new CustomEvent('kitchen-pair-request',{detail:{accept(){if(!conn.open)return;approved=true;clearTimeout(approvalTimer);pendingConnections.delete(conn);conn.send(JSON.stringify({type:'approved'}))},reject(){conn.close()}}})));
   conn.on('data',async data=>{if(!approved||typeof data!=='string'||data.length>20000)return;let m;try{m=JSON.parse(data)}catch{return}if(!Number.isInteger(m.id))return;try{if(!['/api/state','/api/status','/api/session'].includes(m.path))err('制作设备无权操作',403);const result=await localApi(m.path,m.data,'kitchen');if(conn.open)conn.send(JSON.stringify({id:m.id,data:result}))}catch(e){if(conn.open)conn.send(JSON.stringify({id:m.id,error:e.message,status:e.status||503}))}});
  });
 });
};
orderBridge.answer=async function(code){
 if(!/^\d{4}$/.test(code.trim()))throw Error('请输入四位数字');
 remote?.close();kitchenPeer?.destroy();remote=null;const peer=new Peer(undefined,peerOptions);kitchenPeer=peer;
 return new Promise((resolve,reject)=>{
  let finished=false;const timer=setTimeout(()=>finish(Error('连接超时，请确认同一热点，并让收银台确认连接请求')),50000);
  const finish=e=>{if(finished)return;finished=true;clearTimeout(timer);if(e){peer.destroy();reject(e)}else resolve(true)};
  peer.on('error',e=>finish(Error(peerFailure(e))));
  peer.on('open',()=>{
   const conn=peer.connect(prefix+code.trim(),{reliable:true,serialization:'json'});
   conn.on('error',e=>finish(Error('未能连接收银台，请检查热点和浏览器网络权限')));
   conn.on('close',()=>{if(!finished)finish(Error('收银台未允许连接，或连接已断开'));remote=null;window.dispatchEvent(new Event('offline'))});
   conn.on('data',data=>{if(typeof data!=='string')return;let m;try{m=JSON.parse(data)}catch{return}if(m.type==='approved'){
    remote={get readyState(){return conn.open?'open':'closed'},send(s){conn.send(s)},close(){conn.close()}};
    finish();window.dispatchEvent(new Event('online'));return;
   }const w=waiting.get(m.id);if(!w)return;clearTimeout(w.timer);waiting.delete(m.id);if(m.error)w.reject(Object.assign(Error(m.error),{status:m.status}));else w.resolve(m.data)});
  });
 });
};
