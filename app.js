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

app.post("/print", (req, res) => {
  // proveriti da li file postoji u temp lokaciji -- ako postoji pokusati brisanje

  let dir = __dirname + `/temp`
  let file = "temp.txt"
  let full_path = path.join(dir, file)
  let destination_path = "C:\\Metaline\\Exch\\Lnk\\To_FP\\ABC_000.txt"

  if (!fs.existsSync(dir))
    try {
      fs.mkdirSync(dir)
      console.log("DIR created")
    } catch (err) {
      res.send({ err_msg: err.message })
      return
    }

  if (fs.existsSync(full_path))
    try {
      fs.unlinkSync(full_path)
      console.log("TEMP FILE deleted")
    } catch (err) {
      res.send({ err_msg: err.message })
      return
    }

  // proveriti request da li odgovara specifikaciji

  let items = req.body.items
  let pay = req.body.pay
  let user = req.body.user
  let errors = []

  if (items) {
    items.forEach((item, index) => {
      if (!item.ident) errors.push(`element ${index} missing ident`)
      if (!item.tax) errors.push(`element ${index} missing tax`)
      if (!item.name) errors.push(`element ${index} missing name`)
      if (!item.price) errors.push(`element ${index} missing price`)
      if (!item.qty) errors.push(`element ${index} missing qty`)
    })
  } else {
    res.send({ err_msg: "missing items" })
    return
  }

  if (pay) {
    if (!pay.cash) errors.push(`missing cash pay`)
    if (!pay.cheque) errors.push(`missing cheque pay`)
    if (!pay.card) errors.push(`missing card pay`)
  } else {
    res.send({ err_msg: "missing pay" })
    return
  }

  if (errors.length > 0) {
    res.send(errors)
    return
  }

  if (!user) user = "Kasir"
  // ako je sve ok praviti file iz requesta i prekopirati ga u locakiju za stampanje
  //izbrisati file iz temp lokacije

  try {
    let stream = fs.createWriteStream(full_path, {
      flags: "a"
    })

    let line_delimiter = "\r\n"

    items.forEach(item => {
      stream.write(
        `${item.ident.padEnd(20)}${item.tax}${item.name.padEnd(
          50
        )}${item.price.padStart(10)}${item.qty.padStart(10)}${line_delimiter}`
      )
    })

    let pay_cash = "PAY_CASH".padEnd(20) + "0Placanje kes".padEnd(51)
    let pay_debit = "PAY_DEBIT".padEnd(20) + "0Placanje kartica".padEnd(51)
    let pay_cheque = "PAY_CHEQUE".padEnd(20) + "0Placanje cek".padEnd(51)
    let user_id = "USER_ID             00000"
    let user_name = `USER_NAME           0${user}`

    stream.write(
      `END_OF_SALE${line_delimiter}${pay_cheque}${pay.cheque.padStart(
        10
      )}${line_delimiter}${pay_debit}${pay.card.padStart(
        10
      )}${line_delimiter}${pay_cash}${pay.cash.padStart(
        10
      )}${line_delimiter}END_OF_PAY${line_delimiter}${user_id}${line_delimiter}${user_name}${line_delimiter}FOOTER_1            0MiRent`
    )

    stream.end()
  } catch (err) {
    res.send({ err_msg: err.message })
    return
  }

  setTimeout(() => {
    try {
      fs.copyFileSync(full_path, destination_path)
    } catch (err) {
      res.send({ err_msg: err.message })
      return
    }
  }, 300)

  res.send({ msg: "OK" })
})

app.post("/save_invoice_pdf", (req, res) => {
  let dir = __dirname + `/pdf`
  let file = req.body.file
  let file_path = path.join(dir, file)
  const url = req.body.url

  // console.log(url)

  // console.log(file_path_image)

  const watcher = chokidar.watch(file_path)

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

  let _browser
  let _page

  puppeteer
    .launch({ headless: true })
    .then(browser => (_browser = browser))
    .then(browser => (_page = browser.newPage()))
    .then(page => page.goto(url, { waitUntil: "networkidle0" }))
    .then(() => _page)
    .then(page =>
      page.pdf({
        path: file_path,
        format: "A4"
      })
    )
    .then(() => _browser.close())
    .then(res.send({ msg: "OK" }))
    .catch(err => res.send({ err_msg: err.message }))
})

app.listen(port, "localhost", () => {
  console.log(`File server is up and running on address: localhost:${port}`)
})
