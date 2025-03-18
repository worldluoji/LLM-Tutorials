# llama.cpp
llama.cpp 出现的背景是 2023 年 Meta 开源 Llama 系列大语言模型后，技术社区掀起了模型轻量化部署的热潮。Georgi Gerganov 这位来自保加利亚的天才程序员，采用纯 C/C++ 实现 Llama 模型的推理引擎，开创了消费级硬件运行大模型的新范式。

在性能优化方面，llama.cpp 充分挖掘了硬件的潜力。对于 Apple Silicon 设备，它利用 ARM NEON 指令集实现高效的并行计算；而在 x86 平台上，则通过 AVX2 指令集加速运算。同时，它还支持 F16 和 F32 混合精度计算，既保证了计算效率，又兼顾了模型精度。更值得一提的是，llama.cpp 引入了 4-bit 量化技术，使得模型体积大幅缩减，甚至可以在没有 GPU 的情况下，仅靠 CPU 就能流畅地运行大模型。

根据开发者提供的数据，在 M1 MacBook Pro 上运行 Llama-7B 模型时，每个 token 的推理时间仅需 60 毫秒，相当于每秒处理十多个 token。这样的速度对于本地化部署的大模型来说，已经相当可观。得益于纯 C/C++ 实现的高效性，llama.cpp 不仅能在 MacBook Pro 上运行，甚至可以在 Android 设备上流畅执行。

它是如何将庞大的模型装进有限的内存中的呢？答案正是量化技术

## 何为量化
在深度神经网络模型的开发流程中，结构设计完成后，训练阶段的核心任务是通过大量数据调整模型的权重参数。这些权重通常以浮点数的形式存储，常见的精度包括 16 位（FP16）、32 位（FP32）和 64 位（FP64）。

训练过程通常依赖 GPU 的强大算力来加速计算，但这也带来了较高的硬件需求。为了降低这些需求，量化技术应运而生。量化的原理呢，概括来说就是通过降低权重参数的精度，减少模型对计算资源和存储空间的要求，从而使其能够在更多设备上运行。

以 Llama 模型为例，其原始版本采用 16 位浮点精度（FP16）。一个包含 70 亿参数的 7B 模型，完整大小约为 14 GB。这意味着用户至少需要 14 GB 的显存才能加载和使用该模型。

通过量化技术，例如将权重精度从 16 位降至 4 位，7B 模型的大小可以压缩至约 4 GB，13B 模型则压缩至 8 GB 左右。这种显著的体积缩减使得这些大模型能够在消费级硬件上运行，普通用户也能在个人电脑上体验大模型的强大能力。

量化技术的核心在于权衡精度与效率。通过降低权重参数的精度，模型的计算量和存储需求大幅减少，但同时也可能引入一定的精度损失。因此，量化算法的设计需要在压缩率和模型性能之间找到最佳平衡点。


## 使用 llama.cpp 部署 DeepSeek
硬件准备好后，就需要准备 llama.cpp 工具了。llama.cpp 的使用可以通过源码进行编译，也可以使用作者编译好的 release 版本。链接如下：https://github.com/ggerganov/llama.cpp/releases

系统是 ubuntu22.04，因此选择的是 llama-b4707-bin-ubuntu-x64.zip。下载后，放到环境变量目录进行解压。ubuntu 系统解压到 /usr/local/llama  即可。

之后在 /etc/profile 文件配置一下环境变量，确保 llama.cpp 的二进制工具，可以在任意地方执行。
```
llama ls
```

如果你的系统没有装 gcc，需要装一下，否则会报找不到库的错误。
```
sudo apt install build-essential
gcc --version
```

最后还需要配置一下 lib 库的环境变量：
```
LD_LIBRARY_PATH=$(pwd):$LD_LIBRARY_PATH
```
这是因为 llama.cpp 自带了一堆 .so，需要能被引用到。


下一步是下载模型。需要下载适配好 llama.cpp 的 GGUF 版本，而不是 DeepSeek 的原版本。 GGUF 版本链接如下：https://www.modelscope.cn/models/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/files

我们选择 DeepSeek-R1-Distill-Qwen-7B-Q6_K_M.gguf 作为本次实验模型。等待下载完成后，便可以启动了。我们先来启动一个可以直接交互的版本：
```
llama-cli -m ./DeepSeek-R1-Distill-Qwen-7B-Q6_K_M.gguf -co -cnv -p "你 是 一 个 python编 程 专 家 " -n 512
```

既然服务器没有显存，那模型就只能占用内存了。我们看一下，这个模型占了多少内存。使用命令：
```
ps aux --sort=%mem
```

## 发布成 HTTP 服务
方法一：使用官方提供的命令启动
```
llama-server --model DeepSeek-R1-Distill-Qwen-7B-Q6_K_M.gguf
```
测试效果：
```shell
curl http://localhost:8080/v1/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "deepseek-r1",
        "prompt": "你好",
        "max_tokens": 1024,
        "temperature": 0
    }'
```

第二种方法：使用第三方库
```shell
apt install ninja-build


pip install uvicorn anyio starlette fastapi sse_starlette starlette_context pydantic_settings


pip install llama-cpp-python -i https://mirrors.aliyun.com/pypi/simple/ 
```
安装完成后再运行模型
```
python3 -m llama_cpp.server --model ./DeepSeek-R1-Distill-Qwen-7B-Q6_K_M.gguf
```
第三方库的好处在于兼容 OpenAI 数据格式，此时可以用 OpenAI 方式访问:
```shell
curl http://localhost:8000/v1/chat/completions \
-H "Content-Type: application/json" \
-d '{
        "messages": [
                {"role": "system", "content": "你是一个python专家"},
                {"role": "user", "content": "python的字典数据类型如何定义"}
        ]
}'
```