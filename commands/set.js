const {SlashCommandBuilder} = require("discord.js");
const TokenStore = require("../tokenStore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('SessionTokenを登録します')
        .addStringOption(option =>
            option.setName('session_token')
                .setDescription("登録するSessionToken（詳細は https://github.com/transitive-bullshit/chatgpt-api#session-tokens とか参照）")
                .setRequired(true))
        .addStringOption(option =>
            option.setName('clearance_token')
                .setDescription("登録するClearanceToken（詳細は https://github.com/transitive-bullshit/chatgpt-api#session-tokens とか参照）")
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        await interaction.deferReply();

        try {
            const session_token = interaction.options.getString('session token');
            await TokenStore.setSessionToken(session_token);
            const clearance_token = interaction.options.getString('clearance token');
            await TokenStore.setClearanceToken(clearance_token);

            await interaction.editReply("Tokenを登録しました。");
        } catch (error) {
            console.error(error);
            await interaction.editReply("何故かコマンドの実行に失敗しました");
        }
    },
};
