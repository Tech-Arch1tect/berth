/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.tsx' {
  const component: React.ComponentType<any>;
  export default component;
}