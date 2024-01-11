import * as path from 'path';
import { defineConfig } from 'rspress/config';
import { pluginPlayground } from '@rspress/plugin-playground';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: '前端小册',
  description: 'Time To Coding',
  icon: '/rspress-icon.png',
  globalStyles: path.join(__dirname, 'styles/global.css'),
  logo: {
    light: '/rspress-light-logo.png',
    dark: '/rspress-dark-logo.png',
  },
  markdown: {
    showLineNumbers: true
  },
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/web-infra-dev/rspress' },
    ],
  },
  plugins: [pluginPlayground()],
});
