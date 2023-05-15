import path from 'path';
import fs, {WriteStream} from 'fs-extra'
export const TEMP_DIR = path.resolve(__dirname, 'temp');
export const PUBLIC_DIR = path.resolve(__dirname, 'public');


/**
 * 一个例子看看如何分片
 * 一般是会在客户端切，在服务端合并
 * 前端切blob 后端切buffer
 */
const DEFAULT_SIZE = 1024 * 1024 // 每 10KB 切一片
export const splitChunks = async (filename: string, size: number = DEFAULT_SIZE) => {
  let filePath = path.resolve(PUBLIC_DIR, filename) //要分割的文件绝对路径
  const chunksDir = path.resolve(TEMP_DIR, filename) //以文件名命名的临时目录，存放分割后的文件
  await fs.mkdirp(chunksDir) //递归创建文件目录
  // content是把我们的上传的文件读取出来
  let content = await fs.readFile(filePath) //#是一个Buffer, Buffer是一个字节数组 1个字节是8Bit位
  let i = 0, current = 0, length = content.length //current是我们当前已经读取了多少数据，是一个索引
  while(current < length) { //当前索引 < 文件大小length
    await fs.writeFile(
      path.resolve(chunksDir, filename + '-' + i), //i相当于对我们分片出来的东西标号
      content.slice(current, current + size) 
    )
    i++
    current += size
  }
} 
// splitChunks('bg.jpg')
// 执行 npm run utils 就可以对我们上传的文件分片，然后去temp文件夹下看分出来的东西


/**
 * 一个例子看看如何合并
 * 1.读取 temp 目录下 bg.jpg 目录里所有的文件
 * 2.把它们累加在一起，另外一旦加过了要把 temp 目录里的文件删除
 * 3.为了提高性能，尽量用流来实现，不要 readFile,writeFile
 */
// pipeStream 创建可读流: 读入文件，写入一个流
const pipeStream = (filePath:string, ws: WriteStream) => {
  return new Promise((resolve: Function, reject: Function) => {
    let rs = fs.createReadStream(filePath) // filePath是我们要合并的某个分片，rs是创建一个流
    rs.on('end', async () => {
      //rs.close() //当往流里面灌完了，就关闭
      await fs.unlink(filePath) //这里是把文件删掉，至于关闭，它会自己关
      resolve()
    })
    rs.pipe(ws) //rs创建一个可读流，然后 pipe 是往里面灌，把可读流灌到可写流
  })
}
export const mergeChunks = async (filename: string, size: number = DEFAULT_SIZE) => {
  const filePath = path.resolve(PUBLIC_DIR,filename) //合并到哪个文件目录
  const chunksDir = path.resolve(TEMP_DIR, filename) //哪个文件需要合并
  const chunkFiles = await fs.readdir(chunksDir)
  //按文件名升序
  chunkFiles.sort((a,b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
  await Promise.all(chunkFiles.map((chunkFile: string, index: number) => pipeStream(
    path.resolve(chunksDir, chunkFile),//将每个分片补成绝对路径
    fs.createWriteStream(filePath, { //给当前文件创建一个可写流
      start: index * size
    })
  )))
  await fs.rmdir(chunksDir) //删除文件夹
}
// mergeChunks('bg.jpg')

