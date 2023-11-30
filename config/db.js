const mysql = require('mysql')

const db = mysql.createConnection({
    host: "msgbam.cafe24.com",
    user: 'root',
    password: 'qjfwk100djr!',
    port: 3306,
    database: 'mbam',
    timezone: 'Asia/Seoul',
    charset: 'utf8mb4'
})
db.connect();

module.exports = db;