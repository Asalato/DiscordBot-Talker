const {trySimpleReplyWhenContainsArray} = require("../utils");

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        if (message.author.bot) return false;
        if (message.mentions.users.size > 0 && !message.mentions.has(client.user)) return false;
        return await trySimpleReplyWhenContainsArray(['にゃ', '🐈'], ['にゃーん'], message);
    },
};
