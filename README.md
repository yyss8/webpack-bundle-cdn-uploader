# webpack-bundle-cdn-uploader

   <img src="https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/example/output-screenshot.png?raw=true" width="350">
 
[ENGLISH VERSION](https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/README-EN.MD)

    在Webpack打包完成后自动将打包文件上传至对应CDN或FTP, 开箱即用.

### 测试环境

 - webpack 3@3.12.0
 - webpack 4@4.25.1

### 安装/使用

```

npm install --save-dev webpack-bundle-cdn-uploader

const CdnUploadPlugin = require('webpack-bundle-cdn-uploader');

//实际参数以及介绍参考底下参数一栏
const uploaderOptions = {
    cdn:{
        type:'[qiniu|txcos|ftp|s3]',
        accessKey:'[your.qiniu.access_key|your.txcos.secretId|your.s3.access]'
        secretKey:'[your.qiniu.secret_key|your.txcos.secretKey|your.s3.secret]',
        bucket:'[your.cdn.bucket]',
        host:'[your.region]' //AWS s3无需填写
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

//webpack配置文件例子请查看example目录下的对应版本config.sample文件

```

### 支持CDN列表

- 七牛 - 使用自己封装的上传工具
- 腾讯cos - 使用官方SDK
- ftp - 稍微封装了几个用到的函数成支持async/await, 底层使用node-ftp包, 参数参考: `https://github.com/mscdex/node-ftp`
- AWS s3 - 使用Knox, 参数参考: `https://github.com/Automattic/knox`

### 参数

- `cdn`: `object|array` CDN参数 (传入Array则可以上传至不同的CDN, 子参数与以下相同, 并且必须传入test参数作为文件区分), 
     * `type`:`qiniu|txcos|s3|ftp` CDN类型, (必填) 其余所需参数通过这个变量来判断 (七牛:qiniu|腾讯txcos|S3|FTP)
     * `bucket`: 所上传的bucket名称, (暂时必填) 大部分对象存储提供商都类似 
     * `test`:需要上传文件后缀的正则, 默认(/\.css|\.js/)
     * `accessKey`: 对应的cdn access key: (必填) (七牛为access key|腾讯为secret id)
     * `secretKey`: 对应的cdn secret key: (必填) (七牛为secret key|腾讯为secret key)
     * `host`: 服务器区域代码, (必填, S3无需填写, FTP为IP地址) 例如七牛z1,或腾讯cos的ap-shanghai
     * `port`: (FTP独有) FTP服务器的IP端口, 默认 `21`,
     * `user`: (FTP独有) FTP用户名, 默认 `anonymous`
     * `password`:(FTP独有) FTP密码, 默认 `anonymous@`
- `deletePrevious`: (true|false) (默认false) 是否从CDN上删除上一次上传的bundle文件, 大部分存储提供商都可以对相同文件名进行覆盖, 所以无需开启, 主要用于更换cdn后删除原cdn信息
- `deleteOutput`: (true|false)  (默认false) 是否删除webpack打包后的文件
- `lang`: (en|cn|[自定义输出语言文件路径]) console.log输出语言, 默认(cn), 如果要输出自己的文字则传入语言文件地址

### 注意

- CDN参数传入Array时暂时只支持上传至不同CDN, 同CDN不同bucket待开发 
- 如果使用了html打包插件那么publicPath记得设置为CDN地址而非本地目录地址, 同时其他使用了该地址的资源也都需要替换或者上传至CDN
- 打包结束后会在webpack配置中的输出目录产生一个`wp.previous.json`文件记录上一次的打包以及输出配置, 如果需要在每次打包后删除CDN上的旧资源请不要删除这个文件
- webpack 3 上下的ftp上传可能会无法自动结束node进程, 需要手动CTRL+C结束, webpack 4下貌似正常
- 通过正则匹配上传js以及css文件至不同CDN虽然支持但是并不推荐, 因为该插件并不修改打包内容所以如果css地址不同需要手动修改输出的html文件, 甚至js内容. 

### 欢迎在Issues里提各种需求和bug