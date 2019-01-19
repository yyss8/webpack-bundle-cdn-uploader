const Ftp = require('ftp');
const isWin32 = process.platform === 'win32';
const path = require('path');

class AwaitableFtpClient extends Ftp{

    //覆盖或创建文件, 如果目标路径为文件夹则会报错
    putAwait(input, destPath, zcomp = false){
        return new Promise( (resolve,reject) =>{
            this.put(input, this.convertSlash( destPath ) , zcomp, err =>{
                if ( err ){
                    reject(err);
                    return;
                }
                resolve(1);
            });
        });
    }

    //获取列表
    listAwait(destPath, zcomp = false){
        return new Promise( (resolve, reject) =>{
            this.list( this.convertSlash( destPath ) , zcomp, (err, list) =>{
                if ( err ){
                    reject(err);
                    return;
                }
                resolve(list);
            });
        });
    }

    //创建目录
    mkdirAwait( destPath, recursive = false ){
        return new Promise( (resolve,reject) =>{
            this.mkdir( this.convertSlash( destPath ) , recursive , err =>{
                if ( err ){
                    reject( err );
                }

                resolve(true);
            });
        });
    }

    //删除文件
    deleteAwait(destPath, ignoreError = false){

        return new Promise( (resolve, reject) =>{
            this.delete( this.convertSlash( destPath ) , function(err){

                if ( ignoreError ){
                    resolve(0);
                    return;
                }

                if ( err ){
                    reject(err);
                    return;
                }

                resolve(1);
            });
        });
    }

    /**
     * @description 
     * 覆盖/创建文件, 如果路径不存在创建目标路径
     * 如果创建目标路径为文件夹则会报错
     * @param {string|Buffer} input 
     * 上传内容
     * @param {string} destPath
     * 目标路径
     * 
     * @return {Promise}
     */
    putOrMkdir( input, destPath ){

        return new Promise( async (resolve, reject) =>{
 
            const pathToCheck = path.dirname(destPath);

            try {
                const foundList = await this.listAwait( pathToCheck );

                if ( foundList.length === 0 ){
                    await this.mkdirAwait( pathToCheck, true );
                }
                
                await this.putAwait(input, destPath);
    
                resolve(1);

            }catch( e ){
                reject(e);
            }
        });

    }

    putOrMkdirMultiple( inputs ){
        return new Promise( (resolve, reject) => {
            let existingPath = {};
            let checkingPaths = [], creatingPromises = [], uploadPromises = [];

            if ( !Array.isArray( inputs ) || typeof inputs[0] === 'undefined' ){
                resolve( 0 );
            }
        
            inputs.forEach( input => {
                const { data, destPath } = input;
                const isDir = /^(.+)\/([^/]+)$/.test( destPath );

                if ( !isDir ){
                    return;
                }

                const pathToCheck = path.dirname( destPath );
    
                if ( typeof existingPath[pathToCheck] === 'undefined' ){
                    existingPath[pathToCheck] = true;
                    checkingPaths.push(pathToCheck);
                }
     
                uploadPromises.push(
                    this.putAwait( data, destPath )
                );
            });

            Promise
            .all(checkingPaths.map( p => this.listAwait( p ) ) )
            .then( async lists => {

                lists.forEach( (list, index) => {
                    if ( list.length === 0 ){
                        creatingPromises.push(
                            this.mkdirAwait( checkingPaths[index], true )
                        );
                    }
                });

                if ( !!creatingPromises[0] ){
                    await Promise.all( creatingPromises );
                }

                return Promise.all( uploadPromises );
            }, rejected =>{
                reject(rejected);
            })
            .then( () => {
                resolve(inputs.length);
            }, rejected =>{
                reject(rejected);
            })
            .catch( rejected =>{
                reject( rejected );
            });
        });
    }

    /**
     * 
     * @param {String} path 
     * @param {Boolean} recursive 
     * 
     * @return {Promise}
     */
    rmdirAwait( destPath, recursive = false ){
        return new Promise( (resolve, reject) => {

            const convertedPath = this.convertSlash( destPath );
            this.list( convertedPath , (err, list) => {
                if ( err ){
                    reject(err);
                    return;
                }

                const listLength= list.length;
                if ( listLength === 0 ){
                    resolve(0);
                    return;
                }

                this.rmdir( convertedPath , recursive, _err =>{
                    if ( _err ){
                        reject(_err);
                        return;
                    }

                    resolve( listLength );
                }); 
            });
        });
    }

    //根据不同平台转换斜杠
    convertSlash( _path ){
        return isWin32 ? _path.replace(/\\/g, "\/"):_path;
    }

}

module.exports = params =>{
    
    return new Promise( (resolve, reject) =>{

        const ftpClient = new AwaitableFtpClient();

        ftpClient.on('ready', err =>{

            if ( err ){
                resolve(err.code);
                return;
            }

            ftpClient.list('/', err => {

                if ( err ){
                    reject(err);
                    return;
                }

                resolve(ftpClient);
            });

            resolve(ftpClient);
        });

        ftpClient.on('error', err =>{
            switch ( err.code ){
                case 'ECONNREFUSED':
                    reject(`FTP连接错误: ${err.code}}`);
                    break;
                case 530:
                    reject('FTP连接错误: 账号或密码出错');
                    break;
                default:
                    reject(`FTP连接错误: ${err.code}`);
            }
        });

        ftpClient.connect(params);
    });
};