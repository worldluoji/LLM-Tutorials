import os
import pandas as pd
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

dynasties = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋', '南北朝']
super_powers = ['隐形', '飞行', '读心术', '瞬间移动', '不死之身', '喷火']
story_types = ['轻松', '努力', '艰难']


def gpt35(prompt, max_tokens=2048, temperature=0.5, top_p=1, frequency_penalty=0, presence_penalty=0):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是一位中文故事创作者。"},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        frequency_penalty=frequency_penalty,
        presence_penalty=presence_penalty,
    )
    return completion.choices[0].message.content


# 我们定义了一系列朝代、超能力和故事的类型。然后通过三重循环，让 AI 根据这三者的组合来生成一系列故事。
# 这些生成出来的故事，也就构成了我们用来微调模型的训练数据。
# 因为数据量不大，我就直接用 CSV 把它存下来了。在这个过程中，数据是一条条生成的，比较慢，也比较消耗 Token
def prepare_stories(dynasties, super_powers, story_types, output_file="data/ultraman_stories.csv"):
    df = pd.DataFrame()
    repeat = 3
    for dynasty in dynasties:
        for super_power in super_powers:
            for story_type in story_types:
                for i in range(repeat):
                    prompt = f"""请你用中文写一段300字的故事，情节跌宕起伏，讲述一位{dynasty}朝时期的英雄人物，穿越到现代，拥有了{super_power}这样的超能力，通过{story_type}的战斗，帮助奥特曼一起打败了怪兽的故事。"""
                    story = gpt35(prompt)
                    row = {"dynasty": dynasty, "super_power": super_power, "story_type": story_type, "story": story}
                    row = pd.DataFrame([row])
                    df = pd.concat([df, row], axis=0, ignore_index=True)

    df.to_csv("data/ultraman_stories.csv")

# prepare_stories(dynasties, super_powers, story_types)


# 把对应的 CSV 格式的数据转换成微调模型所需要的 JSONL 格式的文件
df = pd.read_csv("data/ultraman_stories.csv")
# 对于微调，我们使用的 Prompt 不再是一个完整的句子，而是只用了"朝代"+"超能力"+"故事类型"拼接在一起的字符串，中间用逗号隔开
df['sub_prompt'] = df['dynasty'] + "," + df['super_power'] + "," + df['story_type']
prepared_data = df.loc[:, ['sub_prompt', 'story']]
prepared_data.rename(columns={'sub_prompt': 'prompt', 'story': 'completion'}, inplace=True)
prepared_data.to_csv('data/prepared_data.csv', index=False)


# OpenAI 在 2024 年下线了 `openai tools fine_tunes.prepare_data` 与 `openai api fine_tunes.*` 命令行工具；
# 现在数据准备需要在 Python 端自行转 JSONL 并通过 SDK 提交训练任务。下方代码演示了如何：
#   1) 将 prepared_data.csv 转成 {"messages": [...]} 格式的 JSONL；
#   2) 使用 SDK 提交 fine_tuning.jobs.create（替代 `openai api fine_tunes.create`）。
import json

def to_chat_jsonl(csv_path, jsonl_path):
    """转成 OpenAI Chat Fine-tuning 所需的 JSONL：每行 {"messages": [...]}。"""
    src = pd.read_csv(csv_path)
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for _, row in src.iterrows():
            entry = {
                "messages": [
                    {"role": "user", "content": str(row["prompt"])},
                    {"role": "assistant", "content": str(row["completion"])},
                ]
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


to_chat_jsonl('data/prepared_data.csv', 'data/prepared_data.jsonl')


# 提交微调任务（替代 `openai api fine_tunes.create`）。
# 注意：当前 OpenAI 已不再支持 curie 等旧基础模型微调，下方仅示意流程；实际请改为 gpt-4o-mini-2024-07-18 等支持微调的模型。
def submit_finetune(training_file, model="gpt-4o-mini-2024-07-18", suffix="ultraman"):
    with open(training_file, "rb") as f:
        uploaded = client.files.create(file=f, purpose="fine-tune")
    job = client.fine_tuning.jobs.create(
        training_file=uploaded.id,
        model=model,
        suffix=suffix,
        hyperparameters={"learning_rate_multiplier": 0.2},
    )
    return job


# job = submit_finetune('data/prepared_data.jsonl')
# print("Submitted fine-tuning job:", job.id)
# 通过 client.fine_tuning.jobs.list() 替代 `openai api fine_tunes.list`
# 通过 client.fine_tuning.jobs.retrieve(job.id) 获取单次任务详情（替代 `openai api fine_tunes.results -i <id>`）


# 微调后模型的使用方法（替代原 `model="curie:ft-..."` 的调用方式）
def write_a_story(prompt, model_id):
    completion = client.chat.completions.create(
        model=model_id,
        messages=[
            {"role": "system", "content": "你是一位中文故事创作者。"},
            {"role": "user", "content": prompt + " ->\n"},
        ],
        temperature=0.7,
        max_tokens=2000,
        top_p=1,
        stop=["."],
    )
    return completion.choices[0].message.content


# story = write_a_story("宋,发射激光,艰难", "ft:gpt-4o-mini-2024-07-18:your-org::ultraman-XXXX")
# print(story)
