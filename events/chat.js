const {Configuration, OpenAIApi} = require("openai");

function replaceMentionsWithUsernames(message) {
    const mentions = message.mentions;
    let content = message.content;

    mentions.members.forEach((member) => {
        const mention = `<@!${member.id}>`;
        const username = member.displayName;
        const replacement = `${username}へ:`;
        content = content.replace(mention, replacement);
    });

    mentions.roles.forEach((role) => {
        const mention = `<@&${role.id}>`;
        const roleName = role.name;
        const replacement = `${roleName}へ:`;
        content = content.replace(mention, replacement);
    });

    mentions.users.forEach((user) => {
        const mention = `<@${user.id}>`;
        const username = user.username;
        const replacement = `${username}へ: `;
        content = content.replace(mention, replacement);
    });

    return content;
}

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (!message.mentions.has(client.user)) return false;
        await message.channel.sendTyping();

        let dialog = [];
        const youbi = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const time = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
        const text = `The following is a conversation with an AI assistant (you). The assistant is helpful, creative, clever, and very friendly.\nYour name is "${client.user.username}" and you are running as a Bot on Discord. The current time is ${youbi[time.getDay()]}, ${time.getMonth() + 1}/${time.getDate()}, ${time.getFullYear()}. The time is ${time.getHours()}:${time.getMinutes()}. Please use these information only when necessary. They must also treat this information as their own knowledge and keep the fact that it was given to you a secret. Please return responses to the following statements in the form of response statements only. Language should follow the statement. Response is presented in markdown format`;
        dialog.push({role: "system", content: text});

        const messages = message.channel.messages;
        let lastId = message.id;
        let isHuman = true;
        while(true) {
            const lastMessage = await messages.fetch(lastId);
            const lastQuestion = replaceMentionsWithUsernames(lastMessage);
            console.log(lastQuestion)
            const isBot = lastMessage.author.username === client.user.username;
            dialog.splice(1, 0, {role: isBot ? "assistant" : "user", content: lastQuestion/*, name: lastMessage.author.username*/});
            if (!lastMessage.reference || dialog.length > 6) break;
            isHuman = !isHuman;
            lastId = lastMessage.reference.messageId;
        }

        const configuration = new Configuration({
            apiKey: process.env.OPENAI_SECRET_KEY
        });
        const openai = new OpenAIApi(configuration);

        try {
            /*const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: dialog,
                max_tokens: 2048,
                temperature: 0.2,
                stream: true,
                user: message.author.id
            }, {
                responseType: 'stream'
            })

            let tempResponse = undefined;
            let tempResponseStr = "";
            let isEnd = false;
            let errorStr = undefined;
            const typing = setInterval(async () => {
                try {
                    if (errorStr) {
                        clearInterval(typing);
                        if (tempResponse) {
                            await tempResponse.delete();
                            tempResponse = undefined;
                        }
                        await message.reply("```diff\n-" + errorStr + "。\n```");
                    } else if (isEnd) {
                        clearInterval(typing);
                        if (tempResponse) {
                            await tempResponse.delete();
                            tempResponse = undefined;
                        }
                        await message.reply(tempResponseStr);
                    } else {
                        if (tempResponseStr !== "") {
                            if (tempResponse) tempResponse.edit(tempResponseStr);
                            else tempResponse = await message.reply(tempResponseStr);
                        }
                        await message.channel.sendTyping();
                    }
                } catch(error) {
                    console.error(error);
                    clearInterval(typing);
                    if (tempResponse) {
                        await tempResponse.delete();
                        tempResponse = undefined;
                    }
                    await message.reply("```diff\n-何らかの問題が発生しました。\n```");
                }
            }, 1000);

            completion.data.on('data', async data => {
                const lines = data.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    const str = line.replace(/^data: /, '');
                    if (str === '[DONE]') {
                        isEnd = true;
                        return; // Stream finished
                    }
                    try {
                        const parsed = JSON.parse(str);
                        tempResponseStr += parsed.choices[0].text;
                    } catch(error) {
                        errorStr = 'Could not JSON parse stream message' + str + error;
                        console.error('Could not JSON parse stream message', str, error);
                        return;
                    }
                }
            })*/

            const typing = setInterval(async () => {
                await message.channel.sendTyping();
            }, 1000);

            openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: dialog,
                max_tokens: 2048,
                temperature: 0.2,
                user: message.author.id
            }).then(async (res) => {
                clearInterval(typing);
                await message.reply(res.data.choices[0].message.content);
            }).catch(async (error) => {
                clearInterval(typing);
                console.error(error);
                await message.reply(`\`\`\`diff\n-何らかの問題が発生しました。\n${error.toString()}\n\`\`\``);
            });

        } catch (err) {
            console.log(err);
            await message.reply("```diff\n-何らかの問題が発生しました。\n```");
        }
    },
};
