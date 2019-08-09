// @ts-check
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const cl = require('./libs/color-log');

const SUPPORTED_CDNS = ['qiniu', 'txcos', 'ftp', 's3'];
const IS_WIN_32 = process.platform === 'win32';

class WebpackBundleUploaderPlugin {
  constructor(options) {
    this.options = options;
    this.loadLanguage();
    this.isMultipleCdn = Array.isArray(this.options.cdn);
    this.cdn = {};
    this.isEnded = false;

    if (typeof RegExp.toJSON === 'undefined') {
      //Regexp本身不带toJson方法, 需要toJson保存用于筛选的Regexp
      RegExp.prototype.toJSON = RegExp.prototype.toString;
    }
  }

  /**
   * @description
   * 加载语言文件, 如果为路径则可加载自定义文件.
   */
  loadLanguage() {
    const { en, cn } = require('./lang');

    if (!this.options || typeof this.options.lang === 'undefined') {
      this.lang = cn;
      return;
    }

    switch (this.options.lang) {
      case 'cn':
        this.lang = cn;
        break;
      case 'en':
        this.lang = en;
        break;
      default:
        fs.exists(this.options.lang, existing => {
          if (existing) {
            const customLang = require(this.options.lang);
            this.lang = customLang;
          } else {
            this.lang = en;
            cl.error(this.lang.LANGUAGE_LOAD_FAILED.replace('%s', this.options.lang));
          }
        });
    }
  }

  /**
   * @description 初始化各CDN实例
   *
   * @param {object} _cdnObject
   * CDN参数
   *
   * @return {Promise}
   */
  initUploader(_cdnObject = null) {
    const cdnObject = _cdnObject || this.options.cdn;
    if (Array.isArray(cdnObject)) {
      return Promise.all(cdnObject.map(cdn => this.initSingleCdn(cdn)));
    } else {
      return this.initSingleCdn(cdnObject);
    }
  }

