const { constant, accountBlock } = require('@vite/vitejs')

module.exports = {
  command: 'withdraw',
  async execute (client, event, env) {
    try {
      if (!env.args[0] || !env.args[1]) {
        return client.v1.sendDm({
          recipient_id: env.senderId,
          text: `Usage: withdraw (receipt) (amount|all) <token>\nExample: ?withdraw ${env.wallet.address} 1 VITE`
        })
      }

      const tokenToWithdraw = { name: 'VITE', id: constant.Vite_TokenId, dec: constant.Vite_Token_Info.decimals }

      if (env.args[2]) {
        if (env.config.trusted_tokens[env.args[2].toUpperCase()]) {
          tokenToWithdraw.name = env.args[2].toUpperCase()
          tokenToWithdraw.id = env.config.trusted_tokens[env.args[2].toUpperCase()][0]
          tokenToWithdraw.dec = env.config.trusted_tokens[env.args[2].toUpperCase()][1]
        }
      }

      let withdrawAmount = parseFloat(env.args[1]).toFixed(tokenToWithdraw.dec) * parseFloat('1e+' + tokenToWithdraw.dec)

      if (env.args[1].toUpperCase() === 'ALL') {
        const balanceData = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getMethodAbi(env.config.contractAbi, 'getBalance'), code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId, tokenToWithdraw.id] })
        withdrawAmount = balanceData[0]
      }

      await client.v1.indicateDmTyping(env.senderId)

      const sBlock = accountBlock.createAccountBlock('callContract', {
        address: env.wallet.address,
        abi: env.config.contractAbi,
        methodName: 'withdraw',
        toAddress: env.config.contractAddress,
        params: [env.senderId, env.args[0], tokenToWithdraw.id, withdrawAmount.toString()]
      }).setProvider(env.api).setPrivateKey(env.wallet.privateKey)

      await sBlock.autoSetPreviousAccountBlock()
      await sBlock.sign().send()

      const checker = setInterval(async () => {
        const checkBlock = await env.api.request('ledger_getAccountBlockByHash', sBlock.hash)

        if (checkBlock.receiveBlockHash) {
          clearInterval(checker)

          const lastBlock = await env.api.request('ledger_getAccountBlockByHash', checkBlock.receiveBlockHash)

          if ([...lastBlock.data][43] === 'A') {
            client.v1.sendDm({
              recipient_id: env.senderId,
              text: `Withdraw success!\nSended ${withdrawAmount / parseFloat('1e+' + tokenToWithdraw.dec)} ${tokenToWithdraw.name} to ${env.args[0]}.`
            })
          } else {
            client.v1.sendDm({
              recipient_id: env.senderId,
              text: 'Withdraw failed!\nCheck your balance.'
            })
          }
        }
      }, 700)
    } catch (err) {
      client.v1.sendDm({
        recipient_id: env.senderId,
        text: `Withdraw failed!\nReason: ${err.message}`
      })
    }
  }
}

function getMethodAbi (contractAbi, methodName) {
  for (let i = 0; i < contractAbi.length; i++) {
    const abi = contractAbi[i]
    if (abi.name === methodName) {
      return abi
    }
  }
  throw new Error('No such method: ' + methodName)
}
