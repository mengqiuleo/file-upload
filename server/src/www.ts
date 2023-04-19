// www.ts 用来启服务，相当于入口

import app from './app'; //app文件写配置项，调用了那些中间件：app.use
import http from 'http';

const port = process.env.PORT || 8000;

const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
function onError(error: any) {
    console.error(error);
}
function onListening() {
    console.log('Listening on ' + port);
}