  /**
   * @description
   * 初始化单个CDN实例
   *
   * @param {object} cdnObject
   * CDN参数
   *
   * @return {Promise}
   */
  initSingleCdn(cdnObject) {
    return new Promise(async (resolve, reject) => {
      switch (cdnObject.type) {
        case 'qiniu':
          if (!cdnObject.secretKey || !cdnObject.accessKey) {
            reject(this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', '七牛'));
            return;
          }
          const Qiniu = require('./libs/qiniu-node');
          this.cdn.qiniu = new Qiniu(cdnObject.accessKey, cdnObject.secretKey, cdnObject.host);
          break;
        case 'txcos':
          if (!cdnObject.secretKey || !cdnObject.accessKey) {
            reject(this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', '腾讯COS'));
            return;
          }

          const COS = require('cos-nodejs-sdk-v5');
          this.cdn.txcos = new COS({
            SecretId: cdnObject.accessKey,
            SecretKey: cdnObject.secretKey
          });
          break;
        case 'aliyun':
          break;
        case 'ftp':
          if (typeof this.cdn.ftp !== 'undefined' && this.cdn.ftp !== null) {
            resolve();
          }

          if (typeof cdnObject.destPath === 'undefined') {
            reject(this.lang.INVALID_FTP_DEST_PATH);
            return;
          }

          const ftp = require('./libs/ftp')(cdnObject);
          try {
            this.cdn.ftp = await ftp;
          } catch (e) {
            reject(e.message ? e.message : e);
          }

          resolve();
          break;
        case 's3':
          if (!cdnObject.secretKey || !cdnObject.accessKey) {
            reject(this.lang.EMPTY_ACCESS_OR_SECRET.replace('%s', 's3'));
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
  upload(data, name, cdn) {
    return new Promise((resolve, reject) => {
      switch (cdn.type) {
        case 'qiniu':
          this.count.uploading++;
          this.cdn.qiniu
            .uploadByData(cdn.bucket, data, { fileName: name })
            .then(response => {
              this.count.uploaded++;
              resolve(response);
            })
            .catch(rejected => {
              this.count.errored++;
              reject(rejected);
            });
          return;
        case 'txcos':
          this.count.uploading++;
          const cosData = Buffer.from(data);
          this.cdn.txcos.putObject(
            {
              Bucket: cdn.bucket,
              Region: cdn.host,
              Key: name,
              Body: cosData.toString(),
              ContentLength: cosData.length
            },
            (err, uploadedData) => {
              if (err) {
                this.count.errored++;
                reject(err);
                return;
              }
              this.count.uploaded++;
              resolve(uploadedData);
            }
          );
          return;
        case 'ftp':
          const { destPath } = cdn;
          const toMultiplePath = Array.isArray(destPath);

          //如果需要上传至多个路径
          if (toMultiplePath) {
            let uploadingTasks = [];

            destPath.forEach(p => {
              const shouldTest = typeof p !== 'string' && p.test instanceof RegExp;
              if (shouldTest && !p.test.test(name)) {
                return;
              }
              const upPath = shouldTest ? p.path : p;
              const _path = upPath.endsWith('/') ? upPath.substr(0, upPath.length - 1) : upPath;
              const _destPath = path.join(_path, name);
              this.count.uploading++;
              uploadingTasks.push({
                data,
                destPath: _destPath
              });
            });

            this.cdn.ftp
              .putOrMkdirMultiple(uploadingTasks)
              .then(uploaded => {
                this.count.uploaded += Array.isArray(uploaded) ? uploaded.length : 1;
                resolve(uploaded);
              })
              .catch(rejected => {
                if (!rejected) {
                  return;
                }
                this.count.errored += Array.isArray(rejected) ? rejected.length : 1;
                reject(rejected);
              });
          } else {
            const _path = destPath.endsWith('/')
              ? destPath.substr(0, destPath.length - 1)
              : destPath;
            const _destPath = path.join(_path, name);
            this.count.uploading++;

            this.cdn.ftp
              .putOrMkdir(data, _destPath)
              .then(() => {
                this.count.uploaded++;
                resolve(1);
              })
              .catch(rejected => {
                this.count.errored++;
                reject(rejected);
              });
          }
          return;
        case 's3':
          const s3Data = Buffer.from(data);
          const contentType = cdn.contentType || 'text/plain';
          const permission = cdn.permission || 'public-read';
          const addHeaders = Object.assign(
            {},
            {
              'Content-Length': s3Data.length,
              'x-amz-acl': permission,
              'Content-Type': contentType
            },
            cdn.metas || {}
          );
          this.count.uploading++;
          this.cdn.s3.putBuffer(s3Data, `/${name}`, addHeaders, (err, res) => {
            if (err) {
              this.count.errored++;
              reject(err);
              return;
            }
            this.count.uploaded++;
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
   * @return {Promise}
   */
  async deletePreviousUploads() {
    //读取wp.previous.json文件
    let previousLog;

    try {
      previousLog = fs.readFileSync(this.logPath, 'utf8');
    } catch (e) {
      throw new Error(this.lang.PREVIOUS_LOG_NOT_EXISTS);
    }

    let previousLogData;

    try {
      previousLogData = JSON.parse(previousLog);
    } catch (e) {
      throw new Error(this.lang.INVALID_PREVIOUS_LOG_FILE);
    }

    //从CDN存储中删除旧资源
    let cdnDeleteResponse;
    try {
      cdnDeleteResponse = await this.deletePreviousResources(previousLogData);
    } catch (e) {
      throw e instanceof Error ? e : new Error(e);
    }

    if (cdnDeleteResponse && typeof cdnDeleteResponse.error !== 'undefined') {
      throw new Error(cdnDeleteResponse.error);
    }

    if (cdnDeleteResponse === false) {
      throw new Error(this.lang.INVALID_PREVIOUS_LOG_FILE);
    }

    cl.success(this.lang.DELETED_NUM_PREVIOUS_FILES.replace('%s', cdnDeleteResponse));

    fs.unlinkSync(this.logPath);

    // 完成任务后尝试关闭ftp连接.
    this.endFtp();
  }

  /**
   * @description 通用删除函数
   *
   * @param {object} log
   * 上一次上传记录
   *
   * @return {Promise} 回调返回删除总数
   */
  deletePreviousResources(log) {
    return new Promise(async (resolve, reject) => {
      if (!Array.isArray(log.files) || log.files.length <= 0) {
        reject(this.lang.EMPTY_PREVIOUS_LOG_FILE);
      }

      const isPrevMultiple = Array.isArray(log.cdn);

      this.initUploader(log.cdn)
        .then(
          () => {
            if (isPrevMultiple) {
              let deletingCdnTypes = {};
              let deletingPromises = [];

              log.cdn.forEach(cdn => {
                if (!cdn.test) {
                  return;
                }

                const re = cdn.test.match(/\/(.*)\/$/);

                if (typeof re[1] === 'undefined') {
                  return;
                }

                const tester = new RegExp(re[1]);

                log.files.forEach(file => {
                  if (!tester.test(file.fileName)) {
                    return;
                  }

                  if (typeof deletingCdnTypes[cdn.type] === 'undefined') {
                    deletingCdnTypes[cdn.type] = {
                      files: [file],
                      cdn
                    };
                  } else {
                    deletingCdnTypes[cdn.type].files.push(file);
                  }
                });
              });

              for (let cdn in deletingCdnTypes) {
                if (!deletingCdnTypes[cdn].files || deletingCdnTypes[cdn].files.length === 0) {
                  continue;
                }

                deletingPromises.push(
                  this.getCdnDeleteTask(deletingCdnTypes[cdn].files, deletingCdnTypes[cdn].cdn)
                );
              }
              if (deletingPromises.length === 0) {
                resolve(0);
                return;
              }

              return Promise.all(deletingPromises);
            } else {
              return this.getCdnDeleteTask(log.files, log.cdn);
            }
          },
          rejected => {
            //加载过往上传实例出错
            cl.error(rejected);
          }
        )
        .then(
          deleted => {
            const deletedTotal =
              isPrevMultiple && Array.isArray(deleted)
                ? deleted.reduce((total, del) => total + del)
                : deleted;

            resolve(deletedTotal);
          },
          rejected => {
            //删除任务出错
            reject(rejected);
          }
        );
    });
  }

  /**
   * @description
   * 获取不同CDN的删除任务
   *
   * @return {Promise}
   */
  getCdnDeleteTask(files, cdn) {
    return new Promise((resolve, reject) => {
      switch (cdn.type) {
        case 'qiniu':
          const resources = files.map(file => {
            return {
              bucket: cdn.bucket,
              fileName: file.fileName
            };
          });
          this.cdn.qiniu
            .batchAction(resources, 'delete')
            .then(deleted => {
              resolve(deleted);
            })
            .catch(rejected => {
              reject(rejected);
            });
          break;
        case 'txcos':
          const params = {
            Bucket: cdn.bucket,
            Region: cdn.host,
            Objects: files.map(file => {
              return {
                Key: file.fileName
              };
            })
          };
          this.cdn.txcos.deleteMultipleObject(params, (err, data) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(data.Deleted.length);
          });
          break;
        case 'ftp':
          let ftpDeletingTasks = [];
          const { destPath } = cdn;
          const toMultiplePath = Array.isArray(destPath);
          let exisingPath = {};

          if (toMultiplePath) {
            destPath.forEach(p => {
              const shouldTest = typeof p !== 'string' && p.test instanceof RegExp;
              files.forEach(file => {
                if (shouldTest && !p.test.test(file.fileName)) {
                  return;
                }

                const _destPath = shouldTest ? p.path : p;
                const fileName = typeof file === 'string' ? file : file.fileName;
                const filePathCmp = fileName.split('/');

                if (!filePathCmp || filePathCmp.length === 1) {
                  ftpDeletingTasks.push(
                    this.cdn.ftp.deleteAwait(path.join(_destPath, fileName), true)
                  );
                  return;
                }

                const deletingPath = path.join(_destPath, filePathCmp[0]);
                //确保不重复删除路径
                if (typeof exisingPath[deletingPath] !== 'undefined') {
                  return;
                }

                exisingPath[deletingPath] = true;

                ftpDeletingTasks.push(this.cdn.ftp.rmdirAwait(deletingPath, true));
              });
            });
          } else {
            files.forEach(file => {
              const fileName = typeof file === 'string' ? file : file.fileName;
              const filePathCmp = fileName.split('/');

              //如果存储与destPath则直接跳过

              if (!filePathCmp || filePathCmp.length === 1) {
                ftpDeletingTasks.push(
                  this.cdn.ftp.deleteAwait(path.join(destPath, fileName), true)
                );
                return;
              }

              const deletingPath = path.join(destPath, filePathCmp[0]);

              //确保不重复删除路径
              if (typeof exisingPath[deletingPath] !== 'undefined') {
                return;
              }
              exisingPath[deletingPath] = true;
              ftpDeletingTasks.push(this.cdn.ftp.rmdirAwait(deletingPath, true));
            });
          }

          if (!!ftpDeletingTasks[0] && !this.isEnded) {
            Promise.all(ftpDeletingTasks)
              .then(deleteMissions => {
                const deleted = deleteMissions.reduce((total, del) => total + del);
                resolve(deleted);
              })
              .catch(rejected => {
                if (!rejected) {
                  return;
                }
                reject(rejected);
              });
          } else {
            resolve(0);
          }

          break;
        case 's3':
          const s3Deleting = files.map(file => `/${file.fileName}`);

          this.cdn.s3.deleteMultiple(s3Deleting, err => {
            if (err) {
              reject(err);
              return;
            }
            resolve(files.length);
          });
          break;
      }
    });
  }

  /**
   * @description
   * 验证单个CDN参数
   *
   * @return {void}
   */
  validateOption(cdn, index = -1) {
    if (typeof cdn === 'undefined') {
      throw new Error(this.lang.EMPTY_CDN_CONFIG);
    }

    if (typeof cdn.type === 'undefined' || SUPPORTED_CDNS.indexOf(cdn.type) === -1) {
      throw new Error(
        `${this.lang.CDN_TYPE_NOT_SUPPORTED}: ${cdn.type}${
          index !== -1 ? ` CDN index:${index}` : ''
        }`
      );
    }
  }

  /**
   * @description
   * 验证传入CDN参数
   *
   * @return {Promise}
   */
  validateOptions() {
    return new Promise((resolve, reject) => {
      let shouldTerm = false;

      if (Array.isArray(this.options.cdn)) {
        let existingReg = {};

        if (this.options.cdn.length === 0) {
          reject(this.lang.EMPTY_CDN_CONFIG);
          return;
        }

        let validating = [];
        
        this.options.cdn.forEach((cdn, index) => {
          validating.push(
            new Promise((__res, __reject) => {
              try {
                this.validateOption(cdn);
              } catch (e) {
                __reject(e.message);
                return;
              }

              // @ts-ignore
              if (typeof cdn.test === 'undefined' || !cdn.test instanceof RegExp) {
                __reject(`${this.lang.INVALID_REGEX} ${index !== -1 ? `, Index: ${index}` : ''}`);
                return;
              }

              const tester = String(cdn.test);

              if (typeof existingReg[tester] === 'undefined') {
                existingReg[tester] = true;
                __res();
              } else {
                readline
                  .createInterface({
                    input: process.stdin,
                    output: process.stdout
                  })
                  .question(this.lang.DUPLICATE_REGEX_FOUND_QUESTION, answer => {
                    if (answer.match(/^y(es)?$/i)) {
                      __res();
                    } else {
                      shouldTerm = true;
                      __reject(this.lang.DUPLICATE_REGEX_FOUND);
                    }
                  });
              }
            })
          );
        });

        if (validating.length > 0) {
          return Promise.all(validating)
            .then(() => {
              if (shouldTerm) {
                reject(this.lang.DUPLICATE_REGEX_FOUND);
              } else {
                resolve();
              }
            })
            .catch(rejected => {
              if (!rejected) {
                return;
              }

              reject(rejected);
            });
        } else {
          reject(this.lang.EMPTY_CDN_CONFIG);
        }
      } else {
        try {
          this.validateOption(this.options.cdn);
          resolve();
        } catch (e) {
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
  handleFileUpload(cdn, asset) {
    return new Promise(async (resolve, reject) => {
      const { existsAt, _value, _name } = asset;

      let response, fileName;
      try {
        if (typeof _name === 'undefined') {
          //对于非js文件
          fileName = this.getNonJsFileName(existsAt);
          const fileContent = fs.readFileSync(existsAt, 'utf8');
          response = await this.upload(
            fileContent,
            IS_WIN_32 ? fileName.replace(/\\/g, '/') : fileName,
            cdn
          );
        } else {
          fileName = _name;
          response = await this.upload(_value, _name, cdn);
        }
      } catch (e) {
        reject(
          this.lang.LOADING_FILE_ERROR.replace('%s', fileName).replace(
            '%2s',
            e.message ? e.message : e
          )
        );
        return;
      }

      if (!response || typeof response.error !== 'undefined') {
        reject(
          this.lang.UPLOADING_ERROR.replace('%s', fileName).replace(
            '%2s',
            response.error ? response.error : response.toString()
          )
        );
      }

      if (!this.isEnded) {
        cl.success(`${this.lang.SINGLE_FILE_UPLOADED}: ${fileName}`);
      }

      resolve({ fileName });
    });
  }

  /**
   * @description
   * 挂钩至webpack afterEmit hook
   *
   * @param {object} compilation
   * @param {function|null} callback
   *
   * @return {Promise}
   */
  async handleEmitted(compilation, callback = null) {
    cl.reset();

    let previousOutput = {
      cdn: null,
      files: []
    };
    this.count = {
      uploading: 0,
      uploaded: 0,
      errored: 0
    };

    this.validateOptions()
      .then(
        async () => {
          const outputOptions = compilation.outputOptions || compilation.options;
          this.outputPath = path.normalize(outputOptions.path || outputOptions.path.output);
          this.logName = this.options.logName || 'wp.previous.json';
          this.logPath = this.options.logPath || path.resolve(this.outputPath, './' + this.logName);

          //开始删除过往上传记录
          if (this.options.deletePrevious) {
            cl.reset(this.lang.DELETE_PREVIOUS_ENABLED);

            try {
              await this.deletePreviousUploads();
            } catch (e) {
              cl.reset(
                this.lang.SKIP_DELETE_PREVIOUS_DUE_TO.replace('%s', e.message ? e.message : e)
              );
            }
          }

          return this.initUploader();
        },
        rejected => {
          //验证参数出错
          cl.error(rejected);
          this.handleCallback(callback);
        }
      )
      .then(
        async () => {
          /*---------------- 加载上传文件 ----------------*/
          cl.reset(this.lang.UPLOAD_START);

          previousOutput.cdn = this.options.cdn;

          let uploadingAssets = [];
          const testRegex = this.options.cdn.test || /\.(js|css)$/; //用于单CDN上传时验证

          for (let asset in compilation.assets) {
            let fileName;
            const { existsAt } = compilation.assets[asset];

            try {
              //非js文件不会直接包括文件内容, 需要使用fs提取内容并手动提取文件名
              if (this.isMultipleCdn) {
                for (let cdn of this.options.cdn) {
                  if (!cdn.test.test(existsAt)) {
                    continue;
                  }

                  uploadingAssets.push(this.handleFileUpload(cdn, compilation.assets[asset]));
                }
              } else {
                if (!testRegex.test(existsAt)) {
                  continue;
                }

                uploadingAssets.push(
                  this.handleFileUpload(this.options.cdn, compilation.assets[asset])
                );
              }
            } catch (e) {
              cl.error(
                this.lang.LOADING_FILE_ERROR.replace('%s', fileName).replace(
                  '%2s',
                  e instanceof Error ? e.message : e
                )
              );
              this.handleCallback(callback);
              break;
            }

            //一个文件出错则停止所有上传
          }

          if (uploadingAssets.length === 0) {
            this.handleCallback(callback);
            return;
          }

          return Promise.all(uploadingAssets);
        },
        rejected => {
          //加载上传CDN实例出错
          cl.error(this.lang.INVALID_CDN_OPTIONS_LOADED.replace('%s', rejected));
        }
      )
      .then(
        uploads => {
          previousOutput.files = uploads || [];

          //保存上传记录, 用于下一次删除
          if (Array.isArray(previousOutput.files) && previousOutput.files.length > 0) {
            try {
              fs.writeFileSync(this.logPath, JSON.stringify(previousOutput));
            } catch (e) {
              cl.error(
                this.lang.SAVING_LOG_ERROR.replace('%s', e instanceof Error ? e.message : e)
              );
            }
          }

          if (this.count.uploading === this.count.uploaded) {
            if (!this.isEnded) {
              cl.success(this.lang.ALL_FILE_UPLOADED);
            }

            if (this.options.deleteOutput) {
              cl.reset(this.lang.DELETE_OUTPUT_ENABLED);

              let deletedErrors = [];
              for (let asset in compilation.assets) {
                const { existsAt } = compilation.assets[asset];
                try {
                  fs.unlinkSync(existsAt);
                } catch (e) {
                  deletedErrors.push(e instanceof Error ? e.message : e);
                }
              }
            }
          }

          /*---------------- 上传结束 ----------------*/
          cl.colorParts(this.lang.FINAL_OUTPUT(this.count));
          this.handleCallback(callback);
        },
        rejecteds => {
          //上传任务出错
          cl.error(
            Array.isArray(rejecteds)
              ? rejecteds
                  .map(
                    (rejected, index) =>
                      `${index + 1}. ${rejected instanceof Error ? rejected.message : rejected}`
                  )
                  .join('\n')
              : rejecteds instanceof Error
              ? rejecteds.message
              : rejecteds
          );
          this.isEnded = true;
          this.handleCallback(callback);
        }
      );
  }

  /**
   * ftp需要手动结束进程
   * @returns {void}
   */
  endFtp() {
    if (typeof this.cdn.ftp !== 'undefined' && this.cdn.ftp !== null) {
      this.cdn.ftp.end();
      this.cdn.ftp = null;
    }
  }

  /**
   * 统一处理结束callback
   */
  handleCallback(callback) {
    this.endFtp();
    if (callback !== null) callback();
  }

  /**
   * 获取非js资源文件名
   *
   * @param {string} existsAt
   *
   * @returns {string}
   *   文件名
   */
  getNonJsFileName(existsAt) {
    let name = existsAt.replace(this.outputPath, '');
    name = name.substr(1, name.length); //去除第一个斜杠;

    return IS_WIN_32 ? name.replace(/\\/g, '/') : name;
  }

  /**
   * @param {WebpackCompiler} compiler
   */
  apply(compiler) {
    //webpack版本兼容
    if (compiler.hooks) {
      //webpack 4
      compiler.hooks.afterEmit.tapAsync('WpBundleUploaderPlugin', this.handleEmitted.bind(this));
    } else {
      //webpack 3
      compiler.plugin('after-emit', this.handleEmitted.bind(this));
    }
  }
}

module.exports = WebpackBundleUploaderPlugin;
