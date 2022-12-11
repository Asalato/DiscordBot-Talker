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
        const isFirstMessage = message.id === lastId;

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

        let tempResponse = undefined;
        let tempResponseStr = undefined;
        let opts = {
            onConversationResponse: async res => {
                let _a;
                if (res.conversation_id) {
                    await TokenStore.setConversationId(lastId, res.conversation_id);
                }
                if ((_a = res.message) == null ? void 0 : _a.id) {
                    await TokenStore.setParentMessageId(lastId, res.message.id);
                }
            },
            onProgress: async text => {
                tempResponseStr = text;
            }
        }
        if (conversationId) opts["conversationId"] = conversationId;
        if (parentMessageId) opts["parentMessageId"] = parentMessageId;

        const typing = setInterval(async () => {
            try {
                if (tempResponseStr) {
                    if (tempResponse) tempResponse.edit(tempResponseStr);
                    else tempResponse = await message.reply(tempResponseStr);
                }
                await message.channel.sendTyping();
            } catch(error) {
                console.error(error);
                clearInterval(typing);
                if (tempResponse) await tempResponse.delete();
                await message.reply("```diff\n-何らの問題が発生しました。\n```");
            }
        }, 1500);

        try {
            let text = message.content;
            if (isFirstMessage) text = `Your name is "${client.user.username}" and you are running as a Bot on Discord. Please use this information only when necessary. Please return responses to the following statements in the form of response statements only. ` + text;
            const reply = await api.sendMessage(text, opts);
            clearInterval(typing);

            if (reply) {
                if (tempResponse) await tempResponse.delete();
                await message.reply(reply);
            } else {
                if (tempResponse) await tempResponse.delete();
                await message.reply("```diff\n-何らの問題が発生しました。\n```");
            }
        } catch(error) {
            console.error(error);
            clearInterval(typing);
            if (tempResponse) await tempResponse.delete();
            await message.reply("```diff\n-何らの問題が発生しました。\n```");
        }
    },
};
