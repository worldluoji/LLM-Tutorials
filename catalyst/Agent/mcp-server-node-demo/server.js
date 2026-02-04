import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'example-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// 工具定义
const tools = [
  {
    name: 'calculate',
    description: '执行数学计算',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学表达式，如: 2+2, 3 * 4, 10/2',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'get_weather',
    description: '获取城市天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称，如: Beijing, Shanghai',
        },
        days: {
          type: 'number',
          description: '预报天数 (1-3)',
          default: 1,
        },
      },
      required: ['city'],
    },
  },
  {
    name: 'web_search',
    description: '在互联网上搜索信息',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询',
        },
        max_results: {
          type: 'number',
          description: '最大结果数',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
];

// 资源定义
const resources = [
  {
    uri: 'example://notes',
    name: '示例笔记',
    description: '示例笔记资源',
    mimeType: 'text/plain',
  },
  {
    uri: 'example://config',
    name: '服务器配置',
    description: '服务器配置信息',
    mimeType: 'application/json',
  },
];

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// 处理资源列表请求
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources,
}));

// 处理读取资源请求
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  switch (uri) {
    case 'example://notes':
      return {
        contents: [
          {
            uri: 'example://notes',
            mimeType: 'text/plain',
            text: `# 示例笔记

这是示例笔记内容。

## 今日待办
1. 完成MCP服务器开发
2. 测试工具功能
3. 编写文档

## 笔记
这是一个简单的MCP服务器示例，展示了如何创建工具和资源。`,
          },
        ],
      };
      
    case 'example://config':
      return {
        contents: [
          {
            uri: 'example://config',
            mimeType: 'application/json',
            text: JSON.stringify({
              serverName: 'Example MCP Server',
              version: '1.0.0',
              features: ['tools', 'resources'],
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
      
    default:
      throw new Error(`Resource not found: ${uri}`);
  }
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'calculate': {
      const { expression } = args;
      let result;
      
      try {
        // 安全地计算表达式
        result = eval(expression);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `计算错误: ${error.message}`,
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `表达式: ${expression}\n结果: ${result}`,
          },
        ],
      };
    }
    
    case 'get_weather': {
      const { city, days = 1 } = args;
      
      // 模拟天气数据
      const weatherData = {
        Beijing: { temp: '22°C', condition: 'Sunny', humidity: '45%' },
        Shanghai: { temp: '25°C', condition: 'Cloudy', humidity: '65%' },
        'New York': { temp: '18°C', condition: 'Rainy', humidity: '80%' },
        London: { temp: '15°C', condition: 'Foggy', humidity: '75%' },
      };
      
      const forecast = weatherData[city] || { 
        temp: '20°C', 
        condition: 'Clear', 
        humidity: '50%' 
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `🌤️  ${city} 天气\n` +
                  `温度: ${forecast.temp}\n` +
                  `天气: ${forecast.condition}\n` +
                  `湿度: ${forecast.humidity}\n` +
                  `预报天数: ${days}天`,
          },
        ],
      };
    }
    
    case 'web_search': {
      const { query, max_results = 5 } = args;
      
      // 模拟搜索结果
      const results = Array.from({ length: max_results }, (_, i) => ({
        title: `搜索结果 ${i + 1}: ${query}`,
        url: `https://example.com/result${i + 1}`,
        snippet: `这是关于"${query}"的第${i + 1}个搜索结果。这是一个示例MCP服务器提供的模拟数据。`,
      }));
      
      return {
        content: [
          {
            type: 'text',
            text: `🔍 搜索查询: "${query}"\n\n` +
                  results.map((r, i) => 
                    `${i + 1}. ${r.title}\n   链接: ${r.url}\n   描述: ${r.snippet}\n`
                  ).join('\n'),
          },
        ],
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 错误处理
server.onerror = (error) => {
  console.error('[MCP Server Error]', error);
};

// 关闭处理
server.onclose = () => {
  process.exit(0);
};

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});