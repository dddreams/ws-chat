const url = require('url');
// 引入 websocket
const ws = require('ws');

const Cookies = require('cookies');

const Koa = require('koa');

const bodyParser = require('koa-bodyparser');
const router = require('koa-router')();
// 引入加载 view 模板文件
const templating = require('./templating.js');
const fs = require('fs');

const WebSocketServer = ws.Server;

const app = new Koa();

// log
app.use(async (ctx, next) => {
	console.log(`Process ${ctx.request.method} ${ctx.request.url}...`);
	await next();
});

// 读取 cookies 
app.use(async (ctx, next) => {
    ctx.state.user = parseUser(ctx.cookies.get('name') || '');
    await next();
});

// 读取静态文件
let staticFiles = require('./static-files');
app.use(staticFiles('/static/', __dirname + '/static'));

// bodyParser 解析原始 request 用来处理 post 请求
app.use(bodyParser());

// nunjucks 加载 view 
app.use(templating('view', {
	onCache : true,
	watch: true
}));

function addMapping(router, mapping){
	for(var url in mapping){
		if(url.startsWith('GET ')){
			var path = url.substring(4);
			router.get(path, mapping[url]);
		} else if(url.startsWith('POST ')){
			var path = url.substring(5);
			router.post(path, mapping[url]);
		}else {
			console.log(`invalid URL: ${url}`);
		}
	}
}

function addControllers(router){
	var files = fs.readdirSync(__dirname + '/controllers');
	var js_files = files.filter((f) => {
		return f.endsWith('.js');
	}, files);

	for (var f of js_files){
		let mapping = require(__dirname + '/controllers/' + f);
		addMapping(router, mapping);
	}
}

// 加载 controllers 目录下的 controller 
addControllers(router);

// 根据 url 处理 GET/POS 请求
app.use(router.routes());

let server = app.listen(3000);

function parseUser(obj){
	if(!obj){
		return ;
	}
	let s = '';
	if(typeof obj === 'string'){
		s = obj;
	}else if(obj.headers){
		let cookies = new Cookies(obj, null);
		s = cookies.get('name');
	}
	if(s){
		try{
			let user = JSON.parse(Buffer.from(s, 'base64').toString());
			console.log(`User : ${user.name}, ID: ${user.id}`);
			return user;
		} catch(e){
			console.log('exception ....');
		}
	}
}

function createWebSocketServer(server, onConnection, onMessage, onClose, onError){
	let wss = new WebSocketServer({
		server: server
	});
	wss.broadcast = function broadcast(data) {
        wss.clients.forEach(function each(client) {
            client.send(data);
        });
    };
	onConnection = onConnection || function(){
		console.log('[WebSocket] connected.');
	};
	onMessage = onMessage || function(msg){
		console.log('[WebSocket] message received:' + msg);
	};
	onClose = onClose || function(code, message){
		console.log(`[WebSocket] close: ${code} - ${message}`);	
	};
	onError = onError || function(err){
		console.log('[WebSocket] error:' + err);
	};
	wss.on('connection', function(ws){
		let location = url.parse(ws.upgradeReq.url, true);
		console.log('[WebSocketServer] connection : ' + location.href);
		ws.on('message', onMessage);
		ws.on('close', onClose);
		ws.on('error', onError);
		if(location.pathname !== '/ws/chat'){
			ws.close(4000, 'Incaild URL');
		}

		let user = parseUser(ws.upgradeReq);
		if(!user){
			ws.close(4001, 'Invalid user');
		}
		ws.user = user;
		ws.wss = wss;
		onConnection.apply(ws);
	});
	console.log('WebSocketServer was attached.');
	return wss;
}

var messageIndex = 0;
function createMessage(type, user, data){
	messageIndex ++;
	return JSON.stringify({
		id: messageIndex,
		type: type,
		user: user,
		data: data
	});
}

function onConnection(){
	let user = this.user;
	let msg = createMessage('join', user, `${user.name} joined.`);
	this.wss.broadcast(msg);

	let users = this.wss.clients.map(function(client){
		return client.user;
	});
	this.send(createMessage('list', user, users));
}

function onMessage(message){
	if(message && message.trim()){
		let msg = createMessage('chat', this.user, message.trim());
		this.wss.broadcast(msg);
	}
}

function onClose(){
	let user = this.user;
	let msg = createMessage('left', user, `${user.name} is left.`);
	this.wss.broadcast(msg);
}

app.wss = createWebSocketServer(server, onConnection, onMessage, onClose);

console.log('app started at port 3000 ...');