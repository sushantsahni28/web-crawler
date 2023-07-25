const fs = require('fs')
const path = require('path')
const { stem }= require('stemr');
const { stopwords } = require('./stopwords');
const db = require('../models/sql.model');

const dirPath = path.join(__dirname,'..','savedHtml','html_7197569','httpscodequotientcom_0.html')

var keywords = new Map()

function containsSpl(str) {
  const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
  return specialChars.test(str);
}

function searchTags(regex,tagArray,weight){
    const replaceregex = /<br\/>|<br \/>|<br(.*?)>|<span(.*?)>|<\/span>|<var(.*?)>|<\/var>|<script(.*?)>|<\/script>|<noscript(.*?)>|<\/noscript>|<link(.*?)>|<\/link>|<iframe(.*?)>|<\/iframe>|<svg(.*?)>|<\/svg>|<div(.*?)>|<\/div>|<strong(.*?)>|<\/strong>|<b(.*?)>|<\/b>|<i(.*?)>|<\/i>|<pre(.*?)>|<\/pre>|<small(.*?)>|<\/small>|<sub(.*?)>|<\/sub>|<sup(.*?)>|<\/sup>|<u(.*?)>|<\/u>|<s(.*?)>|<\/s>|>|<|\//g

    for(let i=0; tagArray && i<tagArray.length; i++){
        //const regex = /<tagName(.*?)>|<\/tagName>/g;
        
        let result = tagArray[i].replaceAll(regex,"").trim()
        result = result.replace(/\s+/g, ' ').trim()
        
        const word = result.replaceAll(replaceregex," ")
        const line = word.replace(/\s+/g, ' ').trim()
        const words = line.split(" ")
        
        for(let i=0; i<words.length; i++){
            if(!containsSpl(words[i])){
                let word = words[i].toLowerCase()
                if(word[0] < 'a' || word[0] > 'z'){
                    continue
                }
                word = stem(word)
                const prop = `${word[0]}stop`
                if(word && !stopwords[prop].has(word)){
                    if(keywords.has(word)){
                        const value = keywords.get(word)
                        keywords.set(word,value+weight)
                    }else{
                        keywords.set(word,weight)
                    }
                }
            }
        }
    }
    //console.log(keywords) 
}

function getKeywords(){
    return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(dirPath)
    stream.on("data", function(data){
        var chunk = data.toString()

        const regexTitle = /<title(.*?)>([\s\S]*?)<\/title>/g
        const regexH1 = /<h1(.*?)>([\s\S]*?)<\/h1>/g
        const regexH2 = /<h2(.*?)>([\s\S]*?)<\/h2>/g
        const regexH3 = /<h3(.*?)>([\s\S]*?)<\/h3>/g
        const regexH4 = /<h4(.*?)>([\s\S]*?)<\/h4>/g
        const regexH5 = /<h5(.*?)>([\s\S]*?)<\/h5>/g
        const regexH6 = /<h6(.*?)>([\s\S]*?)<\/h6>/g
        const regexP = /<p(.*?)>([\s\S]*?)<\/p>/g
        const regexA = /<a(.*?)>([\s\S]*?)<\/a>/g

        const allTags = []

        allTags.push(chunk.match(regexTitle))
        allTags.push(chunk.match(regexH1))
        allTags.push(chunk.match(regexH2))
        allTags.push(chunk.match(regexH3))
        allTags.push(chunk.match(regexH4))
        allTags.push(chunk.match(regexH5))
        allTags.push(chunk.match(regexH6))
        allTags.push(chunk.match(regexP))
        allTags.push(chunk.match(regexA))
        
        const regexArray = [/<title(.*?)>|<\/title>/g, /<h1(.*?)>|<\/h1>/g, /<h2(.*?)>|<\/h2>/g,
                            /<h3(.*?)>|<\/h3>/g, /<h4(.*?)>|<\/h4>/g, /<h5(.*?)>|<\/h5>/g,
                            /<h6(.*?)>|<\/h6>/g, /<p(.*?)>|<\/p>/g, /<a(.*?)>|<\/a>/g]
        
        const weightArray = [7,6,5,3,3,3,3,3,3]
        

        for(let i=0; i<allTags.length; i++){
            searchTags(regexArray[i], allTags[i], weightArray[i])
        }
        resolve() 
    })
})
}
  
async function extractKeyWords(){
    //const t1 = Date.now()
    await getKeywords()
    
    for(let [key, value] of keywords){
        console.log(key + " = " + value);
    }

    // const t2 = Date.now()
    // console.log(t2-t1)
}
//extractKeyWords()
function firstTest(docUrl){
    const wordmap = new Map()
    wordmap.set("hello",5)
    wordmap.set("bye",8)
    
    db.query(`insert into docs docurl=${docUrl}`,(err,data) => {
        if(err){
            throw err
        }
        console.log(data)
    })
    
    for(let [key, value] of keywords){
        console.log(key + " = " + value);
    }
}
const url = 'http://localhost:8000/'
firstTest(url)

