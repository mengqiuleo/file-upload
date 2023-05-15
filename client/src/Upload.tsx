import React, { useEffect, useState } from "react";
import { Row, Col, Input, Button, message } from 'antd'
import {  request } from './utils'
const DEFAULT_SIZE = 1024 * 1024 * 100
interface Part {
  chunk: Blob;
  size: number;
}


function MyUpload() {
  let [currentFile, setCurrentFile] = useState<File>() //2.声明hook，将文件状态存储一下
  let [objectURL, setObjectURL] = useState<string>('')

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

    //----------一、最初实现: basic-upload-----------------
    const formData = new FormData() //创建向后端发送的表单，然后向表单中添加字段, 这里是添加了两个字段
    formData.append('chunk', currentFile) //添加文件，字段名chunk
    formData.append('filename', currentFile.name) //bg.jpg
    console.log('formData: ', formData)
    let result = await request({
      url: '/upload',
      method: 'POST',
      data: formData
    })
    console.log(result)
    message.info('上传成功')
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