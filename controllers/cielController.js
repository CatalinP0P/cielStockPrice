import dotenv from 'dotenv'
import axios from 'axios'
dotenv.config()

export const getCielController = (
  cielBaseUrl,
  cielUsername,
  cielPassword,
  cielDatabase,
) => {
  const getAuthToken = async () => {
    const body = {
      Method: 'GetAuthenticationToken',
      Params: {
        UserName: cielUsername,
        Password: cielPassword,
        Database: cielDatabase,
      },
    }
    const urlEncodedString = encodeURIComponent(JSON.stringify(body))
    const url = `${cielBaseUrl}/CielServices/Services/GET/${urlEncodedString}`

    const response = await axios.get(url)
    return response.data.Result
  }

  const getAllProducts = async (authToken) => {
    const body = {
      Method: 'GetAllArticles',
      Params: {
        includeArticleWarehouseStock: 1,
        includeArticleWarehousePrice: 1,
        articleType: 3,
      },
      AuthenticationToken: authToken,
    }
    const url = `${cielBaseUrl}/CielServices/Services/GET/${JSON.stringify(
      body,
    )}`

    const response = await axios.get(url)

    return response.data.Result
  }

  const getStockProducts = async (authToken) => {
    const body = {
      Method: 'GetAllStocksForArticles',
      Params: {},
      AuthenticationToken: authToken,
    }

    const urlEncodedString = encodeURIComponent(JSON.stringify(body))
    const url = `${cielBaseUrl}/CielServices/Services/GET/${urlEncodedString}`

    const response = await axios.get(url)
    return response.data.Result
  }

  return { getAuthToken, getStockProducts, getAllProducts }
}
