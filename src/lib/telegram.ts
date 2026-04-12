// Flat re-export — import from here for clean paths in route handlers.
export { sendMessage, sendChunks, sendTyping, setWebhook } from './telegram/bot'
export { handleStart, handleHelp, handleCards } from './telegram/commands'
