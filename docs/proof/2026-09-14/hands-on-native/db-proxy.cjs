// Loopback transport only; fixed destination is the disposable PostgreSQL cluster.
const {createRequire}=require('node:module'),net=require('node:net');
const req=createRequire('/Users/robertyeager/fdc-work/rentdesk/package.json');
const {WebSocketServer}=req('ws');
const server=new WebSocketServer({host:'127.0.0.1',port:55440});
server.on('connection',ws=>{const socket=net.connect(55439,'127.0.0.1');ws.on('message',b=>socket.write(b));socket.on('data',b=>{if(ws.readyState===1)ws.send(b)});socket.on('error',()=>ws.close());ws.on('error',()=>socket.destroy());ws.on('close',()=>socket.destroy());socket.on('close',()=>ws.close())});
console.log('Loopback database WebSocket transport ready on 55440');
