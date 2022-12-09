function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    trySimpleReplyWhenContainsArray: async function(candArr, replyArr, message) {
        await sleep(500);
        for (let i = 0; i < candArr.length; ++i) {
            if (!message.content.includes(candArr[i])) continue;
            message.channel.sendTyping();
            setTimeout(() => {
                message.channel.send(replyArr[Math.floor(Math.random() * replyArr.length)]);
            }, 500 + Math.random() * 1500);
            return true;
        }
        return false;
    },
    trySimpleReactionWhenContainsArray: async function(candArr, reaction, message) {
        await sleep(500);
        for (let i = 0; i < candArr.length; ++i) {
            if (!message.content.includes(candArr[i])) continue;
            setTimeout(() => {
                message.react(reaction);
            }, Math.random() * 1500);
            return true;
        }
        return false;
    },
    temporaryMethodThatGetMessageByFetchingLatestChannelPost: async function(message) {
        const messages = await message.channel.messages.fetch({limit: 1});
        return [...messages][0][1];
    },
    fetchAllMessages: async function(channel) {
        let messages = [];

        let message = await channel.messages
            .fetch({ limit: 1 })
            .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));

        while (message) {
            await channel.messages
                .fetch({ limit: 100, before: message.id })
                .then(messagePage => {
                    messagePage.forEach(msg => messages.push(msg));

                    // Update our message pointer to be last message in page of messages
                    message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
                });
        }
        return messages;
    }
}
