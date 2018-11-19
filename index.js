'use strict';

const _supportedCdns = ['qiniu', 'txcos', 'ftp', 's3'];
const fs = require('fs');
const readline = require('readline');

const resetColor = "\x1b[0m";
const successColor = "\x1b[32m";
const errorColor = "\x1b[31m";

class WebpackBundleUploaderPlugin{

    constructor( options ){
        this.options = options;
        this.loadLanguage();

        if ( !RegExp.toJSON ){
            //Regexp本身不带toJson方法
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
                        console.log(errorColor, this.lang.LANGUAGE_LOAD_FAILED.replace('%s', this.options.lang) );
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

        this.cdn = {};
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
   
        return new Promise( (resolve, reject) =>{

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

                    require('./libs/ftp')( cdnObject )
                    .then( ftpClient =>{
                        this.cdn.ftp = ftpClient;
                        resolve();
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    });
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
                    const cosData = new Buffer( data );
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
                    const _path = destPath.endsWith('\/') ? destPath.substr(0, destPath.length - 1):destPath;
                    const path = `${_path}/${name}`;
                    this.cdn.ftp
                    .putOrMkdir(data, path)
                    .then( response =>{
                        resolve( response );
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    });
                    return;
                case 's3':
                    const s3Data = new Buffer( data );
                    this.cdn.s3.putBuffer(s3Data, `/${name}` ,{
                        'Content-Length': s3Data.length,
                        'x-amz-acl':'public-read',
                        'Content-Type': 'text/plain'
                    }, (err, res)=>{
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
     * @param {string} previousPath
     * wp.previous.json路径
     * 
     * @return {void}
     */
    async deletePreviousUploads( previousPath ){

        //读取wp.previous.json文件
        if ( !fs.existsSync(previousPath) ){
            throw new Error(this.lang.PREVIOUS_LOG_NOT_EXISTS);
        }

        const previousLog = fs.readFileSync( previousPath, 'utf8' );

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
            throw e.message ? e.message:e;
        }

        if ( cdnDeleteResponse && typeof cdnDeleteResponse.error !== 'undefined' ){
            throw new Error( cdnDeleteResponse.error );
        }

        if ( cdnDeleteResponse === false ){
            throw new Error( this.lang.INVALID_PREVIOUS_LOG_FILE );
        }

        console.log( successColor , this.lang.DELETED_NUM_PREVIOUS_FILES.replace('%s', cdnDeleteResponse) );

        fs.unlinkSync( previousPath );
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

            try {
                await this.initUploader( log.cdn );
            }catch( e ){
                reject( errorColor, e.message ? e.message:e );
            }

            if ( !Array.isArray( log.files ) || log.files.length <= 0 ){
                reject(this.lang.EMPTY_PREVIOUS_LOG_FILE);
            }

            const isPrevMultiple = Array.isArray( log.cdn );
 
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
                    Promise.all( deletingPromises )
                    .then( deleted =>{
                        const totalDeleted = deleted.reduce( (total, del) => total + del );
                        resolve( totalDeleted );
                    })
                    .catch( rejecteds =>{
                        reject( rejecteds );
                    });
                }

            }else{
                this.getDeletePromiseTask( log.files, log.cdn )
                .then( deleted =>{
                    resolve( deleted );
                })
                .catch( rejected =>{
                    reject( rejected );
                });
            }
            // reject(this.lang.CDN_TYPE_NOT_SUPPORTED);
        });
    }

    /**
     * @description
     * 获取不同CDN的删除任务
     * 
     * @return {Promise}
     */
    getDeletePromiseTask( files, cdn ){
        switch ( cdn.type ){
            case 'qiniu':
                return new Promise( (resolve, reject) =>{
                    const resources = files.map( file =>{
                        return {
                            bucket:cdn.bucket,
                            fileName:file
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
                });
            case 'txcos':
                return new Promise( (resolve, reject) =>{
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
                });
            case 'ftp':
                return new Promise( (resolve, reject) =>{
                    Promise.all(files.map( file => {
                        const _path = cdn.destPath.endsWith('\/') ? cdn.destPath.substr(0, cdn.destPath.length - 1):cdn.destPath;
                        const path = `${_path}/${file.fileName}`;
                        return this.cdn.ftp.deleteAwait(path);
                    }))
                    .then( () =>{
                        resolve( files.length );
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    });
                });
            case 's3':
                return new Promise( (resolve, reject) =>{
                    const s3Deleting = files.map( file => `/${file}`);
                    this.cdn.s3.deleteMultiple( s3Deleting, (err, res) =>{
                        if ( err ){
                            reject(err);
                            return;
                        }
                        resolve( files.length );
                    });
                });
        }

    }

    /**
     * @description 
     * 处理部分CDN上传实例后续, 暂用于FTP
     * 
     * @return {Promise}
     */
    async endUploader(){

        return new Promise( (resolve, reject) =>{

            if ( !this.cdn ){
                reject('');
            }

            switch ( this.options.cdn.type ){
                case 'ftp':
                    this.cdn
                    .destroy()
                    .then( () =>{
                        resolve();
                    })
                    .catch( rejected =>{
                        reject(rejected);
                    })
                    return;
            }

            resolve();
        });
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
                    fileName = existsAt.replace(`${this.outputPath}\\`, '').replace(/\\/g, '/');
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
                fs.unlinkSync( `${this.outputPath}\\${fileName}` );   
            }
    
            if ( typeof response.error !== 'undefined' ){
                reject( this.lang.UPLOADING_ERROR.replace('%s', fileName).replace('%2s', response.error ? response.error:response.toString()) );
            }

            console.log( successColor, `${this.lang.SINGLE_FILE_UPLOADED}: ${fileName}` );

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

        console.log(resetColor);
        this
        .validateOptions()
        .then( async () =>{

            const outputOptions = compilation.outputOptions || compilation.options.output;
            this.outputPath = outputOptions.path;
            const previousPath = `${this.outputPath}\\wp.previous.json`;
            const isMultipleCdn = Array.isArray( this.options.cdn );

            //开始删除过往上传记录
            if ( this.options.deletePrevious ){
                console.log( this.lang.DELETE_PREVIOUS_ENABLED );
            
                try {
                    await this.deletePreviousUploads( previousPath );
                }catch( e ){
                    console.log( resetColor , this.lang.SKIP_DELETE_PREVIOUS_DUE_TO.replace('%s', e.message ? e.message:e) );
                }

            }

            this
            .initUploader()
            .then( async () =>{
                /*---------------- 开始上传 ----------------*/
                let previousOutput = {
                    cdn:this.options.cdn,
                    files:[]
                }
                let uploaderError = false;

                console.log( resetColor , this.lang.UPLOAD_START );

                let uploadingAssets = [];
                const _test = this.options.cdn.test || /\.(js|css)$/; //用于单CDN上传时验证

                for ( let asset in compilation.assets ){

                    let fileName;

                    const { existsAt } = compilation.assets[asset];
                
                    try {
                        //非js文件不会直接包括文件内容, 需要使用fs提取内容并手动提取文件名
                        if ( isMultipleCdn ){
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
                        console.log( errorColor , this.lang.LOADING_FILE_ERROR.replace('%s', fileName).replace('%2s', e.message ? e.message:e) );
                        break;
                    }

                    //一个文件出错则停止所有上传
                }
                
                if ( uploadingAssets.length === 0 ){
                    await this.endUploader();
                    if ( callback !== null ) callback();
                    return;
                }

                Promise
                .all( uploadingAssets )
                .then( async uploads =>{

                    previousOutput.files = uploads;

                    //处理不同CDN类型后续操作, 暂时只用于FTP
                    await this.endUploader();

                    //保存上传记录, 用于下一次删除
                    if ( previousOutput.files.length > 0 ){
                        try {
                            fs.writeFileSync( previousPath, JSON.stringify( previousOutput ));
                        }catch( e ){
                            console.log(errorColor, this.lang.SAVING_LOG_ERROR.replace('%s', e.message ? e.message:e) );
                        }
                    }

                    if ( !uploaderError ){
                        console.log(successColor, this.lang.ALL_FILE_UPLOADED );

                        if ( this.options.deleteOutput ){
                            console.log( resetColor, this.lang.DELETE_OUTPUT_ENABLED );
                        }
                    }

                    console.log(resetColor);

                    if ( callback !== null ) callback();
                })
                .catch( async rejecteds =>{
                    //上传出错
                    console.log( errorColor, rejecteds );
                    await this.endUploader();
                    if ( callback !== null ) callback();
                });
                /*---------------- 上传结束 ----------------*/
            })
            .catch( async rejected =>{
                //加载上传实例出错
                console.log( this.lang.INVALID_CDN_OPTIONS_LOADED.replace('%s', rejected) );
                await this.endUploader();
                if ( callback !== null ) callback();
            });
            
        })
        .catch( rejected =>{
            //验证参数出错
            console.log(rejected);
            if ( callback !== null ) callback();
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