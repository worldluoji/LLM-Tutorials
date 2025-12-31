import { createApp } from 'vue'

import './style.css'
import App from './App.vue'
import { registerRouter } from './router/router.ts'

const app = createApp(App)

// Register router
registerRouter(app)

app.mount('#app')