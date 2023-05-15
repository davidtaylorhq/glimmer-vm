/// <reference types="vite/client" />

import { createReplacePlugin } from './replace.js';

const MODE = process.env['MODE'] ?? 'development';
const DEV = MODE === 'development';
const PROD = MODE === 'production';

export default createReplacePlugin(
  (id) => /\.[jt]sx?$/u.test(id),
  {
    'import.meta.env.MODE': process.env['MODE'] ?? 'development',
    'import.meta.env.DEV': DEV ? 'true' : 'false',
    'import.meta.env.PROD': PROD ? 'true' : 'false',
  },
  true
);
