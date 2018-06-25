# webpack-bundle-cdn-uploader

在webpack打包完成后将打包文件上传至CDN

### 安装

```
$ npm install --save-dev webpack-bundle-cdn-uploader
```

### 参数

- `cdn`: CDN参数, 暂时只支持七牛, 所以用七牛参数举例
     * `type`:`qiniu` CDN名称, (必填) 其余所需参数通过这个变量来判断
     * `bucket`: 所上传的bucket名称, 大部分存储都类似所以暂时必填
     * `accessKey`: 七牛Access_key
     * `secretKey`: 七牛Secret_key
     * `host`:七牛服务器区域代码, 例如z1
- `deletePrevious`: (True/False)是否从CDN上删除上一次上传的bundle文件 (默认True)
- `deleteOutput`: (True/Flase) 是否删除webpack打包后的文件 (默认True)

### 注意

- 因为通过publicPath被设置成了CDN链接, 所以其他使用了该地址的链接都必须被上传至CDN
- 对打包数据显示这一块不熟悉, 所以用了本插件可能会造成output分析数据不显示, 还在想方法解决中