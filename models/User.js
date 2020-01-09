const bcrypt = require("bcryptjs")
const usersCollection = require('../db').db().collection("users")
const validator = require('validator')
const md5 = require('md5')
// validator는 true반환하니 !를 붙여서 false인 경우 에러 발생

let User = function(data, getAvatar) {
  // 만들어질 인스턴스 = this이용
  // 여기서 data는 컨트롤러에서 받은 req.body
  this.data = data
  // 에러 저장 배열
  this.errors = []
  // 아바타주소 받기
  if (getAvatar == undefined) {getAvatar = false}
  if (getAvatar) {this.getAvatar()}
}

User.prototype.cleanUp = function() {
  // 조건이 string이 아니면 공백으로 초기화
  if (typeof(this.data.username) != "string") {this.data.username = ""}
  if (typeof(this.data.email) != "string") {this.data.email = ""}
  if (typeof(this.data.password) != "string") {this.data.password = ""}

  // get rid of any bogus properties
  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  }
}

// 프로토타입
User.prototype.validate = function() {
  return new Promise(async (resolve, reject) => {
    if (this.data.username == "") {
      this.errors.push("You must provide a username.")
    }
    if (this.data.username != "" && !validator.isAlphanumeric(this.data.username)) {
      this.errors.push("Username can only contain letters and numbers.")
    }
    if (!validator.isEmail(this.data.email)) {
      this.errors.push("You must provide a valid email address.")
    }
    if (this.data.password == "") {
      this.errors.push("You must provide a password")
    }
    if (this.data.password.length > 0 && this.data.password.length < 12) {
      this.errors.push("Password must be at least 12 characters")
    }
    if (this.data.password.length > 50) {
      this.errors.push("Password cannot exceed 50 characters.")
    }
    if (this.data.username.length > 0 && this.data.username.length < 3) {
      this.errors.push("Username must be at least 3 characters")
    }
    if (this.data.username.length > 30) {
      this.errors.push("Username cannot exceed 30 characters.")
    }

    // Only if username is valid then check to see if it's already taken(유저 네임 검사)
    if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
      // async 함수 안에서만 await 사용가능
      let usernameExists = await usersCollection.findOne({
        username: this.data.username
      })
      if (usernameExists) {
        this.errors.push("That username is already taken.")
      }
    }

    // Only if email is valid then check to see if it's already taken(유저 네임 검사)
    if (validator.isEmail(this.data.email)) {
      let emailExists = await usersCollection.findOne({
        email: this.data.email
      })
      if (emailExists) {
        this.errors.push("That email is already taken.")
      }
    }
    // 이메일까지 체크한 후
    resolve()
  })
}

User.prototype.login = function() {
  // 새로운 오브젝트인 Promise를 반환.
  return new Promise((resolve, reject) => {
    this.cleanUp()
    usersCollection.findOne({
        username: this.data.username
      }).then((attemptedUser) => {
      if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
        this.data = attemptedUser
        this.getAvatar()
        resolve("Congrats!!")
      } else {
        reject("Invalid username / password.")
      }
    }).catch(function() {
      reject("Please try again later.")
    })
  })
}

User.prototype.register = function() {
  return new Promise(async (resolve, reject) => {
    // Step #1: Validate user data (인증 오류가 있는 경우)
    this.cleanUp()
    await this.validate()

    // Step #2: Only if there are no validation errors
    // then save the user data into a database (인증오류 x-> db)
    if (!this.errors.length) {
      // hash user Password(패스워드 보안(해쉬화))
      let salt = bcrypt.genSaltSync(10)
      this.data.password = bcrypt.hashSync(this.data.password, salt)
      // 에러가 하나도 없이 완벽할때
      usersCollection.insertOne(this.data)
      this.getAvatar()
      resolve()
    } else {
      // there were errors...
      reject(this.errors)
    }
  })
}

User.prototype.getAvatar = function() {
  this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = function(username) {
  return new Promise(function(resolve, reject) {
    if (typeof(username) != "string") {
      reject()
      return 
    }
    usersCollection.findOne({username: username}).then(function(userDoc) {
      if (userDoc) {
        userDoc = new User(userDoc, true)
        userDoc = {
          _id: userDoc.data._id,
          username: userDoc.data.username,
          avatar: userDoc.avatar
        }
        resolve(userDoc)
      } else {
        reject()
      }
    }).catch(function() {
      reject()
    })
  })
}

User.doesEmailExist = function(email) {
  return new Promise(async function(resolve, reject) {
    if (typeof(email) != "string") {
      resolve(false)
      return 
    }

    let user = await usersCollection.findOne({email: email})
    if (user) {
      resolve(true)
    } else {
      resolve(false)
    }
  })
}

module.exports = User