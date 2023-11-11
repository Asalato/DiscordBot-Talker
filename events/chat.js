const OpenAIApi = require("openai");
const {extractCommands, containsCommand, sendHelpText, isMentioned, replaceMentionsWithUsernames, splitText,
    getFileText
} = require("../utils");

const rev = "v2.1.0";
const isDev = false;

const GPT3_MODEL_NAME = "gpt-3.5-turbo-1106";
const GPT4_MODEL_NAME = "gpt-4-vision-preview";

let max_token_length = {}
max_token_length[GPT3_MODEL_NAME] = 4096;
max_token_length[GPT4_MODEL_NAME] = 4096;

const commandList = [
    {
        command: "!init",
        description: "最初のシステムメッセージをこのテキストに置き換えます。",
        optionDescription: "システムメッセージ、ダブルクオーテーションで囲んでもよい任意のテキスト。",
        hasOption: true
    },
    {
        command: "!noreply",
        description: "このコマンドが指定されたメッセージへの直接のリプライは行われません。（メッセージへのリプライでは読まれます。initを指定する際に利用ください。）",
        hasOption: false
    },
    {
        command: "!mode",
        description: "呼び出しモードを指定します。",
        options: [
            {
                name: "stream",
                description: "メッセージをストリームとして返却します（β）。"
            },
            {
                name: "gpt4",
                description: `GPT-4モデルを利用します。現在のモデルは[${GPT4_MODEL_NAME}](https://platform.openai.com/docs/models/gpt-4-and-gpt-4-turbo)です。`
            },
            {
                name: "gpt3",
                description: `GPT-3モデルを利用します（デフォルト）。現在のモデルは[${GPT3_MODEL_NAME}](https://platform.openai.com/docs/models/gpt-3-5)です。`
            }
        ],
        hasOption: true
    },
    {
        command: "!dev",
        description: "デベロッパーチャンネルへ送信します（検証用）。",
        hasOption: false
    },
    {
        command: "!help",
        description: "ヘルプメニューを表示します（これ）。",
        hasOption: false
    },
    {
        command: "!version",
        description: "バージョンのみを返します。",
        hasOption: false
    }
];

