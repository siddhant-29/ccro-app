const QUESTION_POOL = (cards: { id: string; name: string }[], _pref: string | null): string[] => {
  const primary = cards[0]?.name ?? 'my card'
  const secondary = cards[1]?.name ?? null

  const travel = [
    `✈️ I'm flying to Bangkok — which of my cards gives maximum savings?`,
    `✈️ Planning a trip to Singapore. Which card should I use for flights and hotels?`,
    `✈️ Which of my cards has the lowest forex charges for international travel?`,
    `✈️ Best card to book flights on for maximum reward points?`,
  ]

  const dining = [
    `🍽️ Which of my cards gives the best earn rate on dining out?`,
    `🍽️ Which card should I use at restaurants and cafes?`,
    `🍽️ Best card for grocery and dining spends this month?`,
  ]

  const redemption = [
    `🎯 What is the best way to use my ${primary} points for a hotel stay?`,
    `🎯 How should I redeem my ${primary} points for maximum value?`,
    `🎯 What can I do with ${primary} points — hotels or flights?`,
  ]

  const lounge = [
    `🛋️ Which of my cards gives unlimited airport lounge access?`,
    `🛋️ How many lounge visits do I get with my cards this year?`,
  ]

  const milestone = [
    `🏆 What are the milestone benefits on my ${primary}?`,
    `🏆 How close am I to the next spend milestone on ${primary}?`,
  ]

  const cashback = [
    `💳 Which of my cards gives best cashback on online shopping?`,
    `💳 Which card should I use for UPI payments?`,
    `💳 Best card for everyday spends this month?`,
  ]

  const multiCard = secondary
    ? [
        `💡 Should I use ${primary} or ${secondary} for a hotel booking in India?`,
        `💡 I have points on both ${primary} and ${secondary}. What's the best combined strategy?`,
      ]
    : []

  return [...travel, ...dining, ...redemption, ...lounge, ...milestone, ...cashback, ...multiCard]
}

export function getDynamicHomeQuestions(
  cards: { id: string; name: string }[],
  preference: string | null
): string[] {
  const pool = QUESTION_POOL(cards, preference)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 6)
}
