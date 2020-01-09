const express = require('express')
const session = require('express-session')
// 세션을 몽고디비에 저장함
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markdown = require('marked')
const csrf = require('csurf')
const app = express()
const sanitizeHTML = require('sanitize-html')

// body-parser
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// api route = 세션 영향 x
app.use('/api', require('./router-api'))

// session options
let sessionOptions = session({
  secret: "JavaScript is so cool",
  store: new MongoStore({client: require('./db')}),
  resave: false,
  saveUninitialized: false,
  // 1000 * 60 * 60 * 24 = 1day
  cookie: {maxAge: 1000 * 60 * 60 * 24, httpOnly: true}
})

app.use(sessionOptions)
app.use(flash())

// 세션 데이터 정보를 locals에 저장함
app.use(function(req, res, next) {
  // make our markdown function available from within ejs templates
  res.locals.filterUserHTML = function(content) {
    return sanitizeHTML(markdown(content), {
      allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      allowedAttributes: {}
    })
  }

  // make all error and success flash messages available from all templates
  res.locals.errors = req.flash("errors")
  res.locals.success = req.flash("success")
  
  // make current user id available on the req object
  if (req.session.user) {req.visitorId = req.session.user._id} else {req.visitorId = 0}
  
  // make user session data available from within view templates
  res.locals.user = req.session.user
  next()
})

// Router 사용
const router = require('./router')

// public folder path(절대경로?)
app.use(express.static('public'))
// 뷰 엔진 설정(ejs)
app.set('views', 'views')
app.set('view engine', 'ejs')

// csurf로 외부사이트 해킹 접속 방어
// 토큰(Token)을 만들어 인증 받도록
app.use(csrf())

app.use(function(req, res, next) {
  res.locals.csrfToken = req.csrfToken()
  next()
})

// 라우팅은 모두 router.js에서 처리한다.
app.use('/', router)

app.use(function(err, req, res, next) {
  if (err) {
    if (err.code == "EBADCSRFTOKEN") {
      req.flash('errors', "Cross site request forgery detected.")
      req.session.save(() => res.redirect('/'))
    } else {
      res.render("404")
    }
  }
})

const server = require('http').createServer(app)
const io = require('socket.io')(server)

io.use(function(socket, next) {
    sessionOptions(socket.request, socket.request.res, next)
})

io.on('connection', function(socket) {
  if (socket.request.session.user) {
    let user = socket.request.session.user

    socket.emit('welcome', {
      username: user.username,
      avatar: user.avatar
    })

    socket.on('chatMessageFromBrowser', function (data) {
      // emit은 이벤트를 보내는 함수, on은 이벤트를 받기위한 함수
      socket.broadcast.emit('chatMessageFromServer', {
        message: sanitizeHTML(data.message, {allowedTags: [], allowedAttributes: {}}),
        username: user.username,
        avatar: user.avatar
      })
    })
  }
})

module.exports = server