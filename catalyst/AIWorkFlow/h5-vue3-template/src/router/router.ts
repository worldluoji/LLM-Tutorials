import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

import type { App } from 'vue'

// Define route components (lazy loading recommended for better performance)
const Home = () => import('@/views/Home.vue')
const About = () => import('@/views/About.vue')

// Define routes
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  // Add more routes as needed
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/'
  }
]

// Create router instance with history mode
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Function to register router to the app
export const registerRouter = (app: App): void => {
  app.use(router)
}

export default router