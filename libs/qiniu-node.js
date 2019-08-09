const crypto = require('crypto');
const request = require('request');

const resourceUrl = 'rsf.qbox.me';
const rfUrl = 'rs.qiniu.com';

class Qiniu {
  constructor(accessKey, secretKey, host) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.host = host;
  }

  getUploadHost() {
    return this.host === 'z0' ? 'upload.qiniup.com' : `upload-${this.host}.qiniup.com`;
  }

  /**
   * @description 通过原数据上传
   *
   * @param {string} bucket
   * 指定bucket
   * @param {string|Buffer} data
   * 准备上传数据
   * @param {object} params
   * 上传参数
   */
  uploadByData(bucket, data, params = {}) {
    return new Promise((resolve, reject) => {
      const file = data instanceof Buffer ? data : Buffer.from(data);
      const fileSize = file.length;

      if (fileSize <= 0) {
        reject(new Error('上传文件数据为空'));
      }

      const uploadParams = Qiniu.haveUploadParamsReady(bucket, '', params);
      const fileName = params.fileName;
      delete uploadParams.newName;

      const token = this.fetchUploadToken(uploadParams);

      const authorization = `UpToken ${token}`;
      const encodedKey = Qiniu.safeEncode(fileName);
      const host = this.getUploadHost();

      if (!host) {
        reject(new Error(`无效上传地区: ${this.host}`));
        return;
      }

      const uploadUrl = `https://${this.getUploadHost()}/putb64/${fileSize}/key/${encodedKey}`;

      request.post(
        uploadUrl,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: authorization
          },
          body: file.toString('base64')
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            resolve(JSON.parse(response.body));
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  /**
   * @description 获取指定bucket列表
   */
  list(bucket, fileName = '', limit = 1000) {
    return new Promise((resolve, reject) => {
      if (bucket === '') {
        reject(new Error('Bucket不能为空'));
        return;
      }

      const params = {
        bucket,
        prefix: fileName,
        limit
      };

      const authorization = `QBox ${this.fetchRegularToken(`${path}\n`)}`;
      const url = `https://${resourceUrl}/list?${Qiniu.buildQueryString(params)}`;

      request.get(
        url,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: authorization
          }
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            const body = JSON.parse(response.body);

            resolve(body);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  /**
   * @description 批量操作
   *
   * @param {array} resources
   * 包含所操作内容对象的数组, 格式: {bucket:bucket, key:key}
   * @param {string} action
   * 统一指定操作
   */
  batchAction(resources, action = '') {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(resources) || resources.length <= 0) {
        reject(new Error('删除资源列表为空'));
      }

      const resourceQuery =
        '/batch?' +
        resources
          .map(resource => {
            const _action = resource.action || action;
            if (_action === '') {
              return '';
            }
            return `op=/${_action}/${Qiniu.safeEncode(`${resource.bucket}:${resource.fileName}`)}`;
          })
          .join('&');

      const authorization = `QBox ${this.fetchRegularToken(`${resourceQuery}\n`)}`;

      const batchUrl = `https://${rfUrl}${resourceQuery}`;

      request.post(
        batchUrl,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: authorization
          }
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            const body = JSON.parse(response.body);
            resolve(body.length);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  fetchUploadToken(params) {
    const encodedParams = Qiniu.safeEncode(JSON.stringify(params));
    const signedParams = crypto
      .createHmac('sha1', this.secretKey)
      .update(encodedParams)
      .digest('base64');

    const encodedSign = Qiniu.safeEncode(signedParams, false);

    return `${this.accessKey}:${encodedSign}:${encodedParams}`;
  }

  fetchRegularToken(entry) {
    const signedEntry = crypto
      .createHmac('sha1', this.secretKey)
      .update(entry)
      .digest('base64');
    const encodedEntry = Qiniu.safeEncode(signedEntry, false);

    return `${this.accessKey}:${encodedEntry}`;
  }

  static haveUploadParamsReady(bucket, path = '', params = {}) {
    const uploadingFileName =
      params.fileName && params.fileName !== '' ? params.fileName : Qiniu.getRandomKey(path);
    let uploadParams = {
      scope: `${bucket}:${uploadingFileName}`,
      newName: uploadingFileName,
      deadline:
        params.deadline && Qiniu.isTimestampValid(params.deadline)
          ? params.deadline
          : Qiniu.getDefaultDeadline()
    };

    if (params.insertOnly) {
      uploadParams.insertOnly = 1;
    }

    if (params.fileType && params.fileType !== 'low') {
      uploadParams.fileType = 1;
    }

    if (params.uploadType) {
      uploadParams.detectMime = 1;
      uploadParams.mimeLimit = params.uploadType;
    }

    if (params.returnUrl && params.returnBody) {
      uploadParams.returnUrl = params.returnUrl;
      uploadParams.returnBody =
        typeof params.returnBody === 'string'
          ? params.returnBody
          : JSON.stringify(params[returnBody]);
    }

    if (params.callbackUrl && params.callbackBody) {
      uploadParams.callbackUrl = params.callbackUrl;
      const callbackBodyType = params.callbackBodyType
        ? params.callbackBodyType.toUpperCase()
        : 'JSON';

      switch (callbackBodyType) {
        case 'AJAX':
        case 'APPLICATION/X-WWW-FORM-URLENCODED':
          uploadParams.callbackBodyType = 'application/x-www-form-urlencoded';
          uploadParams.callbackBody =
            typeof callbackBody === 'string'
              ? params.callbackBody
              : Qiniu.buildQueryString(params.callbackBody);
          break;
        case 'JSON':
        case 'APPLICATION/JSON':
        default:
          uploadParams.callbackBodyType = 'application/json';
          uploadParams.callbackBody =
            typeof callbackBody === 'string'
              ? params.callbackBody
              : JSON.stringify(params.callbackBody);
      }
    }

    return uploadParams;
  }

  //根据时间随机生成不重复文件名并替换-为_避免与七牛云图片样式冲突
  static getRandomKey(orgUrl = '', prefix = '') {
    const date = new Date();

    const randomText = date.getMonth() + date.getDay() + date.getHours() + date.getMinutes();
    const randomedText =
      orgUrl === '' ? randomText + Math.random() * 200 : randomText + Math.random() * 99 + orgUrl;
    const randomKey = (
      crypto
        .createHash('md5')
        .update(randomedText)
        .digest('hex')
        .substring(0, 17) + randomText
    ).replace(/\-/, '_');

    return prefix + '_' + randomKey;
  }

  /**
   * @description 转码为七牛云可接收的格式
   */
  static safeEncode(content, encode = true) {
    return encode
      ? Buffer.from(content)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
      : content.replace(/\+/g, '-').replace(/\//g, '_');
  }

  //解码七牛云信息
  static safeDecode(content) {
    return Buffer.from(content.replace(/\-/g, '+').replace(/\_/g, '/'), 'base64').toString();
  }

  static isTimestampValid(time) {
    return new Date(time).getTime() > 0;
  }

  static getDefaultDeadline() {
    return 3600 + Math.floor(Date.now() / 1000);
  }

  static buildQueryString(obj) {
    let str = [];
    for (let p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
      }
    return str.join('&');
  }
}

module.exports = Qiniu;
