import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({path:'.env'});
dotenv.config({path:'.env.local', override: true});

const resolveImage = async (url, prompt, imageUrl) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
            'X-DashScope-SSE': 'enable'
        },
        body: JSON.stringify({
            model: "qvq-max",
            input:{
                "messages":[
                    {
                        "role": "user",
                        "content": [
                            {"image": imageUrl},
                            {"text": prompt}
                        ]
                    }
                ]
            }
        })
    }
    const response = await fetch(url, options);

    return response;
};

const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const propmt = '请解答这道题';
const imageUrl = 'https://img.alicdn.com/imgextra/i1/O1CN01gDEY8M1W114Hi3XcN_!!6000000002727-0-tps-1024-406.jpg';
// Wrap the await code inside an async function
const main = async () => {
    try {
        const response = await resolveImage(url, propmt, imageUrl);
        console.log(response);
        
        // 处理response
        const reader = response.body;
        if (!reader) throw new Error('Failed to create a reader');

        const chunks = [];
        
        reader.on('readable', () => {
            let chunk;
            while (null !== (chunk = reader.read())) {
                chunks.push(chunk);
            }
        });
        
        reader.on('end', () => {
            const content = chunks.join('');
            console.log(content);
        });
    } catch (error) {
        console.error(error);
    }
};

// Call the async function
main();