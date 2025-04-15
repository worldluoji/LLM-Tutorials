<script setup lang="ts">
import { ref } from 'vue';

const prompt = ref('A lovely rabbit');
const imgUrl = ref('');

const generateImage = async () => {
  const endpoint = `/api/v1/services/aigc/text2image/image-synthesis`;
  const payload = {
    model: "wanx2.1-t2i-turbo",
    input: {
      prompt: prompt.value,
    },
    parameters: {
      "size": "1024*1024",
      "n": 1
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
  imgUrl.value = 'https://res.bearbobo.com/resource/upload/a3IZyOsZ/loading-giaz5ycpd7j.gif';
  do {
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

    const sample = resultJson.output.results[0]?.url;
    if (sample) {
      imgUrl.value = sample;
    } else {
      imgUrl.value = 'https://res.bearbobo.com/resource/upload/vNg4ALJv/6659895-ox36cbkajrr.png';
    }
    break;
  } while (1);
};
</script>

<template>
  <div class="container">
    <div>
      <label>Prompt </label>
      <button @click="generateImage">Generate</button>
      <textarea class="input" type="text" v-model="prompt" />
    </div>

    <div class="output">
      <img :src="imgUrl" />
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