const releaseNote = `
v2.0.0  gpt4-visionに対応し、画像の読み込みが可能になりました
v2.1.0  テキストファイルの読み込みに対応しました。
`;

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.mentions.users.size > 0 && !message.mentions.has(client.user)) return false;

        const messages = message.channel.messages;
        let lastId = message.id;
        while(true) {
            const lastMessage = await messages.fetch(lastId);
            if (lastMessage.mentions.has(client.user)) break;
            if (!lastMessage.reference) return false;
            lastId = lastMessage.reference.messageId;
        }

        const currentCommands = extractCommands(commandList, message);
        if (isDev) console.log(currentCommands);

        let isModeDiff = containsCommand(currentCommands,"!dev") !== isDev;
        let isStream = containsCommand(currentCommands,"!mode", "stream");

        if (containsCommand(currentCommands,"!noreply")) {
            return;
        }

        if (containsCommand(currentCommands,"!version")) {
            await message.reply(rev);
            return;
        }

        if (!isModeDiff && (containsCommand(currentCommands,"!help") || currentCommands.message.replace(/\s/, "") === "")) {
            await sendHelpText(rev, isDev, commandList, client, message, releaseNote);
            return;
        }

        let dialog = [];
        const youbi = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const time = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
        const initText = `The following is a conversation with an AI assistant (you). The assistant is helpful, creative, clever, and very friendly.\nYour name is "${client.user.username}" and you are running as a Bot on Discord. The current time is ${youbi[time.getDay()]}, ${time.getMonth() + 1}/${time.getDate()}, ${time.getFullYear()}. The time is ${time.getHours()}:${time.getMinutes()}. Response is presented in markdown format`;
        dialog.push({role: "system", content: initText});

        let modelMode = GPT3_MODEL_NAME;
        lastId = message.id;
        let isBotMentioned = isMentioned(client, message);
        let isImageAttached = false;
        while(true) {
            const lastMessage = await messages.fetch(lastId);

            // 最後にメンションされた対象が全体メンションで、かつ直接のメンションがない場合は返信しない
            if (isMentioned(client, lastMessage)) isBotMentioned = true;

            const commands = extractCommands(commandList, lastMessage);
            if (containsCommand(commands, "!dev") === isDev) isModeDiff = false;

            const initMsg = commands.commands.filter(c => c.command === "!init");
            if (initMsg.length !== 0) dialog[0].content = initMsg[0].parameter.replace("\"", "");

            if (containsCommand(commands, "!mode")) {
                const parameter = commands.commands.filter(c => c.command === "!mode")[0].parameter;
                if (parameter === "gpt4" || isImageAttached) modelMode = GPT4_MODEL_NAME;
                else if (parameter === "gpt3") modelMode = GPT3_MODEL_NAME;
            }

            const questionStr = replaceMentionsWithUsernames(lastMessage.mentions, commands.message);
            let content = questionStr !== "" ? [{type: "text", text: questionStr}] : [];

            const files = [];
            if (lastMessage.attachments.size > 0) {
                isImageAttached = true;
                modelMode = GPT4_MODEL_NAME;
                let attachment_urls = [...lastMessage.attachments.values()].map(x => x.url);
                for (let i = 0; i < attachment_urls.length; ++i) {
                    const pathname = new URL(attachment_urls[i]).pathname;
                    if (['png', 'jpeg', 'gif', 'webp'].some(c => pathname.endsWith(c)))
                        content.push({type: "image_url", image_url: attachment_urls[i]});
                    else {
                        const fileText = await getFileText(attachment_urls[i]);
                        if (!!fileText) files.push({'name': pathname.split('/').at(-1), 'content': fileText});
                    }
                }
            }

            const role = lastMessage.author.username === client.user.username ? "assistant" : "user";
            if (content.length !== 0) dialog.splice(1, 0, {role: role, content: content});
            for (let i = 0; i < files.length; ++i) {
                const file = files[files.length - i - 1];
                dialog.splice(1, 0, {
                    role: 'system',
                    content: "Below are the contents of the file given by the user. The file name is \"" + file.name + "\". Use it as context if necessary.\n" + file.content
                });
            }

            // 規定数を超えた場合はもっとも古い投稿を削除し、探索を終了する
            if (JSON.stringify(dialog).length > 2038 || dialog.length > 10) {
                dialog.slice(0, dialog.length - 1);
                break;
            }

            if (!lastMessage.reference) break;
            lastId = lastMessage.reference.messageId;
        }

        if (!isBotMentioned || isModeDiff) return false;

        await message.channel.sendTyping();
        const openai = new OpenAIApi.OpenAI({apiKey: process.env.OPENAI_SECRET_KEY});

        try {
            if (isStream) {
                await message.channel.sendTyping();
                const stream = await openai.chat.completions.create({
                    stream: true,
                    model: modelMode,
                    messages: dialog,
                    temperature: 0.2,
                    user: message.author.id,
                    max_tokens: max_token_length[modelMode]
                });

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
                                if (tempResponse) {
                                    if (tempResponseStr.length > 1200){
                                        await tempResponse.delete();
                                        const split = splitText(tempResponseStr);
                                        for (let i = 0; i < split.length - 1; ++i) {
                                            tempResponse = await message.reply(split[i]);
                                        }
                                        tempResponseStr = split[split.length - 1];
                                    } else {
                                        tempResponse.edit(tempResponseStr);
                                    }
                                }
                                else {
                                    const split = splitText(tempResponseStr);
                                    for (let i = 0; i < split.length - 1; ++i) {
                                        tempResponse = await message.reply(split[i]);
                                    }
                                    tempResponseStr = split[split.length - 1];
                                }
                            }
                            await message.channel.sendTyping();
                        }
                    } catch (error) {
                        console.error(error);
                        clearInterval(typing);
                        if (tempResponse) {
                            await tempResponse.delete();
                            tempResponse = undefined;
                        }
                        await message.reply("```diff\n-何らかの問題が発生しました。\n```");
                    }
                }, 500);

                for await (const chunk of stream) {
                    if (chunk.choices[0]?.finish_reason !== null) {
                        isEnd = true;
                        return;
                    }
                    tempResponseStr += chunk.choices[0]?.delta?.content || '';
                }
            } else {
                const typing = setInterval(async () => {
                    await message.channel.sendTyping();
                }, 1000);

                openai.chat.completions.create({
                    model: modelMode,
                    messages: dialog,
                    temperature: 0.2,
                    user: message.author.id,
                    max_tokens: max_token_length[modelMode]
                }).then(async (res) => {
                    clearInterval(typing);
                    const split = splitText(res.choices[0].message.content);
                    for (let i = 0; i < split.length; ++i) {
                        await message.reply(split[i])
                    }
                }).catch(async (error) => {
                    clearInterval(typing);
                    console.error(error);
                    await message.reply(`\`\`\`diff\n-何らかの問題が発生しました。\n${error.toString()}\n\`\`\``);
                });
            }
        } catch (err) {
            console.log(err);
            await message.reply("```diff\n-何らかの問題が発生しました。\n```");
        }
    },
};
