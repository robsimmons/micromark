var fs = require('fs')
var m = require('.')

var doc = String(fs.readFileSync('example.md'))

var result = m(doc)
console.log('result:---')
console.log(result)
console.log('---')