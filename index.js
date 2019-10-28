var argv = require('minimist')(process.argv.slice(2), {
  string: ['command', 'token', 'api', 'targetToken', 'targetApi'],
  number: ['source', 'target'],
  default: {
    token: 'FXJbx8OWNLXgQSTuIeDntAtt-18-VSfwqDEhnUKwvKpVza5_',
    targetToken: '3NULhBzcveRVjlzm0mN1Twtt-55653-WYVrKYHcS-ofW5Pc5e1Q',
    api: 'https://8xhrfleis8.execute-api.cn-north-1.amazonaws.com.cn/live/v1',
    targetApi: 'https://app.storyblok.com/v1',
  }
})

var sync = require('./src/sync')
sync.handler({options: argv})