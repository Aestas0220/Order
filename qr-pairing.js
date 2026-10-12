'use strict';
// All QR generation and camera decoding happen in this browser; no signaling server.
window.QRPair=(()=>{
 let displayed='',creating=false,stream=null,scanToken=0,facing='environment';
 const scanner=document.querySelector('#scan-dialog');
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function status(text){document.querySelectorAll('.pair-status').forEach(e=>e.textContent=text)}
 function closeCamera(){scanToken++;stream?.getTracks().forEach(t=>t.stop());stream=null;const v=scanner.querySelector('video');if(v)v.srcObject=null}
 scanner.addEventListener('close',closeCamera);
 window.addEventListener('pagehide',closeCamera);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&scanner.open)scanner.close()});
 function showCode(code,host){
  displayed=code;
  showModal(`<section class="pair-view"><p class="eyebrow">${host?'① 平板扫这里':'② 笔记本扫这里'}</p><h2>${host?'连接制作平板':'回传给收银台'}</h2><p>${host?'平板进入制作清单，点击「扫收银台二维码」。':'让笔记本点击「扫描平板回传码」，用摄像头扫下面二维码。'}</p><div id="pair-qr" class="pair-qr"></div><p class="pair-status" role="status">${host?'等待平板扫码并回传':'等待笔记本扫描回传二维码'}</p>${host?'<button class="primary" data-action="scan-answer">② 扫描平板回传码</button>':''}<details><summary>复制粘贴备用</summary><textarea id="pair-code" rows="3" readonly spellcheck="false">${escape(code)}</textarea><button data-action="copy-pair">复制${host?'配对':'回传'}内容</button>${host?'<textarea id="answer" rows="3" spellcheck="false" placeholder="粘贴平板回传内容"></textarea><button data-action="pair-accept">接收回传内容</button>':''}</details><p class="sub">配对期间保留这个窗口。刷新页面后需要重新配对。</p><button data-action="close">关闭</button></section>`);
  try{
   const qr=qrcode(0,'L');qr.addData(code);qr.make();
   document.querySelector('#pair-qr').innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});
  }catch{
   document.querySelector('#pair-qr').innerHTML='<p>当前配对内容较长，请展开下方「复制粘贴备用」。</p>';
   document.querySelector('.pair-view details').open=true;
  }
 }
 async function host(){
  if(creating)return;creating=true;toast('正在生成配对二维码…');
  try{showCode(await orderBridge.offer(),true)}catch(e){toast(e.message)}finally{creating=false}
 }
 async function answer(code){
  if(creating)return;creating=true;status('正在生成回传二维码…');
  try{showCode(await orderBridge.answer(code),false)}catch(e){status(e.message);toast(e.message)}finally{creating=false}
 }
 async function accept(code){
  try{await orderBridge.accept(code);status('已接收回传，正在建立连接…');toast('已接收回传，请保留收银窗口')}
  catch(e){status(e.message);toast(e.message)}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(displayed);toast('已复制配对内容')}
  catch{const box=document.querySelector('#pair-code');box?.focus();box?.select();toast('请复制已选中的内容')}
 }
 async function scan(onCode,expected){
  closeCamera();
  scanner.innerHTML=`<h2>${expected==='offer'?'扫描收银台二维码':'扫描平板回传二维码'}</h2><p class="sub">把完整二维码放入画面内，保持屏幕明亮，稍等自动识别。</p><video id="scan-video" playsinline muted autoplay></video><p id="scan-status" role="status">正在请求摄像头权限…</p><div class="actions"><button id="camera-switch">切换前后摄像头</button><button id="scan-close">取消扫码</button></div><p class="sub">摄像头画面仅在本设备处理，关闭扫码后立即停用。</p>`;
  if(!scanner.open)scanner.showModal();
  scanner.querySelector('#scan-close').onclick=()=>scanner.close();
  scanner.querySelector('#camera-switch').onclick=()=>{facing=facing==='environment'?'user':'environment';scan(onCode,expected)};
  const token=++scanToken;
  const message=s=>{if(token===scanToken&&scanner.open)scanner.querySelector('#scan-status').textContent=s};
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('此浏览器不能使用摄像头，请在浏览器打开 HTTPS 网站，或改用复制粘贴');
   const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}}});
   if(token!==scanToken||!scanner.open){media.getTracks().forEach(t=>t.stop());return}
   stream=media;const video=scanner.querySelector('video');video.srcObject=media;await video.play();
   message('请对准二维码');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
   function frame(){
    if(token!==scanToken||!scanner.open)return;
    if(video.readyState>=2&&video.videoWidth){
     const scale=Math.min(1,1280/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
     ctx.drawImage(video,0,0,canvas.width,canvas.height);
     const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});
     if(qr){
      const code=qr.data.trim();
      if(!code.startsWith('LD1:')&&!/^[A-Za-z0-9+/=]{100,32000}$/.test(code)){message('这不是本系统的配对二维码，请换一个');setTimeout(frame,500);return}
      scanner.close();Promise.resolve(onCode(code)).catch(e=>toast(e.message));return;
     }
    }
    setTimeout(frame,180);
   }
   frame();
  }catch(e){
   if(token!==scanToken)return;
   closeCamera();
   const text=e.name==='NotAllowedError'?'摄像头权限未开启。请在浏览器地址栏允许摄像头，或改用复制粘贴。':e.name==='NotFoundError'?'没有找到摄像头，请改用复制粘贴。':e.name==='NotReadableError'?'摄像头被其他程序占用，请关闭其他视频程序后重试。':e.message;
   const el=scanner.querySelector('#scan-status');if(el)el.textContent=text;
  }
 }
 window.addEventListener('order-pair-state',e=>{
  const s=e.detail.state;
  if(s==='connected'){status('已连接制作台，可关闭此窗口');toast('制作台已连接');if(e.detail.side==='kitchen')refresh(true)}
  else if(s==='failed'||s==='timeout'){status('连接未成功：请确认在同一 Wi-Fi。校园网络可能隔离设备，建议改连笔记本热点后重新配对。');toast('未建立连接，请改用笔记本热点后重新配对')}
  else if(s==='disconnected'||s==='closed'){status('连接已断开，请重新配对');if(e.detail.side==='kitchen')refresh(true)}
 });
 return {host,answer,accept,copy,scanOffer:()=>scan(answer,'offer'),scanAnswer:()=>scan(accept,'answer')};
})();
