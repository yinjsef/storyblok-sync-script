var argv = require('minimist')(process.argv.slice(2), {
  string: ['command', 'token', 'api', 'targetToken', 'targetApi'],
  number: ['source', 'target'],
  default: {
    api: 'https://8xhrfleis8.execute-api.cn-north-1.amazonaws.com.cn/live/v1',
    token: 'FXJbx8OWNLXgQSTuIeDntAtt-18-VSfwqDEhnUKwvKpVza5_',
    // for cross region sync
    // targetApi: 'https://app.storyblok.com/v1',
    // targetToken: 'N8xrUpkHLbA6zpWoSC9TCAtt-55653-xv2Dxnf8Fi87bxWf1bPJ',
  }
})

var sync = require('./src/sync')
sync.handler({options: argv})