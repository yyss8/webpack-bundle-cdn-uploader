# webpack-bundle-cdn-uploader

   <img src="https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/example/output-screenshot.png?raw=true" width="350">
 
    在webpack打包完成后将打包文件上传至对应CDN, 开箱即用, 不需要自己配置上传功能

### 测试环境

 - webpack 3@3.11.2
 - webpack 4@4.15.1

### 安装/使用

```

npm install --save-dev webpack-bundle-cdn-uploader

const CdnUploadPlugin = require('webpack-bundle-cdn-uploader');

//实际参数以及介绍参考底下参数一栏
const uploaderOptions = {
    cdn:{
        type:'[qiniu|txcos]', //腾讯txcos或七牛qiniu, 下面的key和id只有对应的
        accessKey:'[your.qiniu.access_key|your.txcos.secretId]', //替换成你的七牛accessKey或者腾讯cos的secretId
        secretKey:'[your.qiniu.secret_key|your.txcos.secretKey]', //替换成你的七牛secretKey或者腾讯cos的secretKey
        bucket:'[your.bucket]', //替换成你的腾讯/七牛上传bucket名称
        host:'[your.region]' //替换你的腾讯/七牛存储区域, 实际哪个区域得查看对应文档
    },
    deletePrevious:true, //是否从CDN上删除上一次上传的bundle文件
    deleteOutput:true //是否删除webpack打包后的文件
};

module.exports = {
    // ...
    plugins: [
        new CdnUploadPlugin(uploaderOptions)
    ]
}

#webpack配置文件例子请查看example目录下的对应版本config.sample文件

```

### 支持CDN列表

- 七牛 - 使用自己封装的上传工具
- 腾讯cos - 使用官方SDK

### 参数

- `cdn`: CDN参数
     * `type`:`qiniu|txcos` CDN类型, (必填) 其余所需参数通过这个变量来判断 (七牛:qiniu|腾讯txcos)
     * `bucket`: 所上传的bucket名称, (暂时必填) 大部分对象存储提供商都类似 
     * `test`:需要上传文件后缀的正则, 默认(/\.css|\.js/)
     * `accessKey`: 对应的cdn access key: (必填) (七牛为access key|腾讯为secret id)
     * `secretKey`: 对应的cdn secret key: (必填) (七牛为secret key|腾讯为secret key)
     * `host`: 服务器区域代码, (必填) 例如七牛z1,或腾讯cos的ap-shanghai
- `deletePrevious`: (true/false) (默认false) 是否从CDN上删除上一次上传的bundle文件, 大部分存储提供商都可以对相同文件名进行覆盖, 所以无需开启, 主要用于更换cdn后删除原cdn信息
- `deleteOutput`: (true/false)  (默认false) 是否删除webpack打包后的文件

### 注意

- 如果使用了html打包插件那么publicPath记得设置为CDN地址而非本地目录地址, 同时其他使用了该地址的资源也都需要替换或者上传至CDN
- 打包结束后会在webpack配置中的输出目录产生一个`wp.previous.json`文件记录上一次的打包以及输出配置, 如果需要在每次打包后删除CDN上的旧资源请不要删除这个文件

### 欢迎在Issues里提各种需求和bug