const http=require('http'),fs=require('fs'),path=require('path');
const Q=require('./questions.js'),games={},MAX=14;
const rid=()=>Math.random().toString(36).slice(2,10);
function view(g){const r=g.phase=='result'||g.phase=='end';
 return{code:g.code,phase:g.phase,q:g.q,round:g.round,result:r?g.result:null,
 players:Object.values(g.players).map(p=>({id:p.id,name:p.name,num:p.num,pos:p.pos,voted:p.id in g.votes}))}}
function push(g){const m=`data: ${JSON.stringify(view(g))}\n\n`;g.clients.forEach(c=>c.write(m))}
function nextQ(g){let a=Q.map((_,i)=>i).filter(i=>!g.used.includes(i));if(!a.length){g.used=[];a=Q.map((_,i)=>i)}
 const i=a[Math.floor(Math.random()*a.length)];g.used.push(i);g.q=Q[i];g.phase='vote';g.votes={};g.result=null;g.round++}
function reveal(g){const cnt={},mv={};
 Object.values(g.votes).forEach(t=>cnt[t]=(cnt[t]||0)+1);
 const max=Math.max(0,...Object.values(cnt));
 const win=Object.keys(cnt).filter(t=>cnt[t]==max&&max>0);
 win.forEach(w=>mv[w]=(mv[w]||0)+1);
 for(const[v,t]of Object.entries(g.votes)){
  if(win.includes(t))mv[v]=(mv[v]||0)+1;
  else if(v==t)mv[v]=(mv[v]||0)-1}
 for(const p of Object.values(g.players)){const d=mv[p.id]||0;mv[p.id]=Math.max(0,p.pos+d)-p.pos;p.pos=Math.min(MAX,p.pos+mv[p.id])}
 g.result={counts:cnt,winners:win,moves:mv,votes:g.votes};g.phase='result'}
function act(d){
 if(d.a=='create'){let code;do code=String(100000+Math.floor(Math.random()*900000));while(games[code]);
  const id=rid();games[code]={code,host:id,phase:'lobby',players:{},votes:{},round:0,used:[],q:'',result:null,clients:new Set(),t:Date.now()};return{code,id}}
 const g=games[d.code];if(!g)return{error:'קוד משחק לא קיים'};
 const host=d.id===g.host;
 if(d.a=='join'){const name=String(d.name||'').trim().slice(0,12),num=parseInt(d.num);
  if(!name)return{error:'צריך לכתוב שם'};
  if(!(num>=1&&num<=60))return{error:'בחר מספר בין 1 ל-60'};
  if(Object.values(g.players).some(p=>p.num==num))return{error:'המספר הזה כבר תפוס, בחר אחר'};
  if(Object.keys(g.players).length>=80)return{error:'המשחק מלא'};
  const id=rid();g.players[id]={id,name,num,pos:0};push(g);return{id}}
 if(d.a=='start'&&host&&g.phase=='lobby'&&Object.keys(g.players).length>1)nextQ(g);
 else if(d.a=='vote'&&g.phase=='vote'&&g.players[d.id]&&g.players[d.target]){g.votes[d.id]=d.target;
  if(Object.keys(g.votes).length>=Object.keys(g.players).length)reveal(g)}
 else if(d.a=='reveal'&&host&&g.phase=='vote'&&Object.keys(g.votes).length)reveal(g);
 else if(d.a=='next'&&host&&g.phase=='result'){
  if(Object.values(g.players).some(p=>p.pos>=MAX))g.phase='end';else nextQ(g)}
 push(g);return{ok:1}}
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname=='/events'){const g=games[u.searchParams.get('code')];if(!g){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
  g.clients.add(res);res.write(`data: ${JSON.stringify(view(g))}\n\n`);req.on('close',()=>g.clients.delete(res));return}
 if(u.pathname=='/taken'){const g=games[u.searchParams.get('code')];res.writeHead(200,{'Content-Type':'application/json'});
  return res.end(JSON.stringify(g?Object.values(g.players).map(p=>p.num):null))}
 if(u.pathname=='/api'&&req.method=='POST'){let b='';for await(const c of req)b+=c;
  let d;try{d=JSON.parse(b)}catch{res.writeHead(400);return res.end()}
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(act(d)))}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.end(fs.readFileSync(path.join(__dirname,'index.html')))
}).listen(process.env.PORT||3000,()=>console.log('Running on port '+(process.env.PORT||3000)));
setInterval(()=>{for(const c in games){const g=games[c];g.clients.forEach(r=>r.write(':\n\n'));if(Date.now()-g.t>8*36e5)delete games[c]}},20000);
