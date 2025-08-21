<script setup lang="ts">
import { ref } from 'vue';
import { set, get } from 'jsonuri';

const question = ref('天空为什么是蓝色的？');
const content = ref({
  title: "",
  outline: [],
  content: [],
});

const update = async () => {
  if (!question) return;

  const endpoint = '/api/stream';

  const eventSource = new EventSource(`${endpoint}?question=${question.value}`);
  eventSource.addEventListener("message", function (e: any) {
    let { uri, delta } = JSON.parse(e.data);
    const str = get(content.value, uri);
    set(content.value, uri, (str || '') + delta);
  });
  eventSource.addEventListener('finished', () => {
    console.log('传输完成');
    eventSource.close();
  });
}
</script>

<template>
  <div class="container">
    <div>
      <label>输入：</label><input class="input" v-model="question" />
      <button @click="update">提交</button>
    </div>
    <div class="output">
      <!-- <textarea>{{ content }}</textarea> -->
      <h1>{{ content.title }}</h1>
      <div v-for="(item, i) in (content.outline as any)" :key="item.title + i">
        <h2>{{ item.title }}</h2>
        <p>{{ content.content[i] }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: start;
  height: 100vh;
  font-size: .85rem;
}

.input {
  width: 200px;
}

.output {
  margin-top: 10px;
  min-height: 300px;
  width: 100%;
  text-align: left;
}

button {
  padding: 0 10px;
  margin-left: 6px;
}

textarea {
  width: 300px;
  height: 200px;
  font-size: 10px;
}
</style>