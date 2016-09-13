/*读取 static 目录下的静态文件*/ 
const path = require('path');
const mime = require('mime');
const fs = require('mz/fs');

function staticFiles(url, dir){
	return async (ctx, next) => {
		let rpath = ctx.request.path;
		if(rpath.startsWith(url)){
			let fp = path.join(dir, rpath.substring(url.length));
			console.log('static---------' + fp);
			if(await fs.exists(fp)){
				ctx.response.type = mime.lookup(rpath);
				ctx.response.body = await fs.readFile(fp);
			} else {
				ctx.response.status = 404;
			}
		} else {
			await next();
		}
	}
}

module.exports = staticFiles;