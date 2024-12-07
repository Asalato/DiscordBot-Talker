import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { WatsonxAI } from "@langchain/community/llms/watsonx_ai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const parser = new StringOutputParser();

export class ModelFamily {
    constructor(name, create_llm, models, {is_stream_support = false, chat = true} = {}) {
        this.name = name;
        this.create_llm = create_llm;
        this.models = models;
        this.is_stream_support = is_stream_support;
        this.chat = chat;
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
    constructor(name, short_name, alias, info_url, max_input_token_length, max_output_token_length, {is_multimodal_supported = false, hidden = false, system_message_enabled = true} = {}) {
        this.name = name;
        this.short_name = short_name;
        this.alias = alias;
        this.info_url = info_url;
        this.max_input_token_length = max_input_token_length;
        this.max_output_token_length = max_output_token_length;
        this.is_multimodal_supported = is_multimodal_supported;
        this.hidden = hidden;
        this.system_message_enabled = system_message_enabled;
    }

    getFamily() {
        return Object.values(modelfalimies).find(family => family.models.find(m => m === this));
    }
}

export const models = {
    gpt4o: new Model(
        "gpt-4o",
        "gpt4o",
        [],
        "https://platform.openai.com/docs/models#gpt-4o",
        128000,
        16384,
        {is_multimodal_supported: true}
    ),
    o1_preview: new Model(
        "o1-preview",
        "o1-preview",
        ["o1"],
        "https://platform.openai.com/docs/models#o1",
        128000,
        32768,
        {system_message_enabled: false}
    ),
    o1_mini: new Model(
        "o1-mini",
        "o1-mini",
        [],
        "https://platform.openai.com/docs/models#o1",
        128000,
        32768,
        {system_message_enabled: false}
    ),
    gemini15_flash: new Model(
        "gemini-1.5-flash-latest",
        "gemini15-flash",
        ["flash", "gemini-1.5-flash", "gemini-flash-latest", "gemini-flash"],
        "https://deepmind.google/technologies/gemini/#gemini-1.5",
        30720,
        4096,
        {is_multimodal_supported: true}
    ),
    gemini15_pro: new Model(
        "gemini-1.5-pro-latest", 
        "gemini1.5", 
        ["gemini", "gemini-1.5", "gemini-1.5-pro", "gemini-pro-latest", "gemini-pro"],
        "https://deepmind.google/technologies/gemini/#gemini-1.5",
        30720,
        4096,
        {is_multimodal_supported: true}
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
    claude35_sonnet: new Model(
        "claude-3-5-sonnet-latest",
        "claude35-sonnet",
        ["claude", "sonnet", "claude35-sonnet", "claude-3.5-sonnet", "claude-sonnet", "claude-3.5", "claude35"],
        "https://www.anthropic.com/news/claude-3-family",
        200000,
        4096,
        {is_multimodal_supported: true}
    ),
    claude3_haiku: new Model(
        "claude-3-5-haiku-latest",
        "claude35-haiku",
        ["haiku", "claude35-haiku", "claude-3.5-haiku", "claude-haiku"],
        "https://www.anthropic.com/news/claude-3-family",
        200000,
        4096,
        {is_multimodal_supported: true}
    ),
    llama3: new Model(
        "meta-llama/llama-3-3-70b-instruct",
        "llama3",
        ["llama3", "llama-3", "llama-3-70b", "llama-3-70b-instruct"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#llama-2",
        128000,
        4096
    ),
    mistral_large: new Model(
        "mistral-large/mistral-large",
        "mistral-large",
        ["mistral-large", "mistral-large-instruct-v01-q"],
        "https://jp-tok.dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models.html?context=wx&audience=wdp#mistral-large",
        128000,
        4096
    ),
}

export const modelfalimies = {
    openai: new ModelFamily(
        "openai", 
        (model) => {
            const config = {
                openAIApiKey: process.env.OPENAI_SECRET_KEY,
                modelName: model.name
            };
            if (model.name === "gpt-4o") {
                config.maxTokens = model.max_output_token_length;
            } else {
                config.maxCompletionTokens = model.max_output_token_length;
            }
            return new ChatOpenAI(config);
        }, 
        [
            models.gpt4o,
            models.o1_preview,
            models.o1_mini
        ],
        {is_stream_support: true}
    ),
    google: new ModelFamily(
        "google", 
        (model) => new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_SECRET_KEY,
            modelName: model.name
        }), 
        [
            models.gemini15_flash,
            models.gemini15_pro
        ],
        {is_stream_support: true}
    ),
    anthropic: new ModelFamily(
        "anthropic",
        (model) => new ChatAnthropic({
            anthropicApiKey: process.env.ANTHROPIC_SECRET_KEY,
            modelName: model.name
        }),
        [
            models.claude3_opus,
            models.claude35_sonnet,
            models.claude3_haiku
        ],
        {is_stream_support: true}
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
            models.llama3,
            models.mistral_large
        ],
        {chat: false}
    )
};

export const fallBackModel = models.claude35_sonnet;

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

    if (family.chat) {
        const prompt = ChatPromptTemplate.fromMessages(dialog);
        const chain = prompt.pipe(llm).pipe(parser);
        return await chain.invoke({});
    } else {
        let prompt = dialog.filter(d => !d.content.type || d.content.type !== "image_url").map(d => {
            let content = d.content;
            if (Array.isArray(content)) {
                content = content.map(c => c.text).join("\n");
            }

            if (d instanceof SystemMessage)
                return `${content}\n\n------------------- chat history -------------------`
            if (d instanceof HumanMessage)
                return `User: ${content}`
            if (d instanceof AIMessage)
                return `Assistant: ${content}`
        }).join("\n\n")
        prompt += "\n\nAssistant: "
        return await llm.invoke(prompt);
    }
}

export const getOutputStream = async (model, dialog) => {
    const family = getFamily(model);
    if (family.is_stream_support === false) {
        throw new Error(`Model ${model.name} does not support stream`);
    }

    const llm = family.createLlm(model);
    if (family.chat) {
        const prompt = ChatPromptTemplate.fromMessages(dialog);
        return await prompt.pipe(llm).pipe(parser).stream({})
    } else {
        let prompt = dialog.filter(d => !d.content.type || d.content.type !== "image_url").map(d => {
            let content = d.content;
            if (Array.isArray(content)) {
                content = content.map(c => c.text).join("\n");
            }

            if (d instanceof SystemMessage)
                return `${content}\n\n------------------- chat history -------------------`
            if (d instanceof HumanMessage)
                return `User: ${content}`
            if (d instanceof AIMessage)
                return `Assistant: ${content}`
        }).join("\n\n")
        prompt += "\n\nassistant: "
        return await llm.pipe(parser).stream(prompt)
    }
}