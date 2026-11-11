import { withEve } from 'eve/vercel'

// One Vercel project, two services: the Vite page ("web") and Pip, the eve agent in ./agent.
// withEve adds the agent service and routes /eve/v1/* to it ahead of the route below.
export default await withEve({
  // Firewall rate-limit counters are per region, so the whole project runs in one.
  regions: ['iad1'],
  services: {
    web: {
      framework: 'vite',
      root: '.',
      buildCommand: 'npm run build:web',
      outputDirectory: 'dist',
    },
  },
  routes: [
    // Accounts, saved programs and progress are served by the agent service (agent/channels/account.ts).
    { src: '^/api/(.*)$', destination: { type: 'service', service: 'eve' } },
    { src: '^(.*)$', destination: { type: 'service', service: 'web' } },
  ],
})
