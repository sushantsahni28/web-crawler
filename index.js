const request = require('request')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { clearInterval } = require('timers');
const { argv } = require('./services/commandLine');
const db = require('./models/sql.model');

var visitedLinks = {};
var linkQueue = [];
var fileQueue = [];

var sessionid

const userWaitTime = argv.time/argv.maxreq
const maxDepth = argv.depth
var waitTime = 3

var dirPath = path.join(__dirname, "savedHtml")

//................write the file using streams...................
function readAndWrite(url,body,depth){
    const filename = `${url.replaceAll(/\.|\\|\:|\?|\_|\//g,"")}_${depth}.html`
    const file = `${dirPath}/${filename}`
    let writeStream = fs.createWriteStream(file);

    writeStream.write(body, 'utf-8')
    writeStream.on('finish',() => {
        let regexhost = /https?:\/\/[^\s]+\//
        let result = url.match(regexhost)

        const fileinfo = {
          parentlink: result[0],
          filename
        }
        fileQueue.push(fileinfo)
    })
    writeStream.end();   
}

//................stop test crawling.............................
function stopTestCrawler(){
  console.log(`http://localhost:8000/stop_session?sid=${sessionid}`)
  request(`http://localhost:8000/stop_session?sid=${sessionid}`,(err,res)=>{
          console.log(res.body)
          //console.log('crawler stopped with session id '+data.sid)
    })
}

function stopNormalCrawler(){
  console.log("Crawling ended")
}
//.............find upto 5 links with unique domain..............
function getUniqueLinks(){
    var count = 0
    const urls = []
    const domains = []
    
    if(linkQueue.length == 0){
      if(!argv.seed){
        stopTestCrawler()
      }
      else{
        stopNormalCrawler()
      }
      return urls
    }
    
    for(let i=0; i<linkQueue.length && count < 5;){
        let {url , depth} = linkQueue[i]
        let regexhost = /https?:\/\/[^\s]+\//
        let result = url.match(regexhost)
        
        if(argv.seed){
          if(visitedLinks[url]){
            linkQueue.splice(i, 1)
            continue
          }
        }

        if(!result){
          linkQueue.splice(i, 1)
          visitedLinks[url] = true
          continue
        }

        if(!domains.includes(result[0])){
            domains.push(result[0])
            let item = {
              url, depth
            }
            urls.push(item)
            if(argv.seed){
              visitedLinks[url] = true
            }
            count++;
            linkQueue.splice(i, 1) 
        }else{
          i++;
        }   
    }
    saveState()
    return urls
}
//.................visiting links................................
function webCrawler(){
    const urls = getUniqueLinks()
   
    const requests = []
    const depths = []

    if(urls.length == 0){
      return
    }
    for(let i=0; i<urls.length; i++){
        const {url, depth} = urls[i]

        depths.push(depth)
        
        //conditional 
        let requrl
        if(!argv.seed){
          requrl = url+`?sid=${sessionid}&depth=${depth}`
          console.log(requrl)
        }else{
          requrl = url
        }
        
        requests.push(axios.get(requrl,{
            timeout: 3000,
            maxRedirects: 0
        }))
    }

    let itr = -1
    Promise.allSettled(requests)
        .then((responses) => {
            for(const response of responses){
            //console.log(responses[i].headers['content-type'])
            itr++;
            if(response.status === 'rejected'){
                console.log("Could not reach "+response.reason.config.url)
                continue
            } 
            const { value } = response
            const headers = value.headers['content-type']
            if(headers.includes('html') || headers.includes('xml') || headers.includes('application')){
              readAndWrite(value.config.url,value.data,depths[itr])
            }
            else{
              console.log("Rejected url "+value.config.url)
            }
        }}
      )
      setTimeout(webCrawler,userWaitTime*1000)
  }

