import dotenv from 'dotenv'
import axios from 'axios'
dotenv.config()

export const getMerchantProController = (baseUrl, apiKey, apiSecret) => {
  const authToken = `Basic ${btoa(`${apiKey}:${apiSecret}`)}`
  const api = axios.create({
    headers: {
      Authorization: authToken,
    },
  })

  const getProduct = async (sku) => {
    const url = `${baseUrl}/inventory/sku/${sku}`

    const response = await api.get(url)
    return response.data
  }

  const updateProductStockAndPrice = async (sku, stock, price) => {
    const url = `${baseUrl}/inventory/sku/${sku}`

    const response = await api.patch(url, {
      price_net: price,
      stock,
    })

    return response.data
  }

  const updateProductStock = async (sku, stock) => {
    const url = `${baseUrl}/inventory/sku/${sku}`

    const response = await api.patch(url, {
      stock,
    })

    return response.data
  }

  return { getProduct, updateProductStockAndPrice, updateProductStock }
}
