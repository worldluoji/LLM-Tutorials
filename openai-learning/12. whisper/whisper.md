# Whisper
OpenAI 发表了一个通用的语音识别模型 Whisper，还把对应的代码开源了。在今年的 1 月份，他们也在 API 里提供了对应的语音识别服务。


OpenAI 提供的 Whisper 的 API 非常简单，你只要调用一下 transcribe 函数，就能将音频文件转录成文字:
```
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

audio_file = open("./data/podcast_clip.mp3", "rb")
transcript = client.audio.transcriptions.create(model="whisper-1", file=audio_file)
print(transcript.text)
```

解决标点符号问题, 增加prompt即可：
```
audio_file = open("./data/podcast_clip.mp3", "rb")
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    prompt="这是一段中文播客内容。",
)
print(transcript.text)
```

能够在音频内容的转录之前提供一段 Prompt，来引导模型更好地做语音识别，是 Whisper 模型的一大亮点。
如果你觉得音频里面会有很多专有名词，模型容易识别错，你就可以在 Prompt 里加上对应的专有名词。
比如，在上面的内容转录里面，模型就把 ChatGPT 也听错了，变成了 ChatGBT。
Google 的 PaLM 模型（现已并入 Gemini 系列）也给听错了，听成了 POM。对应的全称 Pathways Language Model 也少了一个 s。
而针对这些错漏，我们只要再修改一下 Prompt，它就能够转录正确了。

```
audio_file = open("./data/podcast_clip.mp3", "rb")
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    prompt="这是一段Onboard播客，里面会聊到ChatGPT以及PALM这个大语言模型。这个模型也叫做Pathways Language Model。",
)
print(transcript.text)
```

Whisper 的模型是一个和 GPT 类似的模型，会用前面转录出来的文本去预测下一帧音频的内容。
通过在最前面加上文本 Prompt，就会影响后面识别出来的内容的概率，也就是能够起到给专有名词“纠错”的作用。

除了模型名称、音频文件和 Prompt 之外，transcribe 接口还支持这样三个参数。
- response_format，也就是返回的文件格式，我们这里是默认值，也就是 JSON。实际你还可以选择 TEXT 这样的纯文本，或者 SRT 和 VTT 这样的音频字幕格式。这两个格式里面，除了文本内容，还会有对应的时间信息，方便你给视频和音频做字幕。你可以直接试着运行一下看看效果。
- temperature，这个和我们之前在 ChatGPT 类型模型里的参数含义类似，就是采样下一帧的时候，如何调整概率分布。这里的参数范围是 0-1 之间。
- language，就是音频的语言。提前给模型指定音频的语言，有助于提升模型识别的准确率和速度。

<br>

## 转录的时候顺便翻译一下
除了基本的音频转录功能，Whisper 的 API 还额外提供了一个叫做 translation 的接口。这个接口可以在转录音频的时候直接把语音翻译成英文。
```
audio_file = open("./data/podcast_clip.mp3", "rb")
translated_prompt = """This is a podcast discussing ChatGPT and PaLM model. 
The full name of PaLM is Pathways Language Model."""
transcript = client.audio.translations.create(
    model="whisper-1",
    file=audio_file,
    prompt=translated_prompt,
)
print(transcript.text)
```
这个接口只能把内容翻译成英文，不能变成其他语言。所以对应的，Prompt 也必须换成英文。只能翻译成英文对我们来说稍微有些可惜了。如果能够指定翻译的语言，很多英文播客，我们就可以直接转录成中文来读了。现在我们要做到这一点，就不得不再花一份钱，让 ChatGPT 来帮我们翻译。

<br>

## 通过开源模型直接在本地转录
通过 OpenAI 的 Whisper API 来转录音频是有成本的。0.006 美元 / 分钟为 2023 年的早期定价，2026 年实际价格请以 [OpenAI 官方定价页](https://openai.com/api/pricing/) 为准（按音频时长计费，并设有免费额度）。
比如我们上面的 150 分钟的音频文件，只需要不到 1 美元，其实已经很便宜了。
不过，如果你不想把对应的数据发送给 OpenAI，避免任何数据泄露的风险，你还有另外一个选择，那就是直接使用 OpenAI 开源出来的模型就好了。
不过使用开源模型你还是需要一块 GPU。

安装依赖包
```
pip install openai-whisper
pip install setuptools-rust
```

本地使用whisper:
```
import whisper

model = whisper.load_model("large")
index = 11 # number of fi
  
def transcript(clip, prompt, output):
    result = model.transcribe(clip, initial_prompt=prompt)
    with open(output, "w") as f:
        f.write(result['text'])
    print("Transcripted: ", clip)

original_prompt = "这是一段Onboard播客，里面会聊到ChatGPT以及PALM这个大语言模型。这个模型也叫做Pathways Language Model。\n\n"
prompt = original_prompt
for i in range(index):
    clip = f"./drive/MyDrive/colab_data/podcast/podcast_clip_{i}.mp3"
    output = f"./drive/MyDrive/colab_data/podcast/transcripts/local_podcast_clip_{i}.txt"
    transcript(clip, prompt, output)
    # get last sentence of the transcript
    with open(output, "r") as f:
        transcript = f.read()
    sentences = transcript.split("。")
    prompt = original_prompt + sentences[-1]
```
whisper项目地址: https://github.com/openai/whisper


<br>

## 分割大文件
我们没法把整个 150 分钟的播客一次性转录出来，因为 OpenAI 限制 Whisper 一次只能转录 25MB 大小的文件。所以我们要先把大的播客文件分割成一个个小的片段，转录完之后再把它们拼起来。我们可以选用 OpenAI 在官方文档里面提供的 PyDub 的库来分割文件。
```
pip install -U pydub
```

分割音频：
```
from pydub import AudioSegment

podcast = AudioSegment.from_mp3("./data/podcast_long.mp3")

# PyDub handles time in milliseconds
ten_minutes = 15 * 60 * 1000

total_length = len(podcast)

start = 0
index = 0
while start < total_length:
    end = start + ten_minutes
    if end < total_length:
        chunk = podcast[start:end]
    else:
        chunk = podcast[start:]
    with open(f"./data/podcast_clip_{index}.mp3", "wb") as f:
        chunk.export(f, format="mp3")
    start = end
    index += 1
```