const mysql = require('mysql')

const db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '2812',
  database : 'search_engine'
});

module.exports = db