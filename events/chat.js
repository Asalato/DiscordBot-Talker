const TokenStore = require("../tokenStore");

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (!message.mentions.has(client.user)) return false;
        await message.channel.sendTyping();

        const messages = message.channel.messages;
        let lastId = message.id;
        while(true) {
            const reference = (await messages.fetch(lastId)).reference;
            if (!reference) break;
            lastId = reference.messageId;
        }

        const sessionToken = await TokenStore.getSessionToken();
        if (!sessionToken) {
            await message.reply("SessionTokenが登録されていません。`/set ${SessionToken}`コマンドで登録してください");
            return;
        }

        const {ChatGPTAPI} = await import("chatgpt");
        const api = new ChatGPTAPI({sessionToken: sessionToken});
        if (!await api.getIsAuthenticated()) {
            await message.reply("認証に失敗しました。再度`/set ${SessionID}`コマンドで登録してください");
            return;
        }

        const conversationId = await TokenStore.getConversationId(lastId);
        const conversation = api.getConversation({conversationId: conversationId});
        await TokenStore.setConversationId(lastId, conversation.conversationId);

        const typing = setInterval(async () => {
            await message.channel.sendTyping();
        }, 8 * 1000);

        conversation.sendMessage(message.content).then(async reply => {
            clearInterval(typing);
            if (reply) {
                await message.reply(reply);
            } else {
                await message.reply("```diff\n-何らの問題が発生しました。\n```");
            }
        })
    },
};
