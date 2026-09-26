// esbuild `inject` entry: every free `Buffer` in the renderer bundle binds here
export { Buffer } from 'buffer'
