# webpack-bundle-cdn-uploader [![npm version](https://img.shields.io/badge/npm-0.4.2-blue.svg?style=flat)](https://www.npmjs.com/package/webpack-bundle-cdn-uploader)

   <img src="https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/example/output-screenshot.png?raw=true" width="350">

[中文翻译](https://github.com/yyss8/webpack-bundle-cdn-uploader/blob/master/README.md)

    An open-box webpack plugin to upload your compiled bundle files to CDN stroages or FTP server

### Tested Environments

 - webpack 3@3.12.0
 - webpack 4@4.25.1

### Installation/Usage

```

npm install --save-dev webpack-bundle-cdn-uploader

const CdnUploadPlugin = require('webpack-bundle-cdn-uploader');

//Reference to the Configurations section below
const uploaderOptions = {
    cdn:{
        type:'[qiniu|txcos|ftp|s3]',
        accessKey:'[your.qiniu.access_key|your.txcos.secretId|your.s3.access]'
        secretKey:'[your.qiniu.secret_key|your.txcos.secretKey|your.s3.secret]',
        bucket:'[your.cdn.bucket]',
        host:'[your.region|]' not required for AWS s3
    },
    deletePrevious:true, //Should delete previous uploaded bundle files
    deleteOutput:true //Should delete output bundle files
};

module.exports = {
    // ...
    plugins: [
        new CdnUploadPlugin(uploaderOptions)
    ]
}

//Webpack configuration example files are provided under the example folder

```

### Supported CDNs

- Qiniu
- Tengxun Cos
- FTP - additional config options references to: `https://github.com/mscdex/node-ftp`
- AWS S3 - additional config options references to: `https://github.com/Automattic/knox`

### Configurations

- `cdn`: `object|array` CDN options, pass in array for uploading bundle files to different CDN storages
     * `type`:`qiniu|txcos|s3|ftp` CDN type, (required)
     * `bucket`: Bucket name, (optional for FTP) 
     * `test`:Regex pattern, default (/\.css|\.js/) (required for uploading to multiple CDN)
     * `accessKey`: CDN API-KEY or Access key: (required)
     * `secretKey`: CDN Secret Key: (required)
     * `host`: CDN area code, (not required for S3, use as hostname for FTP)
     * `port`: (Only for FTP) FTP Host Port, default `21`,
     * `user`: (Only for FTP) ftp username, default `anonymous`
     * `password`:(Only for FTP) ftp password, default `anonymous@`
     * `destPath`:(Only for FTP) path to store output files
     * `contentType` (Only for S3), file output content-type (default:text/plain) (read note for uploading HTML file)
     * `permission` (Only for S3), file reading permission (default:public-read)
     * `metas` (Only for s3), file output metas (optional)
- `deletePrevious`: (true|false) (default: false) Should delete previous uploaded files, most CDN storages overwrites files with same name. Therefore, it's most likely only needed for FTP or changing CDN storage provider
- `deleteOutput`: (true|false)  (default: false) Should delete output bundle files
- `lang`: (en|cn|[YOUR_LANG_FILE_PATH]) console.log output language, default: (cn), or your custom language file path, references to lang.js.sample file in example folder
- `logPath`:upload log output path, (default: webpack output path)
- `logName`:upload log output name, (default: wp.previous)

### Note

- At this moment (v0.3), the plugin only support uploading files to single or different CDN storages, uploading files to different buckets of same CDN will be supported in future releases.
- if a webpack HTML plugin like `html-webpack-plugin` is used, the publicPath should be changed to CDN url instaed of a local path
- a file named `wp.previous.json` will be generated after each compile to record the previous upload details, please don't delete this file if you want this plugin to delete previous upload files
- try to CTRL+C to end process if the webpack process is ended automatically with webpack 3
- Uploading js and style assets to different CDN storage is supported but not recommanded, because this plugin doesn't change the content of compiled files. Therefore, you will need to change the related output urls if you would like to do so.
- For uploading HTML file to AWS S3, the output content-type need to be changed to `text/html`,  you can do that by changing the metadata on aws s3 console once the file is uploaded. You can also set up the `contentType` option but it's only recommanded when you are ONLY uploading the html file to s3 because it would also apply the option to all other bundle files that you are uploading.