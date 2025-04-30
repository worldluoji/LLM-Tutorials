<script setup lang="ts">
import { ref } from 'vue';

const prompt = ref('A lovely rabbit');
const videoUrl = ref('');
const imageUrl = ref('');
const msg = ref('');

const generateVideo = async () => {
  msg.value = '视频生成需要几分钟...请耐心等待';
  const endpoint = `/api/v1/services/aigc/video-generation/video-synthesis`;
  const payload = {
    model: "wanx2.1-i2v-turbo",
    input: {
      prompt: prompt.value,
      img_url: imageUrl.value
    },
    parameters: {
      "resolution": "720P",
      "prompt_extend": true
    }
  };

  const headers = {
    'X-DashScope-Async': 'enable',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + import.meta.env.VITE_ALI_API_KEY,
  };

  const res = await fetch(`${endpoint}`, {
    headers,
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const task_id = (await res.json()).output?.task_id;
  const resultUrl = `/api/v1/tasks/${task_id}`;
  do {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    const result = await fetch(resultUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + import.meta.env.VITE_ALI_API_KEY,
      }
    });

    const resultJson = await result.json();
    if (!resultJson.output) {
      continue;
    }

    if (resultJson.output.task_status === 'PENDING' || resultJson.output.task_status === 'RUNNING') {
      continue;
    }

    if (resultJson.output.task_status !== 'SUCCEEDED') {
      msg.value = '视频生成失败';
      break;
    }

    const sample = resultJson.output.video_url;
    if (sample) {
      videoUrl.value = sample;
    }
    break;
  } while (1);
};
</script>

<template>
  <div class="container">
    <div>
      <label>Prompt </label>
      <button @click="generateVideo">Generate</button>
      <textarea class="input" type="text" v-model="prompt" />
      <input type="text" v-model="imageUrl" />
    </div>

    <div class="output">
      <div v-if="videoUrl">
        <video controls width="250">
          <source src="/shared-assets/videos/flower.mp4" type="video/mp4" />

          Download the
          <a href="/shared-assets/videos/flower.mp4">MP4</a>
          video.
        </video>
      </div>
      <div  v-else>
        {{ msg }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.input {
  width: 100%;
  height: 2rem;
  font-size: 1rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: start;
  height: 100vh;
}

.output {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  border: 1px solid #ccc;
}

.output > img {
  width: 100%;
}
</style>