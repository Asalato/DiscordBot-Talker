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
        await api.ensureAuth();

        const conversationId = await TokenStore.getConversationId(lastId);
        const parentMessageId = await TokenStore.getParentMessageId(lastId);

        const typing = setInterval(async () => {
            await message.channel.sendTyping();
        }, 8 * 1000);

        let opts = {
            onConversationResponse: async response => {
                let _a;
                if (response.conversation_id) {
                    await TokenStore.setConversationId(lastId, response.conversation_id);
                }
                if ((_a = response.message) == null ? void 0 : _a.id) {
                    await TokenStore.setParentMessageId(lastId, response.message.id);
                }
            }
        }
        if (conversationId) opts["conversationId"] = conversationId;
        if (parentMessageId) opts["parentMessageId"] = parentMessageId;

        try {
            const reply = await api.sendMessage(message.content, opts);
            clearInterval(typing);

            if (reply) {
                await message.reply(reply);
            } else {
                await message.reply("```diff\n-何らの問題が発生しました。\n```");
            }
        } catch(error) {
            console.error(error);
            await message.reply("```diff\n-何らの問題が発生しました。\n```");
        }
    },
};
