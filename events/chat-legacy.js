const ky = require("ky-universal");

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (!message.mentions.has(client.user)) return false;
        await message.channel.sendTyping();

        let chatLog = "";
        const messages = message.channel.messages;
        let lastId = message.id;
        let isHuman = true;
        while(true) {
            const lastMessage = await messages.fetch(lastId);
            const lastQuestion = lastMessage.content.replace(`<@${client.user.id}>`, "");
            chatLog = (isHuman ? "Human: " : "AI: ") + lastQuestion + "\n" + chatLog;
            if (!lastMessage.reference) break;
            isHuman = !isHuman;
            lastId = lastMessage.reference.messageId;
        }
        chatLog = chatLog + "AI: ";

        const url = 'https://api.openai.com/v1/engines/davinci/completions';
        const params = {
            "prompt": chatLog,
            "max_tokens": 160,
            "temperature": 0.7,
            "frequency_penalty": 0.5,
            "stop": "\nHuman"
        };
        const headers = {
            'Authorization': `Bearer ${process.env.OPENAI_SECRET_KEY}`,
        };

        try {
            const response = await ky.post(url, { json: params, headers: headers }).json();
            const output = response.choices[0].text;

            await message.reply(output);
        } catch (err) {
            console.log(err);
            await message.reply("```diff\n-何らの問題が発生しました。\n```");
        }
    },
};
