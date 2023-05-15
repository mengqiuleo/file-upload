interface OPTIONS {
  method: string,
  url: string,
  headers?: any,
  data: any,
  baseURL?: string
}

export function request(options: OPTIONS): Promise<any> {
  let defaultOptions = {
    method: 'GET',
    baseURL:'http://localhost:8000',
    headers: {},
    data: {}
  }
  options = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...(options.headers || '')}}
  // 这里的 headers 其实就是：name='chunk', filename='bg.jpg' 
  return new Promise(function (resolve: Function, reject: Function) {
    let xhr = new XMLHttpRequest()
    xhr.open(options.method, options.baseURL + options.url)
    for(let key in options.headers){
      xhr.setRequestHeader(key, options.headers[key])
    }
    xhr.responseType = 'json'
    xhr.onreadystatechange = function() {
      if(xhr.readyState == 4){
        if(xhr.status === 200){
          resolve(xhr.response)
        } else {
          reject(xhr.response)
        }
      }
    }
    xhr.send(options.data)
  })
}