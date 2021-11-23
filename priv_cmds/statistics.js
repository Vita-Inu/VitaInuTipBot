const { constant } = require('@vite/vitejs')

module.exports = {
  command: 'statistics',
  alias: 'stats',
  async execute (client, event, env) {
    const tokenToQuery = { name: 'VITE', id: constant.Vite_TokenId, dec: constant.Vite_Token_Info.decimals }

    if (env.args[0] && env.args[0].toUpperCase() !== 'VITE') {
      if (env.config.trusted_tokens[env.args[0].toUpperCase()]) {
        tokenToQuery.name = env.args[0].toUpperCase()
        tokenToQuery.id = env.config.trusted_tokens[env.args[0].toUpperCase()][0]
        tokenToQuery.dec = env.config.trusted_tokens[env.args[0].toUpperCase()][1]
      }
    }

    await client.v1.indicateDmTyping(env.senderId)

    const getTotalTipCountAbi = getMethodAbi(env.config.contractAbi, 'getTotalTipCountOfUser')
    const getTotalTipsAbi = getMethodAbi(env.config.contractAbi, 'getTotalTipsOfUser')
    const getTotalWithdrawAbi = getMethodAbi(env.config.contractAbi, 'getTotalWithdrawsOfUser')
    const getTotalDepositAbi = getMethodAbi(env.config.contractAbi, 'getTotalDepositsOfUser')

    const TotalTipCount = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getTotalTipCountAbi, code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId] })
    const TotalTips = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getTotalTipsAbi, code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId, tokenToQuery.id] })
    const TotalWithdraw = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getTotalWithdrawAbi, code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId, tokenToQuery.id] })
    const TotalDeposit = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getTotalDepositAbi, code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId, tokenToQuery.id] })

    client.v1.sendDm({
      recipient_id: env.senderId,
      text: `Your statistics:\nTotal deposit ${TotalDeposit[0] / parseFloat('1e+' + tokenToQuery.dec)} ${tokenToQuery.name}.\nTotal withdraw ${TotalWithdraw[0] / parseFloat('1e+' + tokenToQuery.dec)} ${tokenToQuery.name}.\nTotal tip ${TotalTips[0] / parseFloat('1e+' + tokenToQuery.dec)} ${tokenToQuery.name}.\nTotal tip count ${TotalTipCount[0]}.`
    })
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
