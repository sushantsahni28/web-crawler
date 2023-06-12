const express = require('express')
const nanoid = require('nanoid')
const { loadState } = require('.')

const app = express()
var sid

app.route("/session_start")
    .get((req,res) => {
        sid = nanoid(10)
        loadState(sid)
        res.json({sid})
    })

app.route("/session_stop")
    .get((req,res)=>{
        res.json({sid})
    })

app.listen(8000, () => {
    console.log('port 8000')
})