//..................parse the links in the file..................
const Parser = setInterval(function(){
      if(fileQueue.length != 0){
        const {parentlink, filename} = fileQueue.shift()
        saveState()

        const depth = parseInt(filename.split("_")[1].split(".")[0])

        if(depth != maxDepth){
          const stream = fs.createReadStream(dirPath+"/"+filename);
          
          stream.on("data", function(data){
            var chunk = data.toString()
            let arr = chunk.split(">")
            
            let regexHttp = /https?:\/\/[^\s]+/
            let regexsimple = /\/[^\s]+/

            arr.forEach(item => {
              if(item.includes("href")){
                  if(item.match(regexHttp)){
                  let result = item.match(regexHttp)
                
                  for(let i=0; result && i<result.length; i++){
                    const parsedLink = {
                      url:result[i].replaceAll(/'|\\n|\\|,|"/g,""),
                      depth: depth+1
                    }
                    linkQueue.push(parsedLink) 
                  }
                }
                else if(item.match(regexsimple)){
                    let otherres = item.match(regexsimple)
                    for(let i=0; otherres && i<otherres.length; i++){
                      const extlinked = otherres[i].replaceAll(/"/g,"")
                      const parsedLink = {
                      url:parentlink+extlinked.replace(/\//,""),
                      depth: depth+1
                    }
                    linkQueue.push(parsedLink) 
                    }
                }
              }
            })
            //console.log(linkQueue)
          });
        }
        else{
          //no need to parse links anymore
          fileQueue.length = 0
          clearInterval(Parser)
        }
      }
},2000)

//..................save session data in file....................
function saveState(){
  //conditional
  if(!argv.seed){
    const saved = {
      //visitedLinks,
      linkQueue,
      fileQueue    
    }
    fs.writeFile(`sessionsTest/data_${sessionid}.txt`,JSON.stringify(saved),(err) => {
      if(err){
        throw err;
      }
    })
  }else{
    const saved = {
      visitedLinks,
      linkQueue,
      fileQueue    
    }
    fs.writeFile(`sessions/data_${sessionid}.txt`,JSON.stringify(saved),(err) => {
      if(err){
        throw err;
      }
    })
  }  
}

function loadNewTest(){
  const seed={
    url: `http://localhost:8000/seed_session`,      
    depth: 0
  }
  linkQueue.push(seed)

  setTimeout(webCrawler,waitTime*1000)
}

function startNewSession(){
  request('http://localhost:8000/start_session', (err, res, body) =>{
    const data = JSON.parse(res.body)
    sessionid = data.data

    fs.mkdir(path.join(dirPath, `html_${sessionid}`), (err) => {
      if (err) {
          return console.error(err);
      }
      dirPath = path.join(dirPath, `html_${sessionid}`)
      loadNewTest()
    })
  })
}

//.................resume previous test session................
function resumeTestSession(){
    if(argv.sessionid){
      fs.readFile(`sessionsTest/data_${argv.sessionid}.txt`,'utf-8',(err,data) => {
        if(err){
          console.log("Invalid Session Id")
          return
        }
        sessionid = argv.sessionid

        const saved = JSON.parse(data)
        //visitedLinks = saved.visitedLinks
        fileQueue = saved.fileQueue
        linkQueue = saved.linkQueue
        dirPath = path.join(dirPath, `html_${sessionid}`)

        setTimeout(webCrawler,waitTime*1000)      
      })
    }
}

//..................resume session.............................
function resumeSession(){
    if(argv.sessionid){
      fs.readFile(`sessions/data_${argv.sessionid}.txt`,'utf-8',(err,data) => {
        if(err){
          console.log("Invalid Session Id")
          return
        }
        sessionid = argv.sessionid

        const saved = JSON.parse(data)
        visitedLinks = saved.visitedLinks
        fileQueue = saved.fileQueue
        linkQueue = saved.linkQueue
        dirPath = path.join(dirPath, `html_${sessionid}`)

        console.log(`Resuming session ${sessionid}`)
        setTimeout(webCrawler,waitTime*1000)      
      })
    }
}

function start(){
  if(!argv.seed){
    if(argv.sessionid){
      console.log(`Resuming crawling with session id ${argv.sessionid}`)
      resumeTestSession()
    }
    else{
      console.log('Starting new crawling session with url http://localhost:8000/seed_session')
      startNewSession()
    }
  }
  else{
    if(argv.sessionid){
      resumeSession()
    }else{
      sessionid = parseInt(Math.random() * 10000 * Math.random() * 10000)
      
      const seed={
        url: `${argv.seed}`,      
        depth: 0
      }
      linkQueue.push(seed)
      fs.mkdir(path.join(dirPath, `html_${sessionid}`), (err) => {
        if (err) {
            return console.error(err);
        }
        dirPath = path.join(dirPath, `html_${sessionid}`)
        console.log(`Crawling with url ${argv.seed}`)
      })
    }
    setTimeout(webCrawler,waitTime*1000)
  }
}
start()


db.connect(function(err) {
  if (err) {
    console.error('error connecting sql');
    return;
  }
 
  console.log('connected to sql');
});