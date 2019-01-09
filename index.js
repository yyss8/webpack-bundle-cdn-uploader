'use strict';

const _supportedCdns = ['qiniu', 'txcos', 'ftp', 's3'];
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const cl = require('./libs/color-log');

class WebpackBundleUploaderPlugin{

    constructor( options ){
        this.options = options;
        this.loadLanguage();
        this.isMultipleCdn = Array.isArray( this.options.cdn );
        this.cdn = {};
        if ( !RegExp.toJSON ){
            //Regexp本身不带toJson方法, 需要toJson保存用于筛选的Regexp
            RegExp.prototype.toJSON = RegExp.prototype.toString; 
        }
    }

    /**
     * @description
     * 加载语言文件, 如果为路径则可加载自定义文件
     */
    loadLanguage(){

        const { en, cn } = require('./lang');

        if ( !this.options || typeof this.options.lang === 'undefined' ){
            this.lang = cn;
            return;
        }

        switch( this.options.lang ){
            case 'cn':
                this.lang = cn;
                break;
            case 'en':
                this.lang = en;
                break;
            default:
                fs.exists( this.options.lang , existing =>{
                    if ( existing ){
                        const customLang = require( this.options.lang );
                        this.lang = customLang;
                    }else{
                        this.lang = en;  
                        cl.error( this.lang.LANGUAGE_LOAD_FAILED.replace('%s', this.options.lang) );
                    }
                });
        }
    }


    /**
     * @description 初始化各CDN实例
     * 
     * @param {object} cdnObject
     * CDN参数
     * 
     * @return {Promise}
     */
    initUploader( _cdnObject = null ){
        const cdnObject = _cdnObject || this.options.cdn;
        if ( Array.isArray( cdnObject )  ){
            return Promise.all( cdnObject.map( cdn => this.initSingleCdn(cdn) ));
        }else{
            return this.initSingleCdn( cdnObject );
        }
    }

