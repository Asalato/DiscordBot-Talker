import fetch from 'node-fetch';
import pdf from 'pdf-parse/lib/pdf-parse.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
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
    },
    containsCommand: function (commands, command, param = undefined) {
        return commands.commands.filter(c => c.command === command).filter(c => param === undefined || c.parameter === param).length !== 0
    },
    splitText: function (text) {
        const maxLength = 2000;

        const result = [];

        // 暫定的に、改行文字で分割
        const split = text.split("\n");

        // splitした結果を2000文字を超えない範囲で結合し、resultに追加
        let current = "";
        for (let i = 0; i < split.length; ++i) {
            let chunk = split[i];
            if (current.length + chunk.length > maxLength) {
                result.push(current);
                current = "";
            }

            // splitした結果が単体で2000文字を超える場合は、超過しなくなるまでresultに追加
            while (chunk.length > maxLength) {
                result.push(chunk.substring(0, maxLength));
                chunk = chunk.substring(maxLength);
            }

            current += chunk + "\n";
        }
        result.push(current);

        // 各ブロックを検査し、中に「```(\w+)\n」でマッチされる行が奇数個存在した場合、そのブロックの末尾に「```」を追加
        // また、「(\w)+」でマッチされる、コードブロックの言語名を変数に格納し、次ブロックの先頭に「```${lang_name}\n」を追加
        const codeBlock = /```(\w*)\n/g;
        for (let i = 0; i < result.length; ++i) {
            const match = result[i].match(codeBlock);
            if (!match) continue;
            if (match.length % 2 === 0) continue;
            result[i] += "```";
            result[i + 1] = match[match.length - 1] + result[i + 1];
        }

        return result;
    },
    extractCommands: function (commandList, message) {
        let formattedContent = message.content.replace(/^<@[!&]?\d+>\s+/, '').trim();

        const commands = [];
        while(true) {
            const current = formattedContent;
            commandList.forEach(c => {
                const matchPattern = [c.command, ...c.alias].join("|")

                const regex = new RegExp(`^\\s*(${matchPattern})((=(("((?:\\.|[^\\"])*)("|$))|(\\S*)?(\\s|$)))|(\\s|$))`);
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
    },
    replaceMentionsWithUsernames: function (mentions, content) {
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
    },
    isMentioned: function (client, message) {
        if (message.mentions.users.size > 0 && message.mentions.users.has(client.user.id)) return true;
        return message.mentions.roles.size > 0 && message.mentions.roles.filter(x => x.tags.botId === client.user.id).size > 0;
    },
    sendHelpText: async function (rev, isDev, commandList, client, message, releaseNote) {
        let commandDesc = commandList.map(c => {
            let msg = `>\ ◦\ \`${c.command}\` [${c.alias.map(a => "`" + a + "`")}]\t${c.description}`;
            if (c.hasOption)
                msg += "\n>\ \t\tオプション\n";
            if (c.hasOption && c.optionDescription)
                msg += ">\ \t\t\t" + c.optionDescription;
            if (c.options && c.options.length > 0)
                msg += c.options.map(o => ">\ \t\t\t◦\ `" + o.name + "`"+ (o.description ? ("\t" + o.description) : "")).join("\n");
            return msg;
        }).join("\n");
        commandDesc = "\n🖊\ 利用可能なオプション一覧\n\t\tメッセージの先頭につけることで動作が変更されます。\n" + commandDesc

        const split = this.splitText("**_DiscordBot-Talker_** (https://github.com/Asalato/DiscordBot-Talker) by Asalato, Rev: **" + rev + "**" + (isDev ? " (**DEV CHANNEL**)" : "") + "\n" + commandDesc + "\n\n**Change Note:**\n" + releaseNote.map(r => ">\ " + r).join("\n"));
        for (let i = 0; i < split.length; ++i) {
            await message.reply(split[i])
        }
    },
    getFileText: async (url) => {
        const pathname =  new URL(url).pathname;
        const response = await fetch(url);
        if (!response.ok) return undefined;

        try {
            if (pathname.endsWith('pdf')) {
                const data = await response.arrayBuffer();
                return (await pdf(new Uint8Array(data))).text;
            } else {
                return await response.text();
            }
        } catch(error) {
            console.error(error);
            return undefined;
        }
    }
}
