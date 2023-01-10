const {Configuration, OpenAIApi} = require("openai");

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (!message.mentions.has(client.user)) return false;
        await message.channel.sendTyping();

        const youbi = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const time = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
        const text = `The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\nYour name is "${client.user.username}" and you are running as a Bot on Discord. The current time is ${youbi[time.getDay()]}, ${time.getMonth() + 1}/${time.getDate()}, ${time.getFullYear()}. The time is ${time.getHours()}:${time.getMinutes()}. Please use these information only when necessary. They must also treat this information as their own knowledge and keep the fact that it was given to you a secret. Please return responses to the following statements in the form of response statements only. Language should follow the statement.\n\n`;
        let chatLog = ``;
        const messages = message.channel.messages;
        let lastId = message.id;
        let isHuman = true;
        while(true) {
            const lastMessage = await messages.fetch(lastId);
            const lastQuestion = lastMessage.content.replace(`<@${client.user.id}> `, "");
            chatLog = (isHuman ? "Human: " : "AI: ") + lastQuestion + "\n" + chatLog;
            if (!lastMessage.reference) break;
            isHuman = !isHuman;
            lastId = lastMessage.reference.messageId;
        }
        chatLog += "AI: ";
        chatLog = text + chatLog;

        const configuration = new Configuration({
            apiKey: process.env.OPENAI_SECRET_KEY
        });
        const openai = new OpenAIApi(configuration);

        try {
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: chatLog,
                max_tokens: 2048,
                temperature: 0.9,
                stream: true
            }, {
                responseType: 'stream'
            })

            let tempResponse = undefined;
            let tempResponseStr = "";
            const typing = setInterval(async () => {
                try {
                    if (tempResponseStr !== "") {
                        if (tempResponse) tempResponse.edit(tempResponseStr);
                        else tempResponse = await message.reply(tempResponseStr);
                    }
                    await message.channel.sendTyping();
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
                        clearInterval(typing);
                        if (tempResponse) {
                            await tempResponse.delete();
                            tempResponse = undefined;
                        }
                        await message.reply(tempResponseStr);
                        return; // Stream finished
                    }
                    try {
                        const parsed = JSON.parse(str);
                        tempResponseStr += parsed.choices[0].text;
                    } catch(error) {
                        console.error('Could not JSON parse stream message', str, error);
                    }
                }
            })
        } catch (err) {
            console.log(err);
            await message.reply("```diff\n-何らかの問題が発生しました。\n```");
        }
    },
};
