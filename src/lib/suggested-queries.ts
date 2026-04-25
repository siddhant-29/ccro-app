type Preference = 'travel_hotels' | 'flights' | 'cash_value' | 'not_sure'

const CARD_QUERIES: Record<string, string[]> = {
  axis_magnus: [
    'Which card in my portfolio earns the most for dining and grocery?',
    'What is the best way to redeem Magnus EDGE Rewards points?',
    'Should I transfer Magnus points to airlines or hotel programmes?',
    'How close am I to the Magnus ₹15 lakh annual milestone?',
  ],
  hdfc_infinia: [
    'How do I maximise HDFC Infinia points on travel spends?',
    'What are the best Infinia transfer partners for hotel stays?',
    'How does the Infinia Club Marriott membership benefit work?',
    'What is the Infinia ₹5 lakh annual fee reversal milestone?',
  ],
  hdfc_diners_black: [
    'Which category earns the most points on Diners Club Black?',
    'How does the Diners Black SmartBuy 10X rewards portal work?',
    'What are the best Diners Black transfer partners for flights?',
    'How do I use Diners Black for international hotel bookings?',
  ],
  amex_platinum_travel: [
    'How do I get the best value from Amex Membership Rewards points?',
    'What are the Amex IndiGo Blu Credit benefits and how to use them?',
    'Should I transfer Amex points to airlines or redeem travel vouchers?',
    'What is the annual Amex Platinum Travel voucher benefit worth?',
  ],
  icici_emeralde: [
    'What airport lounges can I access with ICICI Emeralde?',
    'Which spend categories earn the most on Emeralde?',
    'How do I redeem ICICI Emeralde reward points for maximum value?',
    'What are the Emeralde annual milestone benefits?',
  ],
  axis_reserve: [
    'How do Reserve EDGE Rewards compare to Magnus points in value?',
    'What are the best Axis Reserve transfer partner options?',
    'What premium lounge and concierge benefits come with Reserve?',
    'Should I concentrate spend on Magnus or Reserve for better rewards?',
  ],
  amex_gold: [
    'How do I transfer Amex Gold points to airline miles?',
    'What are the best Amex Gold Membership Rewards redemptions?',
    'How does Amex Gold compare to my other cards for everyday spend?',
    'Is it worth upgrading from Amex Gold to Platinum Travel?',
  ],
  sbi_elite: [
    'What spend categories earn the most rewards on SBI Card Elite?',
    'How do I redeem SBI Elite reward points for maximum value?',
    'What airport lounge access does SBI Elite provide?',
    'How does SBI Elite compare to my other cards for travel spend?',
  ],
}

const PREFERENCE_QUERIES: Record<Preference, string[]> = {
  travel_hotels: [
    'Which of my cards gives the best value for hotel bookings?',
    'How do I transfer points to Marriott Bonvoy or Taj InnerCircle?',
    'What is the cheapest way to book a 5-star stay using my points?',
  ],
  flights: [
    'Which of my cards transfers best to IndiGo, Air India, or Vistara?',
    'How do I book business class using points from my portfolio?',
    'What is the best strategy to accumulate airline miles quickly?',
  ],
  cash_value: [
    'Which of my cards has the best effective cashback rate?',
    'How do I maximise the rupee value of my reward points?',
    'Which redemption option gives me the highest cash-equivalent value?',
  ],
  not_sure: [
    'Which of my cards should I use for everyday spending?',
    'What is the easiest way to start redeeming my points?',
    'Which of my cards gives the best overall value?',
  ],
}

const GENERIC_QUERIES = [
  'Which card in my portfolio should I use for my next big purchase?',
  'How do I maximise the value of my reward points?',
  'What is the best redemption option for flights or hotels?',
]

export function getSuggestedQueries(
  cardIds: string[],
  preference?: Preference | null
): string[] {
  const suggestions: string[] = []

  for (const cardId of cardIds) {
    const queries = CARD_QUERIES[cardId]
    if (queries) {
      suggestions.push(queries[0])
      if (suggestions.length < 2 && queries[1]) suggestions.push(queries[1])
      break
    }
  }

  if (preference && preference !== 'not_sure' && suggestions.length < 3) {
    for (const q of PREFERENCE_QUERIES[preference]) {
      if (!suggestions.includes(q)) {
        suggestions.push(q)
        if (suggestions.length >= 3) break
      }
    }
  }

  for (const q of GENERIC_QUERIES) {
    if (suggestions.length >= 3) break
    if (!suggestions.includes(q)) suggestions.push(q)
  }

  return suggestions.slice(0, 3)
}
