import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import logger from 'morgan'; //打印日志
import { INTERNAL_SERVER_ERROR } from 'http-status-codes'; // 500
import cors from 'cors';// 跨域
import path from 'path'; 
import { PUBLIC_DIR } from './utils';
import fs from 'fs-extra';
import multiparty from 'multiparty'; // 处理上传文件
let app = express();
app.use(logger('dev')); //打印日志，dev指开发日志格式
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static(path.resolve(__dirname, 'public')));

// * 上传文件
app.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    let form = new multiparty.Form();
    form.parse(req, async (err: any, fields, files) => {
        if (err) {
            return next(err); // 走这个next会直接调下面的处理错误的中间件
        }
        console.log('fields: ', fields)
        console.log('files: ', files)
        let [filename] = fields.filename;
        let [chunk] = files.chunk;
        await fs.move(chunk.path, path.resolve(PUBLIC_DIR, filename), { overwrite: true });
        // fs.move 将文件从临时文件夹中移走
        setTimeout(() => {
            res.json({
                success: true
            });
        }, 3000);
    });
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