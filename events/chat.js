const OpenAIApi = require("openai");

const rev = "v2.0.8";
const isDev = false;

const GPT3_MODEL_NAME = "gpt-3.5-turbo-1106";
const GPT4_MODEL_NAME = "gpt-4-vision-preview";

let max_token_length = {}
max_token_length[GPT3_MODEL_NAME] = 4096;
max_token_length[GPT4_MODEL_NAME] = 4096;

const commandList = [
    {
        command: "!role",
        description: "そのメッセージを特定のロールの発言として送信します。",
        options: [
            {
                name: "system",
                description: "天の声（システムメッセージ）として発言します。"
            },
            {
                name: "user",
                description: "ユーザーとして発言します（デフォルト）。"
            },
            {
                name: "bot",
                description: "ボット（ChatGPT）側の過去の発言としてマークします。"
            }
        ],
        hasOption: true
    },
    {
        command: "!init",
        description: "最初のシステムメッセージをこのテキストに置き換えます。",
        optionDescription: "システムメッセージ、ダブルクオーテーションで囲んでもよい任意のテキスト。",
        hasOption: true
    },
    {
        command: "!noreply",
        description: "このコマンドが指定されたメッセージへの直接のリプライは行われません。（メッセージへのリプライでは読まれます。initやroleを指定する際に利用ください。）",
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
]

function containsCommand(commands, command, param = undefined) {
    return commands.commands.filter(c => c.command === command).filter(c => param === undefined || c.parameter === param).length !== 0
}

function splitText(text) {
    const maxLength = 1200;
    const result = [];
    let isLastInnerCodeBlock = false;
    for (let i = 0; i < Math.ceil(text.length / maxLength); i++) {
        let split = text.slice(i * maxLength, (i + 1) * maxLength);
        if (isLastInnerCodeBlock) split = "```" + split;
        const match = split.match(/```/gm);
        isLastInnerCodeBlock = !!match ? match.length % 2 === 1 : false;
        if (isLastInnerCodeBlock) split = split + "```";
        result.push(split);
    }
    return result;
}

function extractCommands(message) {
    let formattedContent = message.content.replace(/^<@[!&]?\d+>\s+/, '').trim();

    const commands = [];
    while(true) {
        const current = formattedContent;
        commandList.forEach(c => {
            const regex = new RegExp(`^\\s*(${c.command})((=(("((?:\\.|[^\\"])*)("|$))|(\\S*)?(\\s|$)))|(\\s|$))`);
            const match = formattedContent.match(regex);
            if (!match) return;

            const parameter = match[6] ?? match[8];
            commands.push({
                command: c.command,
                parameter: parameter
            });
            formattedContent = formattedContent.replace(match[0], "");
        });
        if (formattedContent === current) break;
    }

    return {
        message: formattedContent,
        commands: commands
    };
}

function replaceMentionsWithUsernames(mentions, content) {
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


function isMentioned(client, message) {
    if (message.mentions.users.size > 0 && message.mentions.users.has(client.user.id)) return true;
    return message.mentions.roles.size > 0 && message.mentions.roles.filter(x => x.tags.botId === client.user.id).size > 0;
}

async function sendHelpText(client, message) {
    let commandDesc = commandList.map(c => {
        let msg = `>\ ◦\ \`${c.command}\`\t${c.description}`;
        if (c.hasOption)
            msg += "\n>\ \t\tオプション\n";
        if (c.hasOption && c.optionDescription)
            msg += ">\ \t\t\t" + c.optionDescription;
        if (c.options && c.options.length > 0)
            msg += c.options.map(o => ">\ \t\t\t◦\ `" + o.name + "`" + (o.description ? ("\t" + o.description) : "")).join("\n");
        return msg;
    }).join("\n");
    commandDesc = "\n🖊\ 利用可能なオプション一覧\n\t\tメッセージの先頭につけることで動作が変更されます。\n" + commandDesc

    await message.reply("**_DiscordBot-Talker_** (https://github.com/Asalato/DiscordBot-Talker) by Asalato, Rev: **" + rev + "**" + (isDev ? " (**DEV CHANNEL**)" : "") + "\n" + commandDesc);
}

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

        const currentCommands = extractCommands(message);
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

        if (containsCommand(currentCommands,"!help") || currentCommands.message.replace(/\s/, "") === "") {
            await sendHelpText(client, message);
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

            const commands = extractCommands(lastMessage);
            if (containsCommand(commands, "!dev") === isDev) isModeDiff = false;

            const initMsg = commands.commands.filter(c => c.command === "!init");
            if (initMsg.length !== 0) dialog[0].content = initMsg[0].parameter.replace("\"", "");

            let role = lastMessage.author.username === client.user.username ? "assistant" : "user";
            if (containsCommand(commands, "!role")) {
                const parameter = commands.commands.filter(c => c.command === "!role")[0].parameter;
                if (parameter === "system") role = "system";
                if (parameter === "bot") role = "assistant";
                if (parameter === "user") role = "user";
            }

            if (containsCommand(commands, "!mode")) {
                const parameter = commands.commands.filter(c => c.command === "!mode")[0].parameter;
                if (parameter === "gpt4" || isImageAttached) modelMode = GPT4_MODEL_NAME;
                else if (parameter === "gpt3") modelMode = GPT3_MODEL_NAME;
            }

            const questionStr = replaceMentionsWithUsernames(lastMessage.mentions, commands.message);
            let content = questionStr !== "" ? [{type: "text", text: questionStr}] : [];

            if (lastMessage.attachments.size > 0 && role !== "system") {
                isImageAttached = true;
                modelMode = GPT4_MODEL_NAME;
                let attachment_urls = [...lastMessage.attachments.values()].map(x => x.url);
                for (let i = 0; i < attachment_urls.length; ++i) {
                    //if (['png', 'jpeg', 'gif', 'webp'].some(c => new URL(attachment_urls[i]).pathname.endsWith(c)))
                    content.push({type: "image_url", image_url: attachment_urls[i]})
                }
            }

            if (content.length !== 0) dialog.splice(1, 0, {role: role, content: content});

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
