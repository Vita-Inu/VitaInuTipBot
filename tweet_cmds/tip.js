const { constant, accountBlock } = require('@vite/vitejs')
const fromExponential = require('from-exponential')

module.exports = {
  command: 'tip',
  async execute (client, env) {
    if (!env.args[0]) return client.v1.reply('Usage: ?tip (amount) <token>', env.tweetId)

    const tokenToTip = { symbol: constant.Vite_Token_Info.tokenSymbol, id: constant.Vite_TokenId, dec: constant.Vite_Token_Info.decimals }

    if (env.args[1] && env.args[1].toUpperCase() !== 'VITE') {
      if (env.config.trusted_tokens[env.args[1].toUpperCase()]) {
        tokenToTip.symbol = env.args[1].toUpperCase()
        tokenToTip.id = env.config.trusted_tokens[env.args[1].toUpperCase()][0]
        tokenToTip.dec = env.config.trusted_tokens[env.args[1].toUpperCase()][1]
      }
    }

    const tipAmount = parseFloat(env.args[0]).toFixed(tokenToTip.dec) * parseFloat('1e+' + tokenToTip.dec)

    if (Math.sign(tipAmount) !== 1) return client.v1.reply('Tip failed!\n\nYou should tip greater than zero.', env.tweetId)

    client.v2.tweets(env.tweetId, { expansions: 'in_reply_to_user_id', 'tweet.fields': 'author_id' }).then(async data => {
      if (!data.data[0].in_reply_to_user_id) {
        return client.v1.sendDm({
          recipient_id: env.senderId,
          text: 'You should reply to an user for sending tips!'
        })
      }

      const tipBlock = accountBlock.createAccountBlock('callContract', {
        address: env.wallet.address,
        abi: env.config.contractAbi,
        methodName: 'tip',
        toAddress: env.config.contractAddress,
        params: [data.data[0].author_id, data.data[0].in_reply_to_user_id, tokenToTip.id, fromExponential(tipAmount)]
      }).setProvider(env.api).setPrivateKey(env.wallet.privateKey)

      await tipBlock.autoSetPreviousAccountBlock()
      await tipBlock.sign().send()

      const checker = setInterval(async () => {
        const checkBlock = await env.api.request('ledger_getAccountBlockByHash', tipBlock.hash)

        if (checkBlock.receiveBlockHash) {
          clearInterval(checker)

          const lastBlock = await env.api.request('ledger_getAccountBlockByHash', checkBlock.receiveBlockHash)

          if ([...lastBlock.data][43] === 'A') {
            client.v2.user(data.data[0].in_reply_to_user_id).then(user => {
              client.v1.reply(`Tip success!\n\nTipped ${tipAmount / parseFloat(`1e+${tokenToTip.dec}`)} ${tokenToTip.symbol} to ${user.data.username}.`, env.tweetId)
            })
          } else {
            client.v1.reply('Tip failed!\n\nCheck your balance.', env.tweetId)
          }
        }
      }, 700)
    })
  }
}
