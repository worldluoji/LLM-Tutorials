<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
      <div class="glass-container bg-white backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-4xl relative border border-slate-100">
        <!-- Language Switch -->
        <div class="absolute top-4 right-4 flex gap-2">
          <button 
            v-for="lang in availableLangs"
            :key="lang"
            @click="setLanguage(lang)"
            class="lang-btn px-3 py-1 rounded-md text-sm font-medium transition-colors"
            :class="{
              'bg-cyan-100 text-cyan-600': currentLang === lang,
              'text-slate-500 hover:bg-slate-100': currentLang !== lang
            }"
          >
            {{ lang === 'en' ? 'EN' : '中文' }}
          </button>
        </div>
  
        <!-- Header -->
        <div class="flex items-center gap-4 mb-8">
          <img 
            src="./assets/video.png" 
            class="w-8 h-8 text-cyan-600"
          >
          <h1 class="text-2xl font-bold text-slate-800">
            {{ t('title') }}
          </h1>
        </div>
  
        <!-- Input Grid -->
        <div class="grid grid-cols-2 gap-8">
          <!-- Left Column -->
          <div class="space-y-6">
            <!-- Image URL Input -->
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-600">
                <img 
                  src="./assets/image.png" 
                  class="w-5 h-5 text-slate-500"
                >
                {{ t('imageUrl') }}
              </label>
              <input
                v-model="imageUrl"
                type="url"
                class="w-full px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 text-slate-700 placeholder-slate-400 transition-all"
                :placeholder="t('placeholderImage')"
              >
            </div>
  
            <!-- Prompt Textarea -->
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-600">
                <img 
                  src="./assets/edit.png" 
                  class="w-5 h-5 text-slate-500"
                >
                {{ t('videoPrompt') }}
              </label>
              <textarea
                v-model="videoPrompt"
                rows="4"
                class="w-full px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 text-slate-700 placeholder-slate-400 resize-none transition-all"
                :placeholder="t('placeholderPrompt')"
              ></textarea>
            </div>
          </div>
  
          <!-- Right Column -->
          <div class="space-y-6">
            <!-- Duration Selector -->
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-600">
                <img 
                  src="./assets/clock.png" 
                  class="w-5 h-5 text-slate-500"
                >
                {{ t('duration') }}
              </label>
              <div class="grid grid-cols-3 gap-3">
                <div 
                  v-for="duration in durations"
                  :key="duration"
                  class="relative"
                >
                  <input
                    v-model="selectedDuration"
                    type="radio"
                    :value="duration"
                    :id="`duration${duration}`"
                    class="peer absolute opacity-0"
                  >
                  <label
                    :for="`duration${duration}`"
                    class="block w-full py-3 text-center text-slate-700 bg-white rounded-lg border border-slate-200 cursor-pointer transition-all shadow-sm"
                    :class="{
                      'border-cyan-400 text-cyan-600 bg-cyan-50': selectedDuration === duration,
                      'hover:border-cyan-300': selectedDuration !== duration
                    }"
                  >
                    {{ t(`${duration}s`) }}
                  </label>
                </div>
              </div>
            </div>
  
            <!-- Preview Box -->
            <div class="aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden relative">
              <div 
                v-show="showPlaceholder"
                class="absolute inset-0 flex flex-col items-center justify-center transition-all"
              >
                <img 
                  src="./assets/image.png" 
                  class="w-8 h-8 mx-auto mb-2 opacity-40"
                >
                <span class="text-sm text-slate-400">
                  {{ t('preview') }}
                </span>
              </div>
              <img 
                v-show="!showPlaceholder"
                :src="previewImageUrl"
                class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              >
              <div 
                v-show="isLoading"
                class="absolute inset-0 bg-white/80 flex items-center justify-center"
              >
                <svg 
                  class="animate-spin h-8 w-8 text-cyan-500" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    class="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    stroke-width="4"
                  ></circle>
                  <path 
                    class="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
  
        <!-- Generate Button -->
        <button 
          @click="generateVideo"
          class="w-full mt-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg text-white font-semibold hover:from-cyan-600 hover:to-cyan-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-100"
        >
          <img 
            src="./assets/sparkle.png" 
            class="w-5 h-5"
          >
          <span>{{ t('generate') }}</span>
        </button>

        <!--output video-->
        <div class="mt-8">
            <div v-if="videoUrl">
                <video controls width="500">
                <source :src="videoUrl" type="video/mp4" />

                Download the
                <a :href="videoUrl">MP4</a>
                video.
                </video>
            </div>
            <div v-else>
                {{ msg }}
            </div>
        </div>

      </div>
    </div>
  </template>
  
<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  
  type Lang = 'en' | 'zh'
  type Translations = Record<Lang, Record<string, string>>
  
  const translations: Translations = {
    en: {
      title: 'Image to Video Generator',
      imageUrl: 'Image URL',
      videoPrompt: 'Video Prompt',
      duration: 'Video Duration',
      '3s': '3s',
      '4s': '4s',
      '5s': '5s',
      preview: 'Image Preview',
      generate: 'Generate Video',
      placeholderImage: 'Paste image URL...',
      placeholderPrompt: 'Describe your video...'
    },
    zh: {
      title: '图片转视频生成器',
      imageUrl: '图片链接',
      videoPrompt: '视频描述',
      duration: '视频时长',
      '3s': '3秒',
      '4s': '4秒',
      '5s': '5秒',
      preview: '图片预览',
      generate: '生成视频',
      placeholderImage: '粘贴图片链接...',
      placeholderPrompt: '输入视频描述...'
    }
  }
  
  // 响应式状态
  const currentLang = ref<Lang>('en')
  const availableLangs: Lang[] = ['en', 'zh']
  const durations = [3, 4, 5]
  
  const imageUrl = ref('')
  const videoPrompt = ref('A lovely rabbit')
  const selectedDuration = ref(3)
  const previewImageUrl = ref('')
  const isLoading = ref(false)
  const showPlaceholder = ref(true)

  const videoUrl = ref('');
  const msg = ref('');
  
  // 国际化方法
  const t = computed(() => (key: string) => translations[currentLang.value][key] || key)
  
  // 语言切换
  const setLanguage = (lang: Lang) => {
    currentLang.value = lang
    localStorage.setItem('lang', lang)
  }
  
  
  // 图片预览逻辑
  watch(imageUrl, async (newUrl) => {
    if (!newUrl) {
      showPlaceholder.value = true
      previewImageUrl.value = ''
      return
    }
  
    try {
      isLoading.value = true
      showPlaceholder.value = false
      
      const img = new Image()
      img.src = newUrl
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      
      previewImageUrl.value = newUrl
    } catch {
      showPlaceholder.value = true
    } finally {
      isLoading.value = false
    }
  })
  

const generateVideo = async () => {
  msg.value = '视频生成需要几分钟...请耐心等待';
  const endpoint = `/api/v1/services/aigc/video-generation/video-synthesis`;
  const payload = {
    model: "wanx2.1-i2v-turbo",
    input: {
      prompt: videoPrompt.value,
      img_url: imageUrl.value
    },
    parameters: {
      "resolution": "720P",
      "prompt_extend": true,
      "duration": selectedDuration.value,
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
  
  // 初始化语言
  onMounted(() => {
    const savedLang = localStorage.getItem('lang') as Lang | null
    if (savedLang && availableLangs.includes(savedLang)) {
      currentLang.value = savedLang
    }
  })
</script>
  
<style>
@import "tailwindcss";
</style>