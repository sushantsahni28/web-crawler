const request = require('request')
const fs = require('fs')
const path = require('path')
const http = require('http');
const yargs = require('yargs');
const { clearInterval } = require('timers');

var visitedLinks = {};
var linkQueue = [];
var fileQueue = [];

const argv = yargs(process.argv.slice(2))
.option("time", {
    alias: "t",
    describe: "Time after which request is made"
  })
  .option("depth", {
    alias: "d",
    describe: "Depth of crawler"
  })
  .option("force", {
    alias: "f",
    describe: "Force restart"
  })
  .demandOption(["time"], "Please specify the time")
  .demandOption(["depth"], "please specify the depth").argv

const userWaitTime = argv.time
const maxDepth = argv.depth
const force = argv.force
var waitTime = 1

const dirPath = path.join(__dirname, "savedHtml")

function readAndWrite(body,file, filename){
    let writeStream = fs.createWriteStream(file);

    writeStream.write(body, 'utf-8')
    writeStream.on('finish',() => fileQueue.push(filename))
    writeStream.end();    
}

setTimeout(webCrawler,waitTime*1000)

function webCrawler(){
    if(linkQueue.length != 0){
      //console.log(fileQueue)
      const { url, depth } = linkQueue.shift();
      saveState()

      if(!visitedLinks[url]){
        visitedLinks[url] = true

        request(url, (err, res, body) => {
          if (err) {
            console.log("Could not reach "+url);
            waitTime = 1
            setTimeout(webCrawler,waitTime*1000)
          } else {
            const fileHeaders = res.headers['content-type']

            if(fileHeaders.includes('html') || fileHeaders.includes('xml')){
              const fileName = `${Date.now()}_${depth}.html`
              const filewithDir = dirPath+"/"+fileName
              readAndWrite(body, filewithDir, fileName) 
              waitTime = userWaitTime
              setTimeout(webCrawler,waitTime*1000)
            }
            else{
              console.log('Rejected url '+url)
              waitTime = 1
              setTimeout(webCrawler,waitTime*1000)
            }
          }
        });
      }
      else { 
        waitTime = 1
        setTimeout(webCrawler,waitTime*1000)
      }
    }
  }


const Parser = setInterval(function(){
      if(fileQueue.length != 0){
        const readFilename = fileQueue.shift()
        saveState()

        const depth = parseInt(readFilename.split("_")[1].split(".")[0])

        if(depth != maxDepth){
          const stream = fs.createReadStream(dirPath+"/"+readFilename);
          
          stream.on("data", function(data){
            var chunk = data.toString()
            let arr = chunk.split(">")
            let regex = /((https|http)?:\/\/[^\s]+)/g

            arr.forEach(item => {
              if(item.includes("href")){
                let result = item.match(regex);

                for(let i=0; result && i<result.length; i++){
                    const parsedLink = {
                      url:result[i].replaceAll(/'|\\n|\\|,|"/g,""),
                      depth: depth+1
                    }
                    linkQueue.push(parsedLink)  
                }
              }
            })
            //console.log(linkQueue)
          });
        }
        else{
          //no need to parse links anymore
          fileQueue = []
          clearInterval(Parser)
        }
      }
},1000)

function saveState(){
  const saved = {
    visitedLinks,
    linkQueue,
    fileQueue    
  }

  fs.writeFile("data.txt",JSON.stringify(saved),(err) => {
    if(err){
      throw err;
    }
  })
}

function loadState(){
  fs.readFile("data.txt",'utf-8',(err,data) => {
    if(err){
      throw err
    }
    
    if(argv.force || data.length == 0){
      const seed={
        url: 'http://stevescooking.blogspot.com/',
        depth: 0
      }
      linkQueue.push(seed)
    }
    else{
      const saved = JSON.parse(data)
      visitedLinks = saved.visitedLinks
      fileQueue = saved.fileQueue
      linkQueue = saved.linkQueue
    }
  })
}

loadState()

