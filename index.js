const { ViteAPI, accountBlock, wallet } = require('@vite/vitejs')
const { WS_RPC } = require('@vite/vitejs-ws')

const { Autohook } = require('twitter-autohook')
const { TwitterApi, ETwitterStreamEvent } = require('twitter-api-v2')

const { RateLimiterMemory } = require('rate-limiter-flexible')

const CFG = require('./config.json')
const fs = require('fs')

const myAccount = wallet.getWallet(CFG.wallet_mnemonics).deriveAddress(0)

const privateCommands = new Map()
const tweetReplyCommands = new Map()

const privCommands = fs.readdirSync('./priv_cmds').filter(file => file.endsWith('.js'))
const tweetCommands = fs.readdirSync('./tweet_cmds').filter(file => file.endsWith('.js'))

for (const file of privCommands) {
  const command = require(`./priv_cmds/${file}`)
  privateCommands.set(command.command, command)
  if (command.alias) { privateCommands.set(command.alias, command) }
}

for (const file of tweetCommands) {
  const command = require(`./tweet_cmds/${file}`)
  tweetReplyCommands.set(command.command, command)
  if (command.alias) { tweetReplyCommands.set(command.alias, command) }
}

const api = new ViteAPI(new WS_RPC(CFG.vite_node_WS, 6e5, {
  clientConfig: '',
  headers: '',
  protocol: '',
  retryTimes: Infinity,
  retryInterval: 10000
}), async () => {
  const userClient = new TwitterApi({
    appKey: CFG.consumer_key,
    appSecret: CFG.consumer_secret,
    accessToken: CFG.access_token,
    accessSecret: CFG.access_secret
  })

  const account = await userClient.v1.verifyCredentials()

  const streamApi = new TwitterApi(CFG.bearer_token)

  const rules = await streamApi.v2.streamRules()

  if (rules.data?.length) {
    await streamApi.v2.updateStreamRules({
      delete: {
        ids: rules.data.map(rule => rule.id)
      }
    })
    console.log('Deleted rules.')
  }

  await streamApi.v2.updateStreamRules({
    add: [
      { value: `@${account.screen_name}`, tag: 'mention' }
    ]
  })
  console.log('Added rules.')

  const stream = await streamApi.v2.searchStream({ expansions: 'author_id' })
  console.log('Stream is ready.')

  stream.on(ETwitterStreamEvent.Data, data => {
    const tweet = data.data.text.split(CFG.botPrefix)[1]
    const args = tweet.trim().split(/ +/)
    const command = args.shift().toLowerCase()
    const tweetId = data.data.id

    if (!tweetReplyCommands.has(command)) return

    tweetReplyCommands.get(command).execute(userClient, { tweetId: tweetId, wallet: myAccount, api: api, config: CFG, args: args })
  })

  const webhook = new Autohook({
    token: CFG.access_token,
    token_secret: CFG.access_secret,
    consumer_key: CFG.consumer_key,
    consumer_secret: CFG.consumer_secret,
    ngrok_secret: CFG.ngrok_authToken,
    env: 'prod',
    port: 1337
  })

  await webhook.removeWebhooks()

  const rateLimiter = new RateLimiterMemory({
    points: 1,
    duration: 2
  })

  webhook.on('event', async event => {
    if (!event.direct_message_events) return
    const message = event.direct_message_events.shift()

    if (message.message_create.sender_id === await userClient.currentUser().id_str) return
    if (typeof message === 'undefined' || typeof message.message_create === 'undefined') return
    if (message.message_create.sender_id === message.message_create.target.recipient_id) return
    if (event.users[message.message_create.sender_id].id === account.id_str) return

    await userClient.v1.markDmAsRead(message.id, message.message_create.sender_id)

    rateLimiter.consume(message.message_create.sender_id).then(() => {
      if (!message.message_create.message_data.text.startsWith(CFG.botPrefix)) return userClient.v1.sendDm({ recipient_id: message.message_create.sender_id, text: `Hey, prefix is ${CFG.botPrefix}\nUse ${CFG.botPrefix}help for more information :)` })

      const args = message.message_create.message_data.text.slice(1).trim().split(/ +/)
      const command = args.shift().replace(CFG.botPrefix, '').toLowerCase()

      if (!privateCommands.has(command)) return userClient.v1.sendDm({ recipient_id: message.message_create.sender_id, text: 'Command not found!?' })
      privateCommands.get(command).execute(userClient, event, { wallet: myAccount, api: api, senderId: message.message_create.sender_id, config: CFG, args })
    }).catch(() => { })
  })

  await webhook.start()
  await webhook.subscribe({ oauth_token: CFG.access_token, oauth_token_secret: CFG.access_secret })

  const depositListener = await api.subscribe('createAccountBlockSubscription')

  depositListener.on(async result => {
    const block = await api.request('ledger_getAccountBlockByHash', result[0].hash)

    if (block?.toAddress !== myAccount.address) return
    if (block.blockType !== 2) return

    const receiveBlock = accountBlock.createAccountBlock('receive', {
      address: myAccount.address,
      sendBlockHash: result[0].hash
    }).setProvider(api).setPrivateKey(myAccount.privateKey)

    await receiveBlock.autoSetPreviousAccountBlock()
    await receiveBlock.sign().send()

    if (Object.values(CFG.trusted_tokens).some(r => r.includes(block.tokenInfo.tokenId)) || !block.data === null) {
      const memo = Buffer.from(block.data, 'base64').toString('utf8')

      const depositBlock = accountBlock.createAccountBlock('callContract', {
        address: myAccount.address,
        abi: CFG.contractAbi,
        methodName: 'deposit',
        amount: block.amount,
        tokenId: block.tokenInfo.tokenId,
        toAddress: CFG.contractAddress,
        params: [memo]
      }).setProvider(api).setPrivateKey(myAccount.privateKey)

      await depositBlock.autoSetPreviousAccountBlock()
      await depositBlock.sign().send()

      userClient.v1.sendDm({ recipient_id: memo, text: `Deposit received!:\n${parseInt(block.amount) / parseFloat('1e+' + block.tokenInfo.decimals)} ${block.tokenInfo.tokenSymbol}` })
    } else {
      const refundBlock = accountBlock.createAccountBlock('send', {
        address: myAccount.address,
        amount: block.amount,
        tokenId: block.tokenInfo.tokenId,
        toAddress: block.fromAddress
      }).setProvider(api).setPrivateKey(myAccount.privateKey)

      await refundBlock.autoSetPreviousAccountBlock()
      await refundBlock.sign().send()
    }
  })

  console.log('Bot started successfully!')
})
