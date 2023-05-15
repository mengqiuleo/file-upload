import React, { useEffect, useState } from "react";
import { Row, Col, Input, Button, message } from 'antd'
import { request } from './utils';
// const DEFAULT_SIZE = 1024 * 1024 * 100 //每块100MB
const DEFAULT_SIZE = 1024 * 1024 //每块1MB
interface Part {
  chunk: Blob;
  size: number;
  filename?: string;
  chunk_name?: string
}

function MyUpload() {
  let [currentFile, setCurrentFile] = useState<File>() //2.声明hook，将文件状态存储一下
  let [objectURL, setObjectURL] = useState<string>('')
  let [hashPercent, setHashPercent] = useState<number>(0) //计算hash的百分比
  let [filename, setFilename] = useState<string>('') //保存当前文件名，这个文件名是带hash的
  let [partList, setPartList] = useState<Part[]>([])

  // 4.当文件改变时，更新预览信息，如何监听？ useEffect
  useEffect(() => {
    // 方式一：浏览器升级后不支持这中写法了
    // const URL = window.URL
    // objectURL = URL.createObjectURL(currentFile as Blob | MediaSource)
    
    // 方式二
    let binaryData: BlobPart[] = []
    binaryData.push(currentFile as BlobPart)
    objectURL = window.URL.createObjectURL(new Blob(binaryData)) //重新赋值了URL地址，这样就会刷新组件
    setObjectURL(objectURL)
    return () => URL.revokeObjectURL(objectURL) //销毁的时候执行：删除当前URL占用的资源

    // 方式三
    // const reader = new FileReader()
    // reader.addEventListener('load', () => setObjectURL(reader.result as string))
    // reader.readAsDataURL(currentFile as Blob)
  }, [currentFile])
  
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    let file: File = event.target.files![0]
    console.log(file) //1.这里就是我们选择的上传的文件的信息
    setCurrentFile(file) //3.当我们拿到最新的文件信息时需要存储
  }
  async function handleUpload(){
    if(!currentFile){
      //如果没有文件
      return message.error('尚未选择文件')
    }
    if(!allowUpload(currentFile)){ //判断上传的文件是否合法
      return message.error('不支持此类型的文件进行上传')
    }

    //----------二、分片上传-----------------
    function createChunks(file:File): Part[] { //创建分片数组
      let current = 0
      let partList:Part[] = []
      while(current < file.size) {
        let chunk: Blob = file.slice(current, current + DEFAULT_SIZE)
        partList.push({chunk, size: chunk.size})
        current += DEFAULT_SIZE
      }
      return partList
    }
    function calculateHash(partList: Part[]){
      return new Promise((resolve:Function, reject:Function) => {
        let worker = new Worker('/hash.js')
        worker.postMessage({partList})
        worker.onmessage = function(event){
          let { percent, hash } = event.data
          console.log('当前计算hash进度, percent', percent)
          setHashPercent(percent)
          if(hash){
            resolve(hash)
          }
        }
      })
    }
    let partList: Part[] = createChunks(currentFile) //拿到分片的数组
    //先计算这个对象哈希值，哈希值是为了实现秒传的功能，就是每个文件有个哈希值，那么下次上传这个文件时就可以判断已经上传过了
    //我们通过子进程 web Worker 来计算哈希
    let fileHash = await calculateHash(partList) //计算hash
    let lastDotIndex = currentFile.name.lastIndexOf('.') //bg.jpg 这里是拿到.jpg
    let extName = currentFile.name.slice(lastDotIndex) //.jpg
    let filename = `${fileHash}${extName}` //hash.jpg
    setFilename(filename)
    partList.forEach((item: Part, index) => { //给每一个分片整理
      item.filename = filename
      item.chunk_name = `${filename}-${index}`
      item.loaded = 0
      item.percent = 0
    })
    setPartList(partList)
    await uploadParts(partList, filename)
  }
  async function uploadParts(partList:Part[], filename: string){
    let requests = createRequests(partList, filename)
    await Promise.all(requests)
    await request({url: `/merge/${filename}`})
    message.info('上传成功!')
  }
  function createRequests(partList: Part[], filename: string){
    return partList.map((part: Part) => request({
      url: `/upload/${filename}/${part.chunk_name}`,
      method: 'POST', 
      headers: {'Content-Type': 'application/octet-stream'},
      data: part.chunk
    }))
  }
  function allowUpload(file: File) { //判断上传的文件是否合法：主要是判断文件大小还有文件类型
    let type = file.type
    let isValidFileTypes = ["image/jpeg", "image/png", "image/gif", "video/mp4"].includes(type)
    if(!isValidFileTypes){
      message.error('不支持此类文件上传')
    }
    // 文件大小的单位是字节 1024字节=1kb*1024=1M*1024=1G*2=2G
    const isLessThan2G = file.size < 1024*1024*1024*2
    if(!isLessThan2G){
      message.error('上传的文件不能大于2G')
    }
    return isLessThan2G && isValidFileTypes
  }
  return (
    <Row>
      <Col span={12}>
        {/* 这里是默认就会出现上传文件的模态框，不关我们的事，本来还在想普通的input为什么会出现上传文件的模态框 */}
        <Input type="file" style={{width: 300}} onChange={handleChange} />
        <Button type="primary" onClick={handleUpload} style={{marginLeft: 10}}>上传</Button>
      </Col>
      <Col span={12}>
        <div>显示文件的预览信息</div>
        {objectURL && <img src={objectURL} style={{width:100}}/>}
      </Col>
    </Row>  
  )
}

export default MyUpload