import React, { useEffect, useState } from "react";
import { Row, Col, Input, Button, message, Table, Progress } from 'antd'
import { request } from './utils';
const DEFAULT_SIZE = 1024 * 1024 * 100 //每块100MB
interface Part {
  chunk: Blob;
  size: number;
  filename?: string;
  chunk_name?: string
  percent?: number
  loaded?: number
  xhr?: XMLHttpRequest
}
enum UploadStatus {
  INIT,
  PAUSE,
  UPLOADING
}
interface Uploaded {
  filename: string
  size: number
}

function MyUpload() {
  let [currentFile, setCurrentFile] = useState<File>() //2.声明hook，将文件状态存储一下
  let [objectURL, setObjectURL] = useState<string>('')
  let [hashPercent, setHashPercent] = useState<number>(0) //计算hash的百分比
  let [filename, setFilename] = useState<string>('')
  let [partList, setPartList] = useState<Part[]>([])
  let [uploadStatus, setUploadStatus] = useState<UploadStatus>(UploadStatus.INIT)



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
  function reset() {
    setUploadStatus(UploadStatus.INIT)
    setHashPercent(0)
    setPartList([])
    setFilename('')
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
    function createChunks(file:File): Part[] {
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
          console.log('percent', percent)
          setHashPercent(percent)
          if(hash){
            resolve(hash)
          }
        }
      })
    }
    setUploadStatus(UploadStatus.UPLOADING)
    let partList: Part[] = createChunks(currentFile) //拿到分片的数组
    //先计算这个对象哈希值，哈希值是为了实现秒传的功能，就是每个文件有个哈希值，那么下次上传这个文件时就可以判断已经上传过了
    //我们通过子进程 web Worker 来计算哈希
    let fileHash = await calculateHash(partList)
    let lastDotIndex = currentFile.name.lastIndexOf('.') //bg.jpg 这里是拿到.jpg
    let extName = currentFile.name.slice(lastDotIndex) //.jpg
    let filename = `${fileHash}${extName}` //xxxhash.jpg
    setFilename(filename)
    partList.forEach((item: Part, index) => {
      item.filename = filename
      item.chunk_name = `${filename}-${index}`
      item.loaded = 0
      item.percent = 0
    })
    setPartList(partList)
    await uploadParts(partList, filename)
  }
  async function verify(filename:  string){
    return await request({
      url: `/verify/${filename}`
    })
  }
  async function uploadParts(partList:Part[], filename: string){
    let { needUpload, uploadList } = await verify(filename)
    if(!needUpload){
      message.success('秒传成功')
    }
    try{
      let requests = createRequests(partList, uploadList, filename)
      await Promise.all(requests)
      await request({url: `/merge/${filename}`})
      message.success('上传成功')
      reset()
    } catch(error) {
      message.error('上传失败或暂停')
      // uploadParts(partList, filename)
    }
  }
  function createRequests(partList: Part[], uploadList: Uploaded[], filename: string){
    return partList.filter((part: Part) => {
      let uploadFile = uploadList.find(item => item.filename === part.chunk_name)
      if(!uploadFile){
        part.loaded = 0 //已经上传的字节数为0
        part.percent = 0 //已经上传的百分比为0
        return true
      }
      if(uploadFile.size < part.chunk.size){
        part.loaded = uploadFile.size
        part.percent = Number((part.loaded/part.chunk.size*100).toFixed(2))
        return true
      } 
      return false
    }).map((part: Part) => request({
      url: `/upload/${filename}/${part.chunk_name}/${part.loaded}`,
      method: 'POST', 
      headers: {'Content-Type': 'application/octet-stream'},
      setXHR: (xhr: XMLHttpRequest) => part.xhr = xhr,
      onProgress: (event:ProgressEvent) => {
        part.percent = Number(((part.loaded! + event.loaded)/part.chunk.size*100).toFixed(2))
        setPartList([...partList])
      },
      data: part.chunk.slice(part.loaded)
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
  async function handlePause(){
    partList.forEach((part:Part) => part.xhr && part.xhr.abort())
    setUploadStatus(UploadStatus.PAUSE)
  }
  async function handleResume(){
    setUploadStatus(UploadStatus.UPLOADING)
    await uploadParts(partList, filename)
  }
  const columns = [
    {
      title: '切片名称',
      dataIndex: 'filename',
      key: 'filename',
      width: '20%'
    },
    {
      title: '进度',
      dataIndex: 'percent',
      key: 'percent',
      width: '80%',
      render: (value: number) => {
        return <Progress percent={value} />
      }
    }
  ]
  let totalPercent = partList.length>0 ? partList.reduce(
    (acc:number, curr:Part) => acc+curr.percent!, 0)/(partList.length*100)*100 : 0
  console.log('totalPercent', totalPercent)
  let uploadProgress = uploadStatus !== UploadStatus.INIT ? (
    <>
      <Row>
        <Col span={4}>
          hash进度:
        </Col>
        <Col span={20}>
          <Progress percent={hashPercent}></Progress>
        </Col>
      </Row> 
      <Row>
        <Col span={4}>
          总进度:
        </Col>
        <Col span={20}>
          <Progress percent={totalPercent}></Progress>
        </Col>
      </Row> 
      <Table columns={columns} dataSource={partList} rowKey={row => row.chunk_name!}></Table>
    </>  
  ) : null
  return (
    <>
      <Row>
        <Col span={12}>
          {/* 这里是默认就会出现上传文件的模态框，不关我们的事，本来还在想普通的input为什么会出现上传文件的模态框 */}
          <Input type="file" style={{width: 300}} onChange={handleChange} />
          {
            uploadStatus === UploadStatus.INIT && 
            <Button type="primary" onClick={handleUpload} style={{marginLeft: 10}}>上传</Button>
          }
          {
            uploadStatus === UploadStatus.UPLOADING && 
            <Button type="primary" onClick={handlePause} style={{marginLeft: 10}}>暂停</Button>
          }
          {
            uploadStatus === UploadStatus.PAUSE && 
            <Button type="primary" onClick={handleResume} style={{marginLeft: 10}}>恢复</Button>
          }
          
        </Col>
        <Col span={12}>
          <div>显示文件的预览信息</div>
          {objectURL && <img src={objectURL} style={{width:100}}/>}
        </Col>
      </Row> 
      
      {uploadProgress}
    </>
  )
}

export default MyUpload