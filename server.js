const http=require('http');
const fs=require('fs');
const path=require('path');
const {WebSocketServer}=require('ws');
const PORT=Number(process.env.PORT||3000);
const root=path.join(__dirname,'public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const target=path.resolve(root,'.'+pathname.replace(/\/$/,'/index.html'));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data)});
});
const wss=new WebSocketServer({server});
const rooms=new Map();
const send=(ws,msg)=>{if(ws.readyState===1)ws.send(JSON.stringify(msg))};
const broadcast=(room,msg,except)=>{for(const client of room.clients)if(client!==except)send(client,msg)};
wss.on('connection',ws=>{
 let current=null,user='访客';
 ws.on('message',buffer=>{
  if(buffer.length>1500000)return send(ws,{type:'error',message:'内容过大'});
  let msg;try{msg=JSON.parse(buffer)}catch{return}
  if(msg.type==='join'){
   const id=String(msg.room||'').replace(/[^0-9]/g,'').slice(0,6);if(id.length!==6)return send(ws,{type:'error',message:'世界码必须是 6 位数字'});
   if(current)current.clients.delete(ws);
   current=rooms.get(id)||{clients:new Set(),world:null};rooms.set(id,current);current.clients.add(ws);user=String(msg.user||'旅人').slice(0,24);
   if(current.world)send(ws,{type:'snapshot',world:current.world});
   else if(msg.world)current.world=msg.world;
   send(ws,{type:'joined',room:id,count:current.clients.size});broadcast(current,{type:'presence',count:current.clients.size});return;
  }
  if(!current)return;
  if(msg.type==='state'&&msg.world&&JSON.stringify(msg.world).length<900000){current.world=msg.world;broadcast(current,{type:'snapshot',world:current.world,by:user},ws)}
  if(msg.type==='cursor')broadcast(current,{type:'cursor',x:msg.x,y:msg.y,by:user},ws);
 });
 ws.on('close',()=>{if(current){current.clients.delete(ws);broadcast(current,{type:'presence',count:current.clients.size});if(!current.clients.size)setTimeout(()=>{if(!current.clients.size)for(const [key,value] of rooms)if(value===current)rooms.delete(key)},3600000)}});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`记忆世界正在运行: http://localhost:${PORT}`));
