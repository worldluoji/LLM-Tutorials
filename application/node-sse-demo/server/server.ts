import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { TextDecoder } from 'node:util';
import dotenv from 'dotenv';

// .env.local 中定义的同名环境变量会覆盖 .env 中的值
dotenv.config({ path: ['.env', '.env.local']})

interface QueryParams {
  question: string;
}

// 环境变量配置
const openaiApiKey = process.env.deepseek;
if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}
const endpoint = 'https://api.deepseek.com/chat/completions';

const fastify = Fastify({ logger: true });

// SSE流式端点
fastify.get('/stream', async (request: FastifyRequest<{Querystring: QueryParams}>, reply) => {
    // 设置SSE响应头
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: request.query.question }],
                stream: true
            })
        });

        if (!response.ok) {
            fastify.log.error(response);
            throw new Error('Failed to fetch from DeepSeek');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to create a reader');

        const decoder = new TextDecoder();
        let buffer = '';

        // 流式数据处理器
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = buffer + decoder.decode(value, { stream: true });
            buffer = '';

            // 分割处理数据块
            const lines = chunk.split('\n')
                .filter(line => line.trim() && line.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                    reply.raw.write('event: end\ndata: [DONE]\n\n');
                    return reply.raw.end();
                }

                try {
                    const jsonData = JSON.parse(data);
                    const delta = jsonData.choices[0].delta.content;
                    if (delta) {
                        reply.raw.write(`data: ${delta}\n\n`); // 实时转发[9](@ref)
                    }
                } catch (err) {
                    buffer += data; // 缓存不完整JSON数据
                }
            }
        }
    } catch (error) {
        fastify.log.error(error);
        reply.raw.write('data: Error occurred\n\n');
        reply.raw.end();
    }
});

// 启动服务器
fastify.listen({ port: 8094 }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});