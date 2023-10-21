export function calculatePriceWithVAT(priceExcludingVAT, vatRate) {
  var vatAmount = priceExcludingVAT * (vatRate / 100)
  var priceIncludingVAT = priceExcludingVAT + vatAmount
  return Math.round(priceIncludingVAT)
}
