import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Azoth JSX",
    description: "Azoth JSX UI library documentation",
    head: [['link', { rel: 'icon', href: '/azothjsx-ico.png' }]],
    themeConfig: {
        logo: '/azothjsx-ico.png',
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Examples', link: '/markdown-examples' }
        ],

        sidebar: [
            {
                text: 'Examples',
                items: [
                    { text: 'Markdown Examples', link: '/markdown-examples' },
                    { text: 'Runtime API Examples', link: '/api-examples' }
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/azothjsx/azoth' }
        ]
    }
})
