import express from 'express'
import { getCielController } from './controllers/cielController.js'
import fs from 'fs'
import dotenv from 'dotenv'
import { getMerchantProController } from './controllers/merchantProController.js'
import { calculatePriceWithVAT } from './utils/calculatePriceWithVAT.js'

dotenv.config()

const app = express()
app.use(express.json())

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

app.post('/updateStockAndPrice', async (req, res) => {
  const logFilePath = process.cwd() + `/logs/${new Date().toISOString()}.txt`
  var logFile = ''

  const body = req.body
  const cielController = getCielController(
    body.cielBaseUrl,
    body.cielUsername,
    body.cielPassword,
    body.cielDatabase,
  )
  const token = await cielController.getAuthToken()
  const products = await cielController.getAllProducts(token)

  for (let i = 0; i < body.merchants.length; i++) {
    let updated = 0
    let error = 0
    let notFound = 0
    let productCount = 0

    const currentMerchant = body.merchants[i]
    const merchantClient = getMerchantProController(
      currentMerchant.merchantBaseUrl,
      currentMerchant.merchantApiKey,
      currentMerchant.merchantApiSecret,
    )

    for (let x = 0; x < products.length; x++) {
      await wait(1000)
      let product = products[x]
      productCount += 1

      process.stdout.clearLine()
      process.stdout.cursorTo(0)
      process.stdout.write(
        `\x1b[1m \x1b[35m ${x + 1}/${products.length} Products | ${i + 1}/${
          body.merchants.length
        } Merchants | \x1b[31m Errors: ${error} | \x1b[33m Not Found: ${notFound}`,
      )

      if (product.Blocked) continue

      try {
        // intern Stock Consumption
        if (product.ArticlesWarehouseStocks != null)
          product.ArticlesWarehouseStocks.forEach((warehouse) => {
            if (warehouse.WarehouseName == 'Consum intern') {
              product.TotalStockQuantity -= warehouse.StockQuantity
            }
          })

        const merchantProduct = await merchantClient.getProduct(
          product[currentMerchant.FK],
        )

        let price = 0
        const VAT = product.VatInQuotaValue

        // Getting price from Muncii else Baneasa
        if (product.ArticlesWarehousesPrices != null) {
          if (
            body.settings.comparePriceBetweenWarehouses &&
            product.ArticlesWarehousesPrices.filter(
              (m) => m.WarehouseName == 'Muncii',
            )?.length &&
            product.ArticlesWarehousesPrices.filter(
              (m) => m.WarehouseName == 'Baneasa',
            )?.length &&
            product.ArticlesWarehousesPrices.filter(
              (m) => m.WarehouseName == 'Muncii',
            )[0]?.PriceOut !=
              product.ArticlesWarehousesPrices.filter(
                (m) => m.WarehouseName == 'Baneasa',
              )[0]?.PriceOut
          ) {
            logFile += `[${product[currentMerchant.FK]}] - "${
              product.Name
            }"  Muncii:${calculatePriceWithVAT(
              product.ArticlesWarehousesPrices.filter(
                (m) => m.WarehouseName == 'Muncii',
              )[0]?.PriceOut * currentMerchant.priceMultiplier,
              VAT,
            )} Baneasa:${calculatePriceWithVAT(
              product.ArticlesWarehousesPrices.filter(
                (m) => m.WarehouseName == 'Baneasa',
              )[0]?.PriceOut * currentMerchant.priceMultiplier,
              VAT,
            )}\n`
            fs.appendFile(
              logFilePath,
              `[${product[currentMerchant.FK]}] - "${
                product.Name
              }"  Muncii:${calculatePriceWithVAT(
                product.ArticlesWarehousesPrices.filter(
                  (m) => m.WarehouseName == 'Muncii',
                )[0]?.PriceOut * currentMerchant.priceMultiplier,
                VAT,
              )} Baneasa:${calculatePriceWithVAT(
                product.ArticlesWarehousesPrices.filter(
                  (m) => m.WarehouseName == 'Baneasa',
                )[0]?.PriceOut * currentMerchant.priceMultiplier,
                VAT,
              )}\n`,
              () => {},
            )
          }
          if (
            product.ArticlesWarehousesPrices.filter(
              (m) => m.WarehouseName == 'Muncii',
            )[0]
          ) {
            price = calculatePriceWithVAT(
              product.ArticlesWarehousesPrices.filter(
                (m) => m.WarehouseName == 'Muncii',
              )[0].PriceOut * currentMerchant.priceMultiplier,
              VAT,
            )
          } else if (
            product.ArticlesWarehousesPrices.filter(
              (m) => m.WarehouseName == 'Baneasa',
            )[0]
          ) {
            price = calculatePriceWithVAT(
              product.ArticlesWarehousesPrices.filter(
                (m) => m.WarehouseName == 'Baneasa',
              )[0].PriceOut * currentMerchant.priceMultiplier,
              VAT,
            )
          } else {
            logFile += `[${product[currentMerchant.FK]}] - "${
              product.Name
            }" - Price not found\n`
            fs.appendFile(
              logFilePath,
              `[${product[currentMerchant.FK]}] - "${
                product.Name
              }" - Price not found\n`,
            )
          }
        }

        if (body.settings.compareStockAndPrice) {
          logFile += `[${product[currentMerchant.FK]}] - "${
            product.Name
          }" Ciel: (Stock: ${
            product.TotalStockQuantity
          }, Price: ${price}) ||| Merchant: (Stock ${
            merchantProduct.stock
          }, Price: ${merchantProduct.price_gross}) \n`

          fs.appendFile(
            logFilePath,
            `[${product[currentMerchant.FK]}] - "${
              product.Name
            }" Ciel: (Stock: ${
              product.TotalStockQuantity
            }, Price: ${price}) ||| Merchant: (Stock ${
              merchantProduct.stock
            }, Price: ${merchantProduct.price_gross}) \n`,
            () => {},
          )
        }

        if (
          body.settings.updateProductPrice &&
          price != merchantProduct.price__gross
        ) {
          // todo...
          // Update Price
        }
        if (
          product.TotalStockQuantity != merchantProduct.stock &&
          body.settings.stockUpdate
        ) {
          try {
            await merchantClient.updateProductStock(
              product[currentMerchant.FK],
              product.TotalStockQuantity,
            )
            updated += 1

            if (body.settings.logStockUpdate) {
              logFile += `[${product[currentMerchant.FK]}] - "${
                product.Name
              }" -- Updated update stock from ${merchantProduct.stock} to ${
                product.TotalStockQuantity
              }\n`

              fs.appendFile(
                logFilePath,
                `[${product[currentMerchant.FK]}] - "${
                  product.Name
                }" -- Updated update stock from ${merchantProduct.stock} to ${
                  product.TotalStockQuantity
                }\n`,
                () => {},
              )
            }
          } catch (err) {
            error += 1

            if (body.settings.logStockUpdateFailed) {
              logFile += `[${product[currentMerchant.FK]}] - "${
                product.Name
              }" -- Failed to update stock from ${merchantProduct.stock} to ${
                product.TotalStockQuantity
              }\n`

              fs.appendFile(
                logFilePath,
                `[${product[currentMerchant.FK]}] - "${
                  product.Name
                }" -- Failed to update stock from ${merchantProduct.stock} to ${
                  product.TotalStockQuantity
                }\n`,
                () => {},
              )
            }
          }
        }
      } catch (err) {
        if (err.response?.data) {
          notFound += 1

          if (body.settings.logNotFound) {
            logFile += `[${product[currentMerchant.FK]}] - "${
              product.Name
            }" -- Product not found in merchant ${
              currentMerchant.merchantBaseUrl
            }\n`

            fs.appendFile(
              logFilePath,
              `[${product[currentMerchant.FK]}] - "${
                product.Name
              }" -- Product not found in merchant ${
                currentMerchant.merchantBaseUrl
              }\n`,
              () => {},
            )
          }
        } else {
          error += 1
          console.log(err)
        }
      }
    }

    logFile += `\n[${currentMerchant.merchantBaseUrl}] -- Updated: (${updated}/${productCount}) | Not Found: (${notFound}/${productCount}) | Error: (${error}/${productCount})\n\n`
    fs.appendFile(
      logFilePath,
      `\n[${currentMerchant.merchantBaseUrl}] -- Updated: (${updated}/${productCount}) | Not Found: (${notFound}/${productCount}) | Error: (${error}/${productCount})\n\n`,
      () => {},
    )
    res.json(logFile)
  }
})

app.listen(process.env.PORT, () => {
  console.log('App running on port ' + process.env.PORT)
})
