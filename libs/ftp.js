const Ftp = require('ftp');

class AwaitableFtpClient extends Ftp{

    putAwait(input, destPath, zcomp = false){
        return new Promise( (resolve,reject) =>{
            this.put(input, destPath, zcomp = false, err =>{
                if ( err ){
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    }

    listAwait(path, zcomp = false){
        return new Promise( (resolve, reject) =>{
            this.list( path, zcomp, (err, list) =>{
                if ( err ){
                    reject(err);
                    return;
                }
                resolve(list);
            });
        });
    }

    mkdirAwait( path, recursive = false ){
        return new Promise( (resolve,reject) =>{
            this.mkdir( path, recursive , err =>{
                if ( err ){
                    reject( err );
                }

                resolve(true);
            });
        });
    }

    deleteAwait(path){

        return new Promise( (resolve, reject) =>{
            this.delete( path, err =>{

                if ( err ){
                    reject(err);
                    return;
                }

                resolve(true);
            });
        });
    }

    /**
     * @description 覆盖/创建文件, 如果路径不存在创建目标路径
     * @param {string|Buffer} input 
     * 上传内容
     * @param {string} destPath
     * 目标路径
     * 
     * @return {err|void}
     */
    putOrMkdir( input, destPath ){

        return new Promise( async (resolve, reject) =>{
            const isFile = /.*\..*$/.test( destPath );
            const splitted = destPath.split('\/');
            const pathToCheck = isFile ? splitted.slice(0, splitted.length - 1).join('/'):destPath;
            
            try {

                const foundList = await this.listAwait( pathToCheck );

                if ( foundList.length === 0 ){
                    await this.mkdirAwait( pathToCheck, true );
                }
                
                await this.putAwait(input, destPath);
    
                resolve(true);

            }catch( e ){
                reject(e);
            }
        });

    }

}

const ftpClient = new AwaitableFtpClient();

module.exports = params =>{
    
    return new Promise( (resolve, reject) =>{

        ftpClient.on('ready', async () =>{

             //连接成功后检查是否能成功获取给与路径
            try {

                const foundList = await ftpClient.listAwait( params.destPath );
            
                if ( foundList.length === 0){
                    await ftpClient.mkdirAwait( params.destPath , true);
                }

                resolve(ftpClient);

            }catch( err ){

                switch ( err.code ){
                    case 553:
                        reject(`FTP连接成功, 但是找不到路径: ${err.code}`);
                    default:
                        reject(`FTP连接成功, 但是获取列表失败: ${err}`);
                }
            }
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