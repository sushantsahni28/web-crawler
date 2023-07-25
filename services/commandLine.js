const yargs = require('yargs');

const argv = yargs(process.argv.slice(2))
.option("time", {
    alias: "t",
    describe: "Time for max no. of requests(in sec)(1 min = 60)"
  })
  .option("maxreq",{
    alias: "m",
    describe: "Max requests in given time"
  })
  .option("depth", {
    alias: "d",
    describe: "Depth of crawler"
  })
  .option("sessionid", {
    alias: "sid",
    describe: "Session Id to start previously paused session (also pass seed to resume simple session (seed could be random in case of resuming session))"
  })
  .option("seed", {
    describe: "Provide the seed url to crawl (in case no url then http://localhost:8000/seed_session will be called)"
  })
  .demandOption(["time"], "Please specify the time")
  .demandOption(["maxreq"], "Please specify max requests")
  .demandOption(["depth"], "please specify the depth").argv

  module.exports = {
    argv
  }