    /**
     * @description
     * 初始化单个CDN实例
     * 
     * @return {Promise}
     */
    initSingleCdn( cdnObject ){
   
        return new Promise( async (resolve, reject) =>{

            switch ( cdnObject.type ){
                case 'qiniu':
                    if ( !cdnObject.secretKey || !cdnObject.accessKey ){
                        reject( this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', '七牛') );
                        return;
                    }
                    const Qiniu = require('./libs/qiniu-node');         
                    this.cdn.qiniu = new Qiniu( cdnObject.accessKey, cdnObject.secretKey, cdnObject.host );
                    break;
                case 'txcos':
                    if ( !cdnObject.secretKey || !cdnObject.accessKey ){
                        reject( this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', '腾讯COS') );
                        return;
                    }

                    const COS = require('cos-nodejs-sdk-v5');
                    this.cdn.txcos = new COS({
                        SecretId:cdnObject.accessKey,
                        SecretKey:cdnObject.secretKey
                    });
                    break;
                case 'aliyun':
                    break;
                case 'ftp':
                    if ( typeof cdnObject.destPath === 'undefined' ){
                        reject( this.lang.INVALID_FTP_DEST_PATH );
                        return;
                    }
                    const ftp = require('./libs/ftp')( cdnObject );
                    this.cdn.ftp = await ftp;
 
                    resolve();
                    break;
                case 's3':
                    if ( !cdnObject.secretKey || !cdnObject.accessKey ){
                        reject( this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', 's3') );
                        return;
                    }
    
                    const knox = require('knox');
                    const { accessKey, secretKey, bucket, ...moreOptions } = cdnObject;
    
                    this.cdn.s3 = knox.createClient({
                        key: accessKey, 
                        secret: secretKey, 
                        bucket: bucket,
                        ...moreOptions
                    });
                    break;
            }
    
            resolve();
        });

    }

    /**
     * @description 
     * 通用上传函数
     * 
     * @param {string} data
     * webpack所返回的文件数据
     * @param {string} name
     * bundle文件名
     * @param {object} cdn
     * cdn参数
     * 
     * @return {Promise}
     */
    upload( data , name, cdn){
  
        return new Promise( (resolve, reject) =>{
            switch ( cdn.type ){
                case 'qiniu':
                    this.cdn.qiniu
                    .uploadByData( cdn.bucket, data, { fileName:name } )
                    .then( response =>{
                        resolve(response);
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    });
                    return;
                case 'txcos':
                    const cosData = Buffer.from( data );
                    this.cdn.txcos.putObject({
                        Bucket:cdn.bucket,
                        Region:cdn.host,
                        Key:name,
                        Body:cosData.toString(),
                        ContentLength:cosData.length
                    }, (err, uploadedData)=>{
                        if ( err ){
                            reject(err);
                            return;
                        }
                        resolve(uploadedData);
                    });
                    return;
                case 'ftp':
                    const { destPath } = cdn;
                    const toMultiplePath = Array.isArray( destPath );

                    //如果需要上传至多个路径
                    if ( toMultiplePath ){

                        let uploadingTasks = [];

                        destPath.forEach( p => {
                            const shouldTest = typeof p !== 'string' && p.test instanceof RegExp;
                            if ( shouldTest && !p.test.test( name ) ){
                                return;
                            }

                            const upPath = shouldTest ? p.path:p;
                            const _path = upPath.endsWith('\/') ? upPath.substr(0, upPath.length - 1):upPath;
                            const _destPath = path.join(_path, name);
                            uploadingTasks.push( this.cdn.ftp.putOrMkdir(data, _destPath) );
                        });

                        Promise
                        .all( uploadingTasks )
                        .then( responses => {
                            resolve( responses );
                        })
                        .catch( rejected => {
                            reject(rejected);
                        });
                    }else{
                        const _path = destPath.endsWith('\/') ? destPath.substr(0, destPath.length - 1):destPath;
                        const _destPath = path.join(_path, name);
    
                        this.cdn.ftp
                        .putOrMkdir(data, _destPath)
                        .then( response =>{
                            resolve( response );
                        })
                        .catch( rejected =>{
                            reject(rejected);
                        });
                    }    
                    return;
                case 's3':
                    const s3Data = Buffer.from( data );
                    const contentType = cdn.contentType || 'text/plain';
                    const permission = cdn.permission || 'public-read';
                    const addHeaders = Object.assign({}, {
                        'Content-Length': s3Data.length,
                        'x-amz-acl':permission,
                        'Content-Type': contentType
                    }, cdn.metas || {});

                    this.cdn.s3.putBuffer(s3Data, `/${name}` , addHeaders, (err, res)=>{
                        if ( err ){
                            reject(err);
                            return;
                        }

                        resolve(res);
                    });
                    return;
            }

            reject(`${this.lang.CDN_TYPE_NOT_SUPPORTED}: ${cdn.type}`);
        });
    }

    /**
     * @description 
     * 删除过往打包文件
     * 
     * wp.previous.json路径
     * 
     * @return {void}
     */
    async deletePreviousUploads( ){

        //读取wp.previous.json文件
        if ( !fs.existsSync( this.logoutputPath ) ){
            throw new Error(this.lang.PREVIOUS_LOG_NOT_EXISTS);
        }

        const previousLog = fs.readFileSync( this.logoutputPath, 'utf8' );

        if ( previousLog && previousLog.Error ){
            throw ( previousLog.Error );   
        }

        let _log;

        try {
            _log = JSON.parse( previousLog );
        }catch ( e ){
            throw new Error(this.lang.INVALID_PREVIOUS_LOG_FILE);
        }

        //从CDN存储中删除旧资源
        let cdnDeleteResponse;
        try {
            cdnDeleteResponse = await this.deletePreviousResources( _log );
        }catch ( e ){
            throw e instanceof Error ? e:new Error( e );
        }

        if ( cdnDeleteResponse && typeof cdnDeleteResponse.error !== 'undefined' ){
            throw new Error( cdnDeleteResponse.error );
        }

        if ( cdnDeleteResponse === false ){
            throw new Error( this.lang.INVALID_PREVIOUS_LOG_FILE );
        }

        cl.success( this.lang.DELETED_NUM_PREVIOUS_FILES.replace('%s', cdnDeleteResponse) );

        fs.unlinkSync( this.logoutputPath );
    }
    
    /**
     * @description 通用删除函数
     * 
     * @param {object} log 
     * 上一次上传记录
     * 
     * @return {Promise} 回调返回删除总数
     */
    deletePreviousResources( log ){

        return new Promise( async (resolve, reject) =>{

            if ( !Array.isArray( log.files ) || log.files.length <= 0 ){
                reject(this.lang.EMPTY_PREVIOUS_LOG_FILE);
            }

            const isPrevMultiple = Array.isArray( log.cdn );

            this
            .initUploader( log.cdn )
            .catch( rejected => {
                //加载过往上传实例出错
                reject( errorColor, rejected.message ? rejected.message:rejected );
            })
            .then( () => {
                if ( isPrevMultiple ){

                    let deletingCdnTypes = {};
                    let deletingPromises = [];
        
                    log.cdn.forEach( cdn =>{
                    
                        if ( !cdn.test ){
                            return;
                        }
    
                        const re = cdn.test.match(/\/(.*)\/$/);
    
                        if ( typeof re[1] === 'undefined' ){
                            return;
                        }
           
                        const tester = new RegExp( re[1] );
    
                        log.files.forEach( file =>{
                            if ( !tester.test( file.fileName ) ){
                                return;
                            }
        
                            if ( typeof deletingCdnTypes[cdn.type] === 'undefined' ){
                                deletingCdnTypes[cdn.type] = {
                                    files:[file.fileName],
                                    cdn
                                };
                            }else{
                                deletingCdnTypes[cdn.type].files.push( file.fileName );
                            }
                        });
                    });
    
                    for ( let cdn in deletingCdnTypes ){
                        if ( !deletingCdnTypes[cdn].files || deletingCdnTypes[cdn].files.length === 0 ){
                            continue;
                        }
    
                        deletingPromises.push(
                            this.getDeletePromiseTask( deletingCdnTypes[cdn].files, deletingCdnTypes[cdn].cdn )
                        );
                    }
    
                    if ( deletingPromises.length > 0 ){
                        resolve( 0 );
                        return;
                    }

                    return Promise.all( deletingPromises );
                }else{
                    return this.getDeletePromiseTask( log.files, log.cdn );
                }
            })
            .catch( rejected =>{
                //删除任务出错
                reject( rejected );
            })
            .then( deleted =>{

                const deletedTotal = isPrevMultiple 
                                   ? deleted.reduce( (total, del) => total + del )
                                   : deleted; 

                resolve( deletedTotal );
            });
        });
    }

    /**
     * @description
     * 获取不同CDN的删除任务
     * 
     * @return {Promise}
     */
    getDeletePromiseTask( files, cdn ){

        return new Promise ( (resolve, reject) => {
            switch ( cdn.type ){
                case 'qiniu':
                    const resources = files.map( file =>{
                        return {
                            bucket:cdn.bucket,
                            fileName:file.fileName
                        };
                    });
                    this.cdn.qiniu
                    .batchAction( resources, 'delete' )
                    .then( deleted =>{
                        resolve(deleted);
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    });
                    break;
                case 'txcos':
                    const params = {
                        Bucket:cdn.bucket,
                        Region:cdn.host,
                        Objects:files.map( file =>{
                            return {
                                Key:file.fileName
                            };
                        })
                    };
                    this.cdn.txcos.deleteMultipleObject( params , (err, data)=>{
                        if ( err ){
                            reject(err);
                            return;
                        }

                        resolve(data.Deleted.length);
                    });
                    break;
                case 'ftp':

                    let ftpDeletingTasks = [];
                    const { destPath } = cdn;
                    const toMultiplePath = Array.isArray( destPath );

                    if ( toMultiplePath ){

                        let exisingPath = {};

                        destPath.forEach( p => {
                            const shouldTest = typeof p !== 'string' && p.test instanceof RegExp;
                            files.forEach( file => {
                                if ( shouldTest && !p.test.test( file.fileName ) ){
                                    return;
                                }

                                const upPath = shouldTest ? p.path:p;
                                const _path = upPath.endsWith('\/') ? upPath.substr(0, upPath.length - 1):upPath;

                                if ( typeof exisingPath[_path] !== 'undefined' ){
                                    return;
                                }

                                exisingPath[_path] = true;

                                ftpDeletingTasks.push(
                                    this.cdn.ftp.rmdirAwait( _path, true)
                                );
                            });
                        });

                    }else{
                        const _path = destPath.endsWith('\/') ? destPath.substr(0, destPath.length - 1):destPath;
                        ftpDeletingTasks.push(
                            this.cdn.ftp.rmdirAwait( _path, true)
                        );
                    }
                    

                    if ( !!ftpDeletingTasks[0] ){
                        Promise
                        .all( ftpDeletingTasks )
                        .then( responses => {
                            resolve(files.length);
                        })
                        .catch( rejected => {
                            reject(rejected);
                        });   
                    }else{
                        resolve();
                    }

                    break;
                case 's3':
                    const s3Deleting = files.map( file => `/${file.fileName}`);
    
                    this.cdn.s3.deleteMultiple( s3Deleting, (err, res) =>{
                        if ( err ){
                            reject(err);
                            return;
                        }
                        resolve( files.length );
                    });
                    break;
            }
        });

    }

    /**
     * @description 
     * 处理部分CDN上传实例后续, 暂用于FTP
     * 
     * @param {Function | null} 结束插件回调函数
     * 
     * @return {void}
     */
    endUploader( callback = null ){

        cl.reset();

        if ( typeof this.cdn === 'undefined' ){
            if ( callback !== null ) callback();
            return;
        }

        for (let cdn in this.cdn){
            switch ( cdn ){
                case 'ftp':
                    if ( typeof this.cdn[cdn] !== 'undefined' ) this.cdn[cdn].destroy();
            }
        }

        if ( callback !== null ) callback();
    }

    /**
     * @description
     * 验证单个CDN参数
     * 
     * @return {void}
     */
    validateOption( cdn, index = -1 ){
        if ( typeof cdn === 'undefined' ){
            throw new Error( this.lang.EMPTY_CDN_CONFIG );
        }

        if ( typeof cdn.type === 'undefined' || typeof _supportedCdns.indexOf( cdn.type ) === -1 ){
            throw new Error( `${this.lang.CDN_TYPE_NOT_SUPPORTED}: ${cdn.type}${index !== -1 ? ` CDN index:${index}`:''}` );
        }
    }

    /**
     * @description
     * 验证传入CDN参数
     * 
     * @return {Promise}
     */
    validateOptions(){

        return new Promise( (resolve, reject) =>{

            let shouldTerm = false;

            if ( Array.isArray( this.options.cdn ) ){

                let existingReg = {};

                if ( this.options.cdn.length === 0 ){
                    reject( this.lang.EMPTY_CDN_CONFIG );
                    return;
                }

                let validating = [];

                this.options.cdn.forEach( (cdn, index) =>{
     
                    validating.push(new Promise( (__res, __reject) =>{

                        try {
                            this.validateOption( cdn );
                        }catch( e ){
                            __reject(e.message);
                            return;
                        }

                        if ( typeof cdn.test === 'undefined' || !cdn.test instanceof RegExp ){
                            __reject( `${this.lang.INVALID_REGEX} ${index !== -1 ? `, Index: ${index}`:''}`  );
                            return;
                        }
    
                        const tester = String( cdn.test );
            
                        if ( typeof existingReg[tester] === 'undefined' ){
                            existingReg[tester] = true;
                            __res();
                        }else{
                            readline.createInterface({
                                input: process.stdin,
                                output: process.stdout
                            }).question(this.lang.DUPLICATE_REGEX_FOUND_QUESTION, answer =>{
                                if (answer.match(/^y(es)?$/i)){
                                    __res();
                                }else{
                                    shouldTerm = true;
                                    __reject(this.lang.DUPLICATE_REGEX_FOUND);
                                }
                            });
                        }
                    }));
                    
                });

                if ( validating.length > 0 ){
                    Promise
                    .all( validating )
                    .then( () =>{
                        
                        if ( shouldTerm ){
                            reject(this.lang.DUPLICATE_REGEX_FOUND);
                        }else{
                            resolve();
                        }
                    })
                    .catch( rejected =>{

                        if ( !rejected ){
                            return;
                        }

                        reject( rejected );
                    });
                }else{
                    reject(this.lang.EMPTY_CDN_CONFIG);
                }

            }else{
                try {
                    this.validateOption( this.options.cdn );
                    resolve();
                }catch( e ){
                    reject(e.message);
                    return;
                }
            }
            
        });

    }

    /**
     * @description
     * 处理文件上传
     * 
     * @param {object} cdn
     * CDN参数 
     * @param {object} asset 
     * webpack导出数据内容
     * 
     * @return {Promise}
     */
    handleFileUpload( cdn, asset ){

        return new Promise( async (resolve, reject) =>{

            const { existsAt, _value, _name } = asset;

            let response, fileName;
            try {                
                if ( typeof _name === 'undefined' ){
                    //对于非js文件
                    fileName = existsAt.replace( this.outputPath, '' );
                    fileName = fileName.substr(1, fileName.length); //去除第一个斜杠
                    const fileContent = fs.readFileSync( existsAt, 'utf8'); 
                    response = await this.upload( fileContent, fileName, cdn);
                }else{
                    fileName = _name;
                    response = await this.upload( _value, _name, cdn );
                }
            }catch( e ){
                reject( this.lang.LOADING_FILE_ERROR.replace('%s', fileName).replace('%2s', e.message ? e.message:e) );
                return;
            }

            if ( this.options.deleteOutput ){
                fs.unlinkSync( existsAt ); 
            }
    
            if ( typeof response.error !== 'undefined' ){
                reject( this.lang.UPLOADING_ERROR.replace('%s', fileName).replace('%2s', response.error ? response.error:response.toString()) );
            }

            cl.success( `${this.lang.SINGLE_FILE_UPLOADED}: ${fileName}` );

            resolve( {fileName} );
        });
    }

    /**
     * @description
     * 挂钩至webpack afterEmit hook
     * 
     * @param {object} compilation 
     * @param {function|null} callback 
     * 
     * @return {void}
     */
    async handleEmitted(compilation , callback = null){

        cl.reset();

        let uploaderError = false;
        let previousOutput;
        
        this
        .validateOptions()
        .catch( rejected =>{
            //验证参数出错
            cl.error( rejected instanceof Error ? rejected.message:rejected );
            this.endUploader( callback );
        })
        .then( async () =>{

            const outputOptions = compilation.outputOptions || compilation.options;
            this.outputPath = path.normalize( outputOptions.path || outputOptions.path.output );
            this.logoutputPath =  path.resolve(this.outputPath, './wp.previous.json');

            //开始删除过往上传记录
            if ( this.options.deletePrevious ){
                cl.reset( this.lang.DELETE_PREVIOUS_ENABLED );

                try {
                    await this.deletePreviousUploads();
                }catch( e ){
                    cl.reset( this.lang.SKIP_DELETE_PREVIOUS_DUE_TO.replace('%s', e.message ? e.message:e) );
                }
            }
            return this.initUploader();
        })
        .catch( rejected =>{
            //加载上传CDN实例出错
            cl.error( this.lang.INVALID_CDN_OPTIONS_LOADED.replace('%s', rejected)  );
            this.endUploader( callback );
            return;
        })
        .then( async () =>{
            /*---------------- 加载上传文件 ----------------*/
            cl.reset( this.lang.UPLOAD_START );
       
            previousOutput = {
                cdn:this.options.cdn,
                files:[]
            };

            let uploadingAssets = [];
            const _test = this.options.cdn.test || /\.(js|css)$/; //用于单CDN上传时验证

            for ( let asset in compilation.assets ){

                let fileName;

                const { existsAt } = compilation.assets[asset];
            
                try {
                    //非js文件不会直接包括文件内容, 需要使用fs提取内容并手动提取文件名
                    if ( this.isMultipleCdn ){
                        for ( let cdn of this.options.cdn ){
                            
                            if ( !cdn.test.test( existsAt ) ){
                                continue;
                            }

                            uploadingAssets.push(
                                this.handleFileUpload(cdn, compilation.assets[asset] )
                            );
                        }
                    }else{

                        if ( !_test.test( existsAt ) ){
                            continue;
                        }

                        uploadingAssets.push(
                            this.handleFileUpload(this.options.cdn, compilation.assets[asset] )
                        );
                    }
                }catch( e ){
                    uploaderError = true;
                    cl.error( this.lang.LOADING_FILE_ERROR.replace('%s', fileName).replace('%2s', e instanceof Error ? e.message:e) );
                    this.endUploader( callback );
                    break;
                }

                //一个文件出错则停止所有上传
            }
            
            if ( uploadingAssets.length === 0 ){
                this.endUploader( callback );
                return;
            }

            return Promise.all( uploadingAssets );
        })
        .catch( rejecteds =>{
            //上传任务出错
            cl.error( Array.isArray( rejecteds ) ? rejecteds.map( (rejected, index) => `${index + 1}. ${rejected instanceof Error ? rejected.message:rejected}` ).join("\n"):( rejecteds instanceof Error ? rejecteds.message:rejecteds ) );
            this.endUploader( callback );
        })
        .then( uploads =>{

            previousOutput.files = uploads;

            //保存上传记录, 用于下一次删除
            if ( Array.isArray( previousOutput.files ) && previousOutput.files.length > 0 ){
                try {
                    fs.writeFileSync( this.logoutputPath, JSON.stringify( previousOutput ));
                }catch( e ){
                    cl.error( this.lang.SAVING_LOG_ERROR.replace('%s',  e instanceof Error ? e.message:e ) );
                }
            }

            if ( !uploaderError ){
                cl.success( this.lang.ALL_FILE_UPLOADED );

                if ( this.options.deleteOutput ){
                    cl.reset( this.lang.DELETE_OUTPUT_ENABLED  );
                }
            }
            /*---------------- 上传结束 ----------------*/
            this.endUploader( callback ); //部分CDN诸如FTP需要手动结束进程
        });
    }

    apply(compiler){
        
        //webpack版本兼容
        if ( compiler.hooks ){ 
            //webpack 4
            compiler.hooks.afterEmit.tapAsync(
                'BundleUploaderPlugin',
                this.handleEmitted.bind(this)
            )
        }else{ //webpack 3
            compiler.plugin('after-emit', this.handleEmitted.bind(this));
        }

    }

}

module.exports = WebpackBundleUploaderPlugin;