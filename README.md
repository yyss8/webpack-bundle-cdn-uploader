# webpack-bundle-cdn-uploader

   <img src="https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/example/output-screenshot.png" width="350">
 
    在webpack打包完成后将打包文件上传至CDN, 开箱即用, 不需要自己配置上传功能

### 环境

    只在Webpack 4测试过, webpack 3暂未测试


### 安装

```
$ npm install --save-dev webpack-bundle-cdn-uploader
```

### 支持CDN列表

    暂时只支持七牛, 有时间再增加

### 参数

- `cdn`: CDN参数, 暂时只支持七牛, 所以用七牛参数举例
     * `type`:`qiniu` CDN名称, (必填) 其余所需参数通过这个变量来判断
     * `bucket`: 所上传的bucket名称, 大部分存储都类似所以暂时必填
     * `accessKey`: 七牛Access_key
     * `secretKey`: 七牛Secret_key
     * `host`:七牛服务器区域代码, 例如z1
     * `test`:需要上传的文件后缀的正则, 默认(/\.css|\.js/)
- `deletePrevious`: (true/false)是否从CDN上删除上一次上传的bundle文件 (默认false)
- `deleteOutput`: (true/false) 是否删除webpack打包后的文件 (默认false)

### 注意

- 因为通过publicPath被设置成了CDN链接, 所以其他使用了该地址的链接都必须被上传至CDN
- 对打包数据显示这一块不熟悉, 所以用了本插件可能会造成output分析数据不显示, 还在想方法解决中