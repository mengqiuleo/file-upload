import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import logger from 'morgan'; //打印日志
import { INTERNAL_SERVER_ERROR } from 'http-status-codes'; // 500
import cors from 'cors';// 跨域
import path from 'path'; 
import { PUBLIC_DIR, TEMP_DIR, mergeChunks } from './utils';
import fs from 'fs-extra';
import multiparty from 'multiparty'; // 处理上传文件
let app = express();
app.use(logger('dev')); //打印日志，dev指开发日志格式
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static(path.resolve(__dirname, 'public')));

// * 上传文件
app.post('/upload/:filename/:chunk_name', async (req: Request, res: Response, next: NextFunction) => {
  let { filename, chunk_name } = req.params
  let chunk_dir = path.resolve(TEMP_DIR, filename)
  let exist = await fs.pathExists(chunk_dir)
  if(!exist){
    await fs.mkdirs(chunk_dir)
  }
  let chunkFilePath = path.resolve(chunk_dir, chunk_name)
  // flags append 后面实现断点续传
  let ws = fs.createWriteStream(chunkFilePath, { start: 0, flags: 'a' })
  req.on('end', () => {
    ws.close()
    res.json({ success: true })
  })
  req.pipe(ws)
});

app.get('/merge/:filename', async (req: Request, res: Response, next: NextFunction) => {
    let { filename, chunk_name } = req.params
    await mergeChunks(filename)
    res.json({ success: true })
  });
/**
fields:  { filename: [ 'bg.jpg' ] }
files:  {
  chunk: [
    {
      fieldName: 'chunk',
      originalFilename: 'bg.jpg',
      path: 'C:\\Users\\lenovo\\AppData\\Local\\Temp\\ZVJYaERmUDJSXwHfGD8CJtL0.jpg',
      headers: [Object],
      size: 3262258
    }
  ]
}

我们上传的文件会放到临时文件夹中：C:\\Users\\lenovo\\AppData\\Local\\Temp\\ZVJYaERmUDJSXwHfGD8CJtL0.jpg
 */

// 处理错误中间件
app.use(function (_req: Request, _res: Response, next: NextFunction) {
    next(createError(404));
});

// 处理错误中间件：从上面的这个处理错误的中间件传下来
app.use(function (error: any, _req: Request, res: Response, _next: NextFunction) {
    res.status(error.status || INTERNAL_SERVER_ERROR);
    res.json({
        success: false,
        error
    });
});

export default app;