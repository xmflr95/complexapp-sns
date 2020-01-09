const dotenv = require('dotenv')
// env 설정파일을 사용하게 해줌
dotenv.config()
const mongodb = require('mongodb')

mongodb.connect(process.env.CONNECTIONSTRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, function (err, client) {
  module.exports = client
  const app = require('./app')
  app.listen(process.env.PORT)
})