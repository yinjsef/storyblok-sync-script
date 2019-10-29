var argv = require('minimist')(process.argv.slice(2), {
  string: ['command', 'token', 'api', 'targetToken', 'targetApi'],
  number: ['source', 'target'],
  default: {
    token: 'FXJbx8OWNLXgQSTuIeDntAtt-18-VSfwqDEhnUKwvKpVza5_',
    targetToken: 'FXJbx8OWNLXgQSTuIeDntAtt-18-VSfwqDEhnUKwvKpVza5_',
    api: 'https://8xhrfleis8.execute-api.cn-north-1.amazonaws.com.cn/live/v1',
    targetApi: 'https://8xhrfleis8.execute-api.cn-north-1.amazonaws.com.cn/live/v1',
  }
})

var sync = require('./src/sync')
sync.handler({options: argv})