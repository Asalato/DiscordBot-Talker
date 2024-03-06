import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import utils from "../utils.js";
import ipu from "../imageProcessingUtils.js";
import { fallBackModel, models, getModel, getOutput } from "../models.js";

const rev = "v3.3.0";
const isDev = false;

const commandList = [
    {
        command: ["!init"],
        alias: [],
        description: "最初のシステムメッセージをこのテキストに置き換えます。",
        optionDescription: "システムメッセージ、ダブルクオーテーションで囲んでもよい任意のテキスト。",
        hasOption: true
    },
    {
        command: "!noreply",
        alias: ["!nr"],
        description: "このコマンドが指定されたメッセージへの直接のリプライは行われません。（メッセージへのリプライでは読まれます。initを指定する際に利用ください。）",
        hasOption: false
    },
    {
        command: "!model",
        alias: ["!m", "!mode"],
        description: "利用モデルを指定します。",
        options: 
            Object.values(models).filter(model => !model.hidden).map(model => {return {
                "name": model.short_name,
                "alias": model.alias,
                "description": (model == fallBackModel ? "(デフォルト) " : "") + `${model.getFamily().name}の${model.short_name}モデルを利用します。現在のモデルは[${model.name}](${model.info_url})です。`
            }}),
        hasOption: true
    },
    {
        command: "!dev",
        alias: [],
        description: "デベロッパーチャンネルへ送信します（検証用）。",
        hasOption: false
    },
    {
        command: "!help",
        alias: ["!h"],
        description: "ヘルプメニューを表示します（これ）。",
        hasOption: false
    },
    {
        command: "!version",
        alias: ["!v"],
        description: "バージョンのみを返します。",
        hasOption: false
    }
];

const releaseNote = [
    "v2.0.0\tgpt4-visionに対応し、画像の読み込みが可能になりました",
    "v2.1.0\tテキストファイルの読み込みに対応しました。",
    "v3.0.0\tLangChainを利用する形式に処理を変更し、使用可能なモデルを拡張しました。",
    "v3.1.0\twatsonx.aiモデルを呼べるようにしました。（ChatModelではないため、精度の低下が見込まれます。）",
    "v3.2.0\t大きい画像を添付した際に、自動で圧縮するようになりました。",
    "v3.3.0\tAnthoropicのClaude3モデルを追加しました。"
]

export default {
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

        const currentCommands = utils.extractCommands(commandList, message);
        if (isDev) console.log(currentCommands);

        let isModeDiff = utils.containsCommand(currentCommands,"!dev") !== isDev;

        if (utils.containsCommand(currentCommands,"!noreply")) {
            return;
        }

        if (utils.containsCommand(currentCommands,"!version")) {
            await message.reply(rev);
            return;
        }

        if (!isModeDiff && (utils.containsCommand(currentCommands,"!help") || currentCommands.message.replace(/\s/, "") === "")) {
            await utils.sendHelpText(rev, isDev, commandList, client, message, releaseNote);
            return;
        }

        let dialog = [];
        const initText = `The following is a conversation with an AI assistant (you). The assistant is helpful, creative, clever, and very friendly.\nYour name is "${client.user.username}" and you are running as a Bot on Discord. If your responses are complex and require structured output, then output them in markdown format.`;
        dialog.push(new SystemMessage(initText));

        lastId = message.id;
        let isBotMentioned = utils.isMentioned(client, message);
        
        let model_name = fallBackModel.name;
        let isImageAttached = false;
        while(true) {
            const lastMessage = await messages.fetch(lastId);

            // 最後にメンションされた対象が全体メンションで、かつ直接のメンションがない場合は返信しない
            if (utils.isMentioned(client, lastMessage)) isBotMentioned = true;

            const commands = utils.extractCommands(commandList, lastMessage);
            if (!isDev && utils.containsCommand(commands, "!dev")) isModeDiff = true;
            if (isDev && utils.containsCommand(commands, "!dev")) isModeDiff = false;

            const initMsg = commands.commands.filter(c => c.command === "!init");
            if (initMsg.length !== 0) dialog[0].content = initMsg[0].parameter.replace("\"", "");

            if (utils.containsCommand(commands, "!model")) {
                model_name = commands.commands.filter(c => c.command === "!model")[0].parameter; 
            }

            const message = utils.replaceMentionsWithUsernames(lastMessage.mentions, commands.message);
            if (message.length !== 0){
                if (lastMessage.author.username === client.user.username) {
                    dialog.splice(1, 0, new AIMessage({content: [
                        {
                            type: "text",
                            text: message
                        }
                    ]}));
                } else {
                    dialog.splice(1, 0, new HumanMessage({content: [
                        {
                            type: "text",
                            text: message
                        }
                    ]}));
                }
            }

            if (lastMessage.attachments.size > 0) {
                let attachment_urls = [...lastMessage.attachments.values()].map(x => x.url);
                for (let i = 0; i < attachment_urls.length; ++i) {
                    const pathname = new URL(attachment_urls[i]).pathname;
                    if (['png', 'jpeg', 'gif', 'webp'].some(c => pathname.endsWith(c))) {
                        isImageAttached = true;
                        dialog[dialog.length - 1].content.push({
                            type: "image_url", 
                            image_url: `data:image/jpeg;base64,${await ipu.getAndResizeImage(attachment_urls[i], [512, 512])}`
                        });
                    } else {
                        const fileText = await utils.getFileText(attachment_urls[i]);
                        if (!!fileText) {
                            const file = {name: pathname.split('/').at(-1), content: fileText};
                            dialog[dialog.length - 1].content.push({
                                type: "text", 
                                text: "Below are the contents of the file given by the user. The file name is \"" + file.name + "\". Use it as context if necessary.\n" + file.content
                            });
                        }
                    }
                }
            }

            if (!lastMessage.reference) break;
            lastId = lastMessage.reference.messageId;
        }

        if (!isBotMentioned || isModeDiff) return false;

        await message.channel.sendTyping();
        const typing = setInterval(async () => {
            await message.channel.sendTyping();
        }, 1000);
        
        try {
            const model = getModel(model_name, isImageAttached);
            const response = await getOutput(model, dialog);
            clearInterval(typing);
            const split = utils.splitText(response);
            for (let i = 0; i < split.length; ++i) {
                await message.reply(split[i])
            }
        } catch (err) {
            clearInterval(typing);
            console.log(err);
            await message.reply("```diff\n-何らかの問題が発生しました。\n" + err + "```");
        }
    },
};
