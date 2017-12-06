const sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./database/ocs.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the ocs database.');
});

module.exports = db;