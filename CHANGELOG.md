# Changelog 改动记录

## [0.5.1] - 2019-08-08

- Updates change log file - 更新改动记录.

## [0.5.0] - 2019-08-08
- Removes unwanted testing files - 删除无用的测试文件.
- Replaces http handler of qiniu - 七牛上传模块使用 request 替换原生 https.
- Reformats coding style - 更新代码风格.

## [0.4.5 - 0.4.7] - 2019-06-30

- Fixes incorrect path of non-js files - 修复非 JS 资源错误路径.
- Fixes previous files not able to be deleted under multiple cdn mode - 修复多 CDN 上传状态下无法删除过往文件.
- Updates code formatting - 代码格式更新.

## [0.4.4] - 2019-01-19

- Custom output file name added - 允许自定义输出文件名称, 用于上传至不同路径

## [0.4.3] - 2019-01-19

- Different file directory path fetching method used for FTP - 优化 FTP 文件路径获取方法

## [0.4.2] - 2019-01-15

- Optimzed FTP upload and delete - 优化 FTP 上传和删除功能

## [0.4.1] - 2019-01-12

- Optimzed FTP upload and delete - 优化 FTP 上传和删除功能
- Dependencies updated - 更新依赖包

## [0.4] - 2019-01-09

- Duplicated file path issue fixed for Mac - 解决 Mac 下上传文件地址重复的问题
- Switched from new Buffer to Buffer.from to avoid deprecated warnings - 更改 Buffer 使用方法避免过期警告
- Optimzed FTP upload - 优化 FTP 上传
- Fixed issue of not being able to delete previous files - 修复无法删除 CDN 文件的问题

## [0.3] - 2018-11-17

- Allowing different files to be uploaded to different CDN by using Regex - 支持通过正则筛选不同文件上传至不同的 CDN
- Uploading bundle to AWS s3 storage is now supported - 添加 s3 存储支持
- Languages supports added - 添加对于不同语言的支持

## [0.2] - 2018-07-22

- 添加 FTP 支持

## [0.1.1] - 2018-07-08

- readme 改动

## [0.1.0] - 2018-07-08

- 添加对腾讯 COS 的支持
- 添加对 webpack 3 的兼容
- 添加不同 webpack 版本配置例子文件, 存储与 example 目录下
