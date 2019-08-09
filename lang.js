module.exports = {
  en: {
    DUPLICATE_REGEX_FOUND: 'Upload task terminated due to duplicate Regex pattern found',
    DUPLICATE_REGEX_FOUND_QUESTION: 'Duplicate Regex pattern found, continue? (y/n):',
    INVALID_REGEX: 'Invalid regex pattern',
    EMPTY_CDN_CONFIG: 'Empty CDN upload config',
    EMPTY_ACCESS_OR_SECRET: 'Empty %s access key or secret key',
    LANGUAGE_LOAD_FAILED: 'Invalid custom language file "%s", using default output language',
    INVALID_CDN_OPTIONS_LOADED:
      'Invalid cdn options loaded, please check your CDN options and recompile: %s',
    CDN_TYPE_NOT_SUPPORTED: 'Not supported CDN type',
    DELETE_PREVIOUS_ENABLED: '<deletePrevious> option enabled, Deleting previous resources...',
    PREVIOUS_LOG_NOT_EXISTS: "Previous log file doesn't exist.",
    INVALID_PREVIOUS_LOG_FILE: 'Invalid previous wp.bundle.json file',
    EMPTY_PREVIOUS_LOG_FILE: 'Empty previous uploaded file',
    DELETED_NUM_PREVIOUS_FILES: 'Deleted %s previous bundle files',
    SKIP_DELETE_PREVIOUS_DUE_TO: 'Skip to delete previous files due to: %s',
    EMPTY_UPLOADING_FILES:
      'No uploading files found, check regex test option if there are any issues',
    UPLOAD_START: 'Uploading bundle files to selected CDN...',
    SINGLE_FILE_UPLOADED: 'File uploaded',
    LOADING_FILE_ERROR: 'Error happened while loading file %s due to %2s, please try to recompile',
    UPLOADING_ERROR: 'Error happened while uploading file %s due to %2s, please try to recompile',
    ALL_FILE_UPLOADED: 'All bundle files have been uploaded successfully',
    DELETE_OUTPUT_ENABLED: '<deleteOutput> option enabled, all output files are deleted',
    SAVING_LOG_ERROR: 'Error happened while saving uploaded log due to: %s',
    INVALID_FTP_DEST_PATH: 'Invalid ftp destination path',
    FINAL_OUTPUT: ({ uploaded, uploading, errored }) => {
      return [
        { type: 'reset', text: 'UPLOAD RESULT:' },
        { type: 'reset', text: `Total:${uploading}` },
        { type: 'success', text: `Uploaded:${uploaded}` },
        { type: 'error', text: `Errors:${errored}` }
      ];
    }
  },
  cn: {
    DUPLICATE_REGEX_FOUND: '发现重复CDN正则匹配, 已取消上传任务',
    DUPLICATE_REGEX_FOUND_QUESTION: '发现重复CDN正则匹配, 是否继续? (y/n):',
    INVALID_REGEX: '无效正则匹配参数',
    EMPTY_CDN_CONFIG: 'CDN参数为空',
    EMPTY_ACCESS_OR_SECRET: '%s Access Key或Secret Key为空',
    LANGUAGE_LOAD_FAILED: '无效自定义文件"%s", 使用默认输出语言',
    INVALID_CDN_OPTIONS_LOADED: '无效CDN参数, 请检查并重新打包: %s',
    CDN_TYPE_NOT_SUPPORTED: '暂不支持所选CDN类型',
    DELETE_PREVIOUS_ENABLED: '<deletePrevious>选项为开启, 正在删除过往上传文件...',
    PREVIOUS_LOG_NOT_EXISTS: '过往上传记录文件不存在',
    INVALID_PREVIOUS_LOG_FILE: '无效wp.bundle.json文件',
    EMPTY_PREVIOUS_LOG_FILE: '以往上传记录中文件列表为空',
    DELETED_NUM_PREVIOUS_FILES: '已删除%s个过往上传文件',
    SKIP_DELETE_PREVIOUS_DUE_TO: '已跳过删除过往文件, 因为: %s',
    UPLOAD_START: '开始上传打包文件至CDN...',
    SINGLE_FILE_UPLOADED: '文件已上传',
    EMPTY_UPLOADING_FILES: '无任何需要上传文件, 如有问题请检查正则匹配参数',
    LOADING_FILE_ERROR: '读取文件%s出错: %2s, 上传中断请尝试重新打包',
    UPLOADING_ERROR: 'CDN上传出错: %s, 因为: %2s ,上传中断请尝试重新打包',
    ALL_FILE_UPLOADED: '所有打包文件已上传成功',
    DELETE_OUTPUT_ENABLED: '<deleteOutput>选项为开启, 已删除所有输出文件',
    SAVING_LOG_ERROR: '保存上传记录失败, 因为: %s',
    INVALID_FTP_DEST_PATH: '请提供ftp上传目录',
    FINAL_OUTPUT: ({ uploaded, uploading, errored }) => {
      return [
        { type: 'reset', text: '上传记录:' },
        { type: 'reset', text: `总任务${uploading}` },
        { type: 'success', text: `已上传${uploaded}` },
        { type: 'error', text: `出错${errored}` }
      ];
    }
  }
};
