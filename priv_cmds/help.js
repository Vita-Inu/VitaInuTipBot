// Shows the help menu (any way to auto-generate this?)

const CFG = require('../config.json')

module.exports = {
  command: 'help',
  execute (client, event, env) {
    client.v1.sendDm({
      recipient_id: env.senderId,
      text: `Commands:\n\n
You can use this commands on DM channel of bot.
${CFG.botPrefix}help : Shows commands
${CFG.botPrefix}deposit : Gives deposit wallet address and memo
${CFG.botPrefix}withdraw (rec.) (amo.) <token> : Withdraws assets to recipient
${CFG.botPrefix}balance(bal) <token> : Shows balance
${CFG.botPrefix}tip (@user) (amount) <token> : Tip users semi-privately
${CFG.botPrefix}statistics(stats) <token> : Shows stats
\nReply(tweet) Commands:\n\n
You can use this commands by replying tweets with mentioning bot.
${CFG.botPrefix}tip (amount) <token>
\nExample DM command: ${CFG.botPrefix}tip @TipbotVite 1 VITE
Example Reply command: @TipbotVite ${CFG.botPrefix}tip 1 VITE`
    })
  }
}
