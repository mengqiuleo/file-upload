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
app.post('/upload/:filename/:chunk_name/:start', async (req: Request, res: Response, next: NextFunction) => {
  let { filename, chunk_name } = req.params
  let start: number = Number(req.params.start)
  let chunk_dir = path.resolve(TEMP_DIR, filename)
  let exist = await fs.pathExists(chunk_dir)
  if(!exist){
    await fs.mkdirs(chunk_dir)
  }
  let chunkFilePath = path.resolve(chunk_dir, chunk_name)
  // flags append 后面实现断点续传
  let ws = fs.createWriteStream(chunkFilePath, { start, flags: 'a' })
  req.on('end', () => {
    ws.close()
    res.json({ success: true })
  })

  // req.pipe(ws) //这里将前端传过来的分片读入到temp目录下

  req.on('error', () => {
    ws.close()
  })
  req.on('close', () => {
    ws.close()
  })
  req.pipe(ws)

});

app.get('/merge/:filename', async (req: Request, res: Response, next: NextFunction) => {
    let { filename } = req.params
    await mergeChunks(filename)
    res.json({ success: true })
  });

// # 断点续传：每次先计算hash值，
app.get('/verify/:filename', async (req:Request, res: Response) => {
  let { filename } = req.params
  let filePath = path.resolve(PUBLIC_DIR, filename)
  let existFile = await fs.pathExists(filePath)
  if(existFile){
    return {
      success: true,
      needUpload: false //已经上传过了
    }
  }
  let tempDir = path.resolve(TEMP_DIR, filename)
  let exist = await fs.pathExists(tempDir)
  let uploadList: any[] = []
  if(exist) {
    uploadList =  await fs.readdir(tempDir)
    uploadList = await Promise.all(uploadList.map(async (filename: string) => {
      let stat = await fs.stat(path.resolve(tempDir, filename))
      return {
        filename,
        size: stat.size //现在的文件大小 100M 30M
      }
    }))
  }
  res.json({
    success: true,
    needUpload: true,
    uploadList //已经上传的文件列表
  })
})
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