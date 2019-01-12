# Changelog 改动记录

## [0.4.1] - 2019-01-12
  
  * Optimzed FTP upload and delete - 优化FTP上传和删除
  * Dependencies updated - 更新依赖包

## [0.4] - 2019-01-09

 * Duplicated file path issue fixed for Mac - 解决Mac下上传文件地址重复的问题
 * Switched from new Buffer to Buffer.from to avoid deprecated warnings - 更改Buffer使用方法避免过期警告
 * Optimzed FTP upload - 优化FTP上传
 * Fixed issue of not being able to delete previous files - 修复无法删除CDN文件的问题

## [0.3] - 2018-11-17

 * Allowing different files to be uploaded to different CDN by using Regex - 支持通过正则筛选不同文件上传至不同的CDN
 * Uploading bundle to AWS s3 storage is now supported - 添加s3存储支持
 * Languages supports added - 添加对于不同语言的支持

## [0.2] - 2018-07-22

 * 添加FTP支持

## [0.1.1] - 2018-07-08
 
 * readme改动 

## [0.1.0] - 2018-07-08

 * 添加对腾讯COS的支持
 * 添加对webpack 3的兼容
 * 添加不同webpack版本配置例子文件, 存储与example目录下