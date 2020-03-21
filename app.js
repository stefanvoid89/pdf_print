var express = require("express")
var path = require("path")
var cookieParser = require("cookie-parser")
var logger = require("morgan")
const fs = require("fs")
var cors = require("cors")
var puppeteer = require("puppeteer")
const chokidar = require("chokidar")
const { exec } = require("child_process")

var app = express()

const port = 3000

app.use(logger("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(cors())
// app.use(express.static(path.join(__dirname, "public")))
// dodati ako treba konfiguracioni file

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get("env") === "development" ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render("error")
})

app.post("/save_invoice_pdf", (req, res) => {
  let dir = __dirname + `/pdf`
  let file = req.body.file
  let file_path = path.join(dir, file)
  const url = req.body.url

  //* Second option -- chokidar and script */
  // const watcher = chokidar.watch(file_path)

  // exec(
  //   `"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu --print-to-pdf="${file_path}" --no-margins "${url}"  `,
  //   (err, stdout, stderr) => {
  //     if (err) {
  //       //some err occurred
  //       console.error(err)
  //     } else {
  //       // the *entire* stdout and stderr (buffered)
  //       console.log(`stdout: ${stdout}`)
  //       console.log(`stderr: ${stderr}`)
  //     }
  //   }
  // )

  // watcher.on("add", (event, path) => {
  //   watcher.close().then(() => {
  //     res.send({ msg: "OK" })
  //     console.log("closed")
  //     return
  //   })
  // })

  if (!fs.existsSync(dir))
    try {
      fs.mkdirSync(dir)
      console.log("DIR created")
    } catch (err) {
      res.send({ err_msg: err.message })
      return
    }

  if (fs.existsSync(file_path))
    try {
      fs.unlinkSync(file_path)
      console.log("TEMP FILE deleted")
    } catch (err) {
      res.send({ err_msg: err.message })
      return
    }

  let _browser
  let _page

  puppeteer
    .launch({ headless: true })
    .then(browser => (_browser = browser))
    .then(browser => (_page = browser.newPage()))
    .then(page => page.goto(url, { waitUntil: "networkidle0", timeout: 10000 }))
    .then(() => _page)
    .then(page =>
      page.pdf({
        path: file_path,
        format: "A4"
      })
    )
    .then(() => _browser.close())
    .then(() => res.send({ msg: "OK" }))
    .catch(err => res.send({ err_msg: err.message }))
})

app.listen(port, "localhost", () => {
  console.log(`File server is up and running on address: localhost:${port}`)
})
