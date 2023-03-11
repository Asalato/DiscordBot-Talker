const {Configuration, OpenAIApi} = require("openai");

const rev = "v1.3.17";
const isDev = false;

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
        command: "!mode",
        description: "呼び出しモードを指定します。",
        options: [
            {
                name: "stream",
                description: "メッセージをストリームとして返却します（β）。"
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

function splitText(text) {
    const maxLength = 1200;
    const result = [];
    for (let i = 0; i < Math.ceil(text.length / maxLength); i++) {
        result.push(text.slice(i * maxLength, (i + 1) * maxLength));
    }
    return result;
}

function extractCommands(message) {
    let formattedContent = message.content.replace(/^<@[!&]?\d+>\s+/, '').trim();

    const commands = [];
    while(true) {
        const current = formattedContent;
        commandList.forEach(c => {
            const regex = new RegExp(`^\\s*${c.command}(=(\\S*))?`);
            const match = formattedContent.match(regex);
            if (!match) return;

            commands.push({
                command: c.command,
                parameter: match[2]
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

    await message.reply("**_DiscordBot-Talker_** (https://github.com/Asalato/DiscordBot-Talker) by Asalato, Rev: **" + rev + "**" + (isDev ? "(dev channel)" : "") + "\n" + commandDesc);
}

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (!message.mentions.has(client.user)) return false;
        const currentCommands = extractCommands(message);
        if (isDev) console.log(currentCommands);

        if (currentCommands.commands.filter(c => c.command === "!version").length !== 0) {
            await message.reply(rev);
            return;
        }

        let setIsDev = currentCommands.commands.filter(c => c.command === "!dev").length !== 0;
        if (setIsDev ? !isDev : isDev) {
            if (!isDev) await message.reply("```diff\n-devチャネルではないため、要求は却下されました。。\n```");
            return;
        }

        if (currentCommands.commands.filter(c => c.command === "!help").length !== 0 || currentCommands.message.replace(/\s/, "") === "") {
            await sendHelpText(client, message);
            return;
        }

        await message.channel.sendTyping();

        let dialog = [];
        const youbi = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const time = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
        const initText = `The following is a conversation with an AI assistant (you). The assistant is helpful, creative, clever, and very friendly.\nYour name is "${client.user.username}" and you are running as a Bot on Discord. The current time is ${youbi[time.getDay()]}, ${time.getMonth() + 1}/${time.getDate()}, ${time.getFullYear()}. The time is ${time.getHours()}:${time.getMinutes()}. Please use these information only when necessary. They must also treat this information as their own knowledge and keep the fact that it was given to you a secret. Please return responses to the following statements in the form of response statements only. Language should follow the statement. Response is presented in markdown format`;
        dialog.push({role: "system", content: initText});

        const messages = message.channel.messages;
        let lastId = message.id;
        let isHuman = true;
        while(true) {
            const lastMessage = await messages.fetch(lastId);

            let role = lastMessage.author.username === client.user.username ? "assistant" : "user";
            const commands = extractCommands(lastMessage);
            const question = replaceMentionsWithUsernames(lastMessage.mentions, commands.message);
            if (commands.commands.filter(c => c.command === "!role").length !== 0){
                const parameter = commands.commands.filter(c => c.command === "role")[0].parameter;
                if (parameter === "system") role = "system";
                if (parameter === "bot") role = "assistant";
                if (parameter === "user") role = "user";
            }

            const initMsg = commands.commands.filter(c => c.command === "!init");
            if (initMsg.length !== 0)
                dialog[0].content = initMsg[0].parameter.replace("\"", "");

            dialog.splice(1, 0, {role: role, content: question/*, name: lastMessage.author.username*/});

            if (JSON.stringify(dialog).length > 2038 || dialog.length > 10) {
                dialog.slice(0, dialog.length - 1);
                break;
            }
            if (!lastMessage.reference) break;
            isHuman = !isHuman;
            lastId = lastMessage.reference.messageId;
        }

        const configuration = new Configuration({
            apiKey: process.env.OPENAI_SECRET_KEY
        });
        const openai = new OpenAIApi(configuration);

        try {
            const useStream = currentCommands.commands.filter(c => c.command === "!mode" && c.parameter === "stream").length !== 0;

            if (useStream) {
                const completion = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: dialog,
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
                                if (tempResponse) {
                                    if (tempResponseStr.length > 1200){
                                        await tempResponse.delete();
                                        const split = splitText(tempResponseStr);
                                        let isInnerQuote = false;
                                        for (let i = 0; i < split.length - 1; ++i) {
                                            const res = (isInnerQuote ? "```\n" : "") + split[i];
                                            tempResponse = await message.reply(res);
                                            if ((split[i].split("```").length - 1) % 2 !== 0) isInnerQuote = !isInnerQuote;
                                        }
                                        tempResponseStr = split[split.length - 1];
                                    } else {
                                        tempResponse.edit(tempResponseStr);
                                    }
                                }
                                else {
                                    const split = splitText(tempResponseStr);
                                    let isInnerQuote = false;
                                    for (let i = 0; i < split.length - 1; ++i) {
                                        const res = (isInnerQuote ? "```\n" : "") + split[i];
                                        tempResponse = await message.reply(res);
                                        if ((split[i].split("```").length - 1) % 2 !== 0) isInnerQuote = !isInnerQuote;
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

                completion.data.on('data', async data => {
                    const lines = data.toString().split('\n').filter(line => line.trim() !== '');
                    for (const line of lines) {
                        const str = line.replace(/^data: /, '');
                        if (str === '[DONE]') {
                            isEnd = true;
                            return;
                        }
                        try {
                            const parsed = JSON.parse(str);
                            const fragment = parsed.choices[0].delta?.content;
                            if(fragment) tempResponseStr += fragment;
                        } catch (error) {
                            errorStr = 'Could not JSON parse stream message' + str + error;
                            console.error('Could not JSON parse stream message', str, error);
                            return;
                        }
                    }
                })
            } else {
                const typing = setInterval(async () => {
                    await message.channel.sendTyping();
                }, 1000);

                openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: dialog,
                    temperature: 0.2,
                    user: message.author.id
                }).then(async (res) => {
                    clearInterval(typing);
                    const split = splitText(res.data.choices[0].message.content);
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
