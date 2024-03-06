import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { WatsonxAI } from "@langchain/community/llms/watsonx_ai";

export class ModelFamily {
    constructor(name, create_llm, models) {
        this.name = name;
        this.create_llm = create_llm;
        this.models = models;
    }

    createLlm(model = null) {
        if (!model) model = this.models[0];

        if (model === undefined || !this.models.includes(model)) {
            throw new Error(`Model not found in family ${this.name}`);
        }
        return this.create_llm(model);
    }
}

export class Model {
    constructor(name, short_name, alias, info_url, max_input_token_length, max_output_token_length, {is_multimodal_supported = false, chat_model = true, hidden = false} = {}) {
        this.name = name;
        this.short_name = short_name;
        this.alias = alias;
        this.info_url = info_url;
        this.max_input_token_length = max_input_token_length;
        this.max_output_token_length = max_output_token_length;
        this.is_multimodal_supported = is_multimodal_supported;
        this.chat_model = chat_model;
        this.hidden = hidden;
    }

    getFamily() {
        return Object.values(modelfalimies).find(family => family.models.find(m => m === this));
    }
}

export const models = {
    gpt3: new Model(
        "gpt-3.5-turbo", 
        "gpt3",
        ["gpt-3", "gpt-3.5", "gpt-3-turbo", "gpt-3.5-turbo"], 
        "https://platform.openai.com/docs/models/gpt-3-5",
        16385,
        4096
    ),
    gpt4: new Model(
        "gpt-4-turbo-preview", 
        "gpt4", 
        ["gpt-4", "gpt-4-turbo", "gpt-4-preview", "gpt-4-turbo-preview"], 
        "https://platform.openai.com/docs/models/gpt-4-and-gpt-4-turbo",
        128000,
        4096
    ),
    gpt4_vision: new Model(
        "gpt-4-vision-preview", 
        "gpt4-vision", 
        ["gpt-4-vision", "gpt-4-vision-preview"],
        "https://platform.openai.com/docs/models/gpt-4-and-gpt-4-turbo",
        128000,
        4096,
        {hidden: true, is_multimodal_supported: true}
    ),
    gemini: new Model(
        "gemini-1.0-pro-latest", 
        "gemini",
        ["gemini-1.0", "gemini-1", "gemini-1.0-pro", "gemini-1-pro", "gemini-pro-lastest", "gemini-pro"], 
        "https://deepmind.google/technologies/gemini/#gemini-1.0",
        30720,
        4096
    ),
    gemini1_5: new Model(
        "gemini-1.5-pro-latest", 
        "gemini1.5", 
        ["gemini-1.5", "gemini-1.5-pro", "gemini-pro-latest", "gemini-pro"],
        "https://deepmind.google/technologies/gemini/#gemini-1.5",
        30720,
        4096
    ),
    gemini_pro_vision: new Model(
        "gemini-pro-vision", 
        "gemini-vision",
        ["gemini-pro-vision"], 
        "https://deepmind.google/technologies/gemini/#gemini-1.0",
        12288,
        4096,
        {hidden: true, is_multimodal_supported: true}
    ),
    claude3_opus: new Model(
        "claude-3-opus-20240229", 
        "claude3-opus",
        ["opus", "claude3-opus", "claude-3-opus", "claude-opus"], 
        "https://www.anthropic.com/news/claude-3-family",
        200000,
        4096,
        {is_multimodal_supported: true}
    ),
    claude3_sonnet: new Model(
        "claude-3-sonnet-20240229",
        "claude3-sonnet",
        ["sonnet", "claude3-sonnet", "claude-3-sonnet", "claude-sonnet", "claude-3", "claude", "anthropic", "claude3"],
        "https://www.anthropic.com/news/claude-3-family",
        200000,
        4096,
        {is_multimodal_supported: true}
    ),
    granite_8b_japanese: new Model(
        "ibm/granite-8b-japanese",
        "granite",
        ["granite", "granite-jp", "granite-8b-japanese", "granite-japanese"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#granite-8b-japanese",
        8192,
        4096,
        {chat_model: false}
    ),
    elyza: new Model(
        "elyza/elyza-japanese-llama-2-7b-instruct",
        "elyza",
        ["elyza", "elyza-jp", "elyza-2-7b"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#elyza-japanese-llama-2-7b-instruct",
        4096,
        4096,
        {chat_model: false}
    ),
    llama2: new Model(
        "meta-llama/llama-2-70b-chat",
        "llama2",
        ["llama2", "llama-2", "llama-2-70b", "llama-2-70b-chat"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#llama-2",
        4096,
        4096,
        {chat_model: false}
    ),
    mixtral8x7b: new Model(
        "ibm-mistralai/mixtral-8x7b-instruct-v01-q",
        "mixtral",
        ["mixtral", "mixtral-8x7b", "mixtral-8x7b-instruct-v01-q"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#mixtral-8x7b",
        4096,
        4096,
        {chat_model: false}
    ),
}

export const modelfalimies = {
    openai: new ModelFamily(
        "openai", 
        (model) => new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_SECRET_KEY,
            modelName: model.name,
            maxTokens: model.max_output_token_length
        }), 
        [
            models.gpt3,
            models.gpt4,
            models.gpt4_vision
        ]
    ),
    google: new ModelFamily(
        "google", 
        (model) => new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_SECRET_KEY,
            modelName: model.name
        }), 
        [
            models.gemini,
            models.gemini1_5,
            models.gemini_pro_vision
        ]
    ),
    anthropic: new ModelFamily(
        "anthropic",
        (model) => new ChatAnthropic({
            anthropicApiKey: process.env.ANTHROPIC_SECRET_KEY,
            modelName: model.name
        }),
        [
            models.claude3_opus,
            models.claude3_sonnet
        ]
    ),
    watsonx: new ModelFamily(
        "watsonx",
        (model) => new WatsonxAI({
            modelId: model.name,
            ibmCloudApiKey: process.env.IBM_CLOUD_API_KEY,
            region: process.env.IBM_CLOUD_REGION,
            projectId: process.env.IBM_PROJECT_ID,
            modelParameters: {
                max_new_tokens: model.max_output_token_length,
                min_new_tokens: 0,
                stop_sequences: [],
                repetition_penalty: 1,
            }
        }),
        [
            models.granite_8b_japanese,
            models.elyza,
            models.llama2,
            models.mixtral8x7b
        ]
    )
};

