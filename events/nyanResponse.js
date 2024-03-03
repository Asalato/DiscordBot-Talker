import utils from "../utils.js";

export default {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (message.mentions.users.size > 0 && !message.mentions.has(client.user)) return false;
        if (Math.random() < 0.5) return false;
        return await utils.trySimpleReplyWhenContainsArray(['にゃ', '🐈'], ['にゃーん', 'にゃ', 'にゃん？', 'にゃあ', 'にゃん', 'んにゃ', 'にゃー'], message);
    },
};
