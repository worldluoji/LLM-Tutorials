<script setup lang="ts">
import { ref } from 'vue';

const question = ref('讲一个关于狄仁杰探案的故事');
const content = ref('');
const stream = ref(true);

const update = async () => {
  if(!question) return;
  content.value = "思考中...";

  const endpoint = '/api/stream';

  if(stream.value) {
    const eventSource = new EventSource(`${endpoint}?question=${question.value}`);
    eventSource.addEventListener("message", function(e: any) {
      content.value += e.data;
    });
    eventSource.addEventListener('end', () => {
      eventSource.close();
    });
  }
}
</script>

<template>
  <div class="container">
    <div>
      <label>输入：</label><input class="input" v-model="question" />
      <button @click="update">提交</button>
    </div>
    <div class="output">
      <div><label>Streaming</label><input type="checkbox" v-model="stream"/></div>
      <div>{{ content }}</div>
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
</style>