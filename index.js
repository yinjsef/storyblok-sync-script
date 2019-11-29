var argv = require('minimist')(process.argv.slice(2), {
  string: ['command', 'token', 'api', 'targetToken', 'targetApi'],
  number: ['source', 'target'],
  default: {
    api: 'https://8xhrfleis8.execute-api.cn-north-1.amazonaws.com.cn/live/v1',
    token: '<your storyblok api key>',
    // for cross region sync
    // targetApi: 'https://app.storyblok.com/v1',
    // targetToken: '<your storyblok api key>',
  }
})

var sync = require('./src/sync')
sync.handler({options: argv})