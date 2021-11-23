const { constant } = require('@vite/vitejs')

module.exports = {
  command: 'balance',
  alias: 'bal',
  async execute (client, event, env) {
    const tokenToQuery = { name: 'VITE', id: constant.Vite_TokenId, dec: constant.Vite_Token_Info.decimals }

    if (env.args[0] && env.args[0].toUpperCase() !== 'VITE') {
      if (env.config.trusted_tokens[env.args[0].toUpperCase()]) {
        tokenToQuery.name = env.args[0].toUpperCase()
        tokenToQuery.id = env.config.trusted_tokens[env.args[0].toUpperCase()][0]
        tokenToQuery.dec = env.config.trusted_tokens[env.args[0].toUpperCase()][1]
      }
    }

    const balanceData = await env.api.callOffChainContract({ address: env.config.contractAddress, abi: getMethodAbi(env.config.contractAbi, 'getBalance'), code: Buffer.from(env.config.contractOffCBinary, 'hex').toString('base64'), params: [env.senderId, tokenToQuery.id] })

    client.v1.sendDm({
      recipient_id: env.senderId,
      text: `${tokenToQuery.name}\nBalance: ${balanceData[0] / parseFloat('1e+' + tokenToQuery.dec)}`
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
