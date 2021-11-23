module.exports = {
  command: 'help',
  execute (client, event, env) {
    client.v1.sendDm({
      recipient_id: env.senderId,
      text: `Commands:\n\n
You can use this commands on DM channel of bot.
?help : Shows commands
?deposit : Gives deposit wallet address and memo
?withdraw (rec.) (amo.) <token> : Withdraws assets to recipient
?balance(bal) <token> : Shows balance
?tip (@user) (amount) <token> : Tip users semi-privately
?statistics(stats) <token> : Shows stats
\nReply(tweet) Commands:\n\n
You can use this commands by replying tweets with mentioning bot.
?tip (amount) <token>
\nExample DM command: ?tip @TipbotVite 1 VITE
Example Reply command: @TipbotVite ?tip 1 VITE`
    })
  }
}