export const fallBackModel = models.claude3_sonnet;

export const getFamily = (model) => {
    const family = Object.values(modelfalimies).find(family => family.models.find(m => m === model));
    if (family === undefined) {
        throw new Error(`Model ${model} not found in any family`);
    }
    return family;
}

export const getModel = (model_name, required_multimodal = false) => {
    const model = Object.values(models).find(m => m.name === model_name || m.short_name === model_name || m.alias.includes(model_name));
    if (model === undefined) {
        throw new Error(`Model ${model_name} not found`);
    }

    if (required_multimodal && !model.is_multimodal_supported) {
        const family = getFamily(model);
        const multimodal_model = family.models.find(m => m.is_multimodal_supported);

        if (multimodal_model === undefined) {
            throw new Error(`Model ${model_name} does not support multimodal`);
        }
        return multimodal_model;
    } else {
        return model;
    }
}

export const getOutput = async (model, dialog) => {
    const family = getFamily(model);
    const llm = family.createLlm(model);

    if (model.chat_model) {
        const prompt = ChatPromptTemplate.fromMessages(dialog);
        const chain = prompt.pipe(llm);
        return (await chain.invoke({})).content;
    } else {
        let prompt = "[INST]\n" + dialog.filter(d => !d.content.type || d.content.type !== "image_url").map(d => {
            if (d instanceof SystemMessage)
                return `${d.content}\n\n-------------------latest conversation-------------------\n\n`
            if (d instanceof HumanMessage)
                return `user: ${d.content}`
            if (d instanceof AIMessage)
                return `assistant: ${d.content}`
        }).join("\n")
        prompt += "\n[/INST]\nassistant: "
        console.log(prompt)
        return await llm.invoke(prompt);
    }
}