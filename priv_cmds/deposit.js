module.exports = {
  command: 'deposit',
  execute (client, event, env) {
    client.v1.sendDm({
      recipient_id: env.senderId,
      text: `Deposit Address:\n${env.wallet.address}\nMemo: ${env.senderId}`
    })
  }
}
