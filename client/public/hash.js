self.importScripts('https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.js'); //计算hash的一个脚本
self.onmessage = async (event) => {
  let { partList } = event.data //拿到主进程传过来的数组
  const spark = new self.SparkMD5.ArrayBuffer();
  let percent = 0 //总体计算hash的百分比
  let perSize = 100/partList.length //每计算完一个part，相当于完成了百分之几
  let buffers = await Promise.all(partList.map(({ chunk, size }) => new Promise(function(resolve){
    const reader = new FileReader()
    reader.readAsArrayBuffer(chunk)//将每一个分片从blob格式变成arrayBuffer格式
    reader.onload = function (event){
      percent += perSize
      self.postMessage({ percent: Number(percent.toFixed(2)) })
      resolve(event.target.result)
    }
  })))
  buffers.forEach(buffer => spark.append(buffer)) //计算 hash
  // 通知主进程，当前的哈希已经全部完成，并且把最终的hash值给主进程
  self.postMessage({ percent: 100, hash: spark.end() })
  self.close()
}
//self是一个全局变量，代表当前窗口
//# File => 多个Blob => 读取Blob读成ArrayBuffer => spark计算哈希值