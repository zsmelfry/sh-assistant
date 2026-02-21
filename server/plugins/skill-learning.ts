// Ensure all skill configurations are registered at server startup.
// Side-effect imports in index.ts may be tree-shaken by Nitro/Vite,
// so we explicitly import here to guarantee registration.
import '~/server/lib/skill-learning/skills/startup-map';

export default defineNitroPlugin(() => {
  // Skills are registered via the side-effect import above.
});
