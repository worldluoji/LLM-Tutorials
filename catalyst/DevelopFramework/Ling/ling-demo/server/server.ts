import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import dotenv from 'dotenv';
import { Ling } from "@bearbobo/ling";
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';


dotenv.config({path:'.env'});
dotenv.config({path:'.env.local', override: true});

interface QueryParams {
  question: string;
}

// 环境变量配置
const openaiApiKey = process.env.deepseek;
if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
} else {
    console.log('OPENAI_API_KEY environment variable is set');
}

const endpoint = 'https://api.deepseek.com/chat/completions';

const outlinePrompt = `
根据用户要求，生成科普文章大纲。

输出以下JSON格式内容：

{
    "title": "文章标题",
    "outline": [
        {
            "section": 1,
            "title": "章节标题",
            "subtopics": "子主题1\n子主题2\n子主题3",
            "overview": "章节概述"
        },
        {
            "section": 2,
            "title": "章节标题",
            "subtopics": "子主题1\n子主题2\n子主题3",
            "overview": "章节概述"
        },
        {
            "section": 3,
            "title": "章节标题",
            "subtopics": "子主题1\n子主题2\n子主题3",
            "overview": "章节概述"
        },
        {
            "section": 4,
            "title": "总结",
            "subtopics": "子主题1\n子主题2",
            "overview": "章节概述"
        },
    ]
}
`;

const contentPrompt = `
根据用户发送的文章标题和概述，撰写详细文章内容。

要求： 
文章的读者是6-8岁的儿童。
文章的风格要符合儿童的阅读习惯，避免使用过于复杂的句子结构和词汇。
文章的内容要围绕用户发送的文章标题和概述进行，不要偏离主题。
限制篇幅，不要超过3个自然段落，纯文本输出，不要加任何Markdown标签。
`;


const fastify = Fastify({ logger: true });

// SSE流式端点
fastify.get('/stream', async (request: FastifyRequest<{Querystring: QueryParams}>, reply) => {
    const question = request.query.question;

    /*
     Ling 默认做了 OpenAI 和 Coze 接口的兼容，所以我们创建 Ling 时，model_name、apk_key 和 endpoint 可以传 DeepSeek、Kimi（moonshot）或豆包，
     以及其他任何兼容 OpenAI 的大模型。当我们使用豆包时，model_name 要传 botId
    */
    const config = {
        model_name: 'deepseek-chat',
        api_key: openaiApiKey,
        endpoint: endpoint,
        sse: true,
    };

    // ------- The work flow start --------
    const ling = new Ling(config);

    const outlineBot = ling.createBot();
    outlineBot.addPrompt(outlinePrompt);

    outlineBot.chat(question);

    /*
      除了 object-response 外，Ling 还支持string-response 和  inference-done 事件，
      前者在解析完成某个字符串属性时被触发；后者在整个 Bot 推理完成时触发。
      
      因为我们希望在文章每个小节完成提纲生成时，就可以立即发给生成正文的 Bot 处理。
      所以这里使用了object-response 事件，确保它第一时间就被后续节点立即处理，这样减少等待时间。
    */
    outlineBot.on('object-response', ({ uri, delta }) => {
        const matches = uri.match(/outline\/(\d+)/);
        if (matches) {
            const section = matches[1];
            console.log(uri, delta);
            // 创建二级 Bot 用来处理正文。因为这里的正文输出不需要 JSON 格式，所以我们通过 response_format: { type: "text" }  强制 Bot 输出文本。
            const contentBot = ling.createBot(`content/${section}`, {}, {
                response_format: { type: "text" },
            });
            contentBot.addPrompt(contentPrompt);
            contentBot.chat(`
                # 主题
                ${delta.title}

                ## 子主题
                ${delta.subtopics}

                ## 摘要
                ${delta.overview}
            `);
        }
    });

    ling.close();

    // setting below headers for Streaming the data
    reply.raw.writeHead(200, {
        'Content-Type': "text/event-stream",
        'Cache-Control': "no-cache",
        'Connection': "keep-alive"
    });

    const nodeStream = Readable.fromWeb(ling.stream as any); 
    pipeline(nodeStream, reply.raw)
        .catch((err) => {
            // 记录错误日志
            fastify.log.error('流处理异常:', err); 
            // 主动销毁响应流
            reply.raw.destroy(err); 
        });
});

// 启动服务器
fastify.listen({ port: 8094 }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});