'use strict';
window.OrderVoice=(()=>{
 const supported='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
 let enabled=false,previous=null,ready=new Set(),queue=[],active=null,generation=0;
 const controls=()=>`<button data-action="fullscreen">全屏</button><button data-action="voice-toggle" ${supported?'':'disabled'}>${enabled?'关闭语音叫号':'开启语音叫号'}</button><button data-action="voice-replay" ${enabled?'':'disabled'}>重播取餐号码</button>`;
 function announceError(){if(typeof toast==='function')toast('语音未播放，请检查电脑音量，并使用 Edge 或 Chrome 的中文语音。')}
 function drain(){
  if(!enabled||active||document.hidden)return;
  while(queue.length&&queue[0].number!==null&&!ready.has(queue[0].number))queue.shift();
  const item=queue.shift();if(!item)return;
  const token=generation,utterance=new SpeechSynthesisUtterance(item.text);
  const voices=speechSynthesis.getVoices(),voice=voices.find(v=>/^zh[-_]CN$/i.test(v.lang)&&v.localService)||voices.find(v=>/^zh[-_]CN$/i.test(v.lang))||voices.find(v=>/^zh/i.test(v.lang));
  if(voice)utterance.voice=voice;utterance.lang='zh-CN';utterance.rate=.88;utterance.pitch=1;utterance.volume=1;
  active=utterance;let timer=null,done=false;
  const finish=(error=false)=>{if(done||token!==generation)return;done=true;clearTimeout(timer);active=null;if(error)announceError();setTimeout(drain,550)};
  utterance.onend=()=>finish();utterance.onerror=e=>finish(!['canceled','interrupted'].includes(e.error));
  timer=setTimeout(()=>{if(token!==generation)return;generation++;speechSynthesis.cancel();active=null;announceError();setTimeout(drain,550)},16000);
  try{speechSynthesis.resume();speechSynthesis.speak(utterance)}catch{finish(true)}
 }
 function enqueue(numbers){for(const n of numbers){if(queue.some(x=>x.number===n))continue;queue.push({number:n,text:`请 ${n} 号顾客取餐。请 ${n} 号顾客凭号码取餐。`})}drain()}
 function update(orders){
  const current=new Map(orders.map(o=>[o.number,o.status]));ready=new Set(orders.filter(o=>o.status==='ready').map(o=>o.number));
  if(enabled&&previous)enqueue([...ready].filter(n=>previous.get(n)!=='ready'));
  previous=current;
 }
 function toggle(){
  if(!supported){announceError();return}
  enabled=!enabled;
  if(!enabled){generation++;queue=[];active=null;speechSynthesis.cancel()}
  else{queue.push({number:null,text:'语音叫号已开启。'});enqueue([...ready])}
 }
 function replay(){if(!enabled)return;enqueue([...ready]);if(!ready.size&&typeof toast==='function')toast('当前没有等待取餐的号码')}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)drain()});
 window.addEventListener('pagehide',()=>{if(supported){generation++;speechSynthesis.cancel()}});
 return {get enabled(){return enabled},controls,update,toggle,replay};
})();
