/* eslint-disable no-console */
// @ts-check

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rollupTS from 'rollup-plugin-ts';
import ts from 'typescript';

import importMeta from './import-meta.js';
import inline from './inline.js';
import terser from '@rollup/plugin-terser';
import { entries } from './utils.js';
import { inspect } from 'node:util';

// eslint-disable-next-line import/no-named-as-default-member
const { ModuleKind, ModuleResolutionKind, ScriptTarget, ImportsNotUsedAsValues } = ts;

const { default: commonjs } = await import('@rollup/plugin-commonjs');
const { default: nodeResolve } = await import('@rollup/plugin-node-resolve');
const { default: postcss } = await import('rollup-plugin-postcss');
const { default: nodePolyfills } = await import('rollup-plugin-polyfill-node');
const { default: fonts } = await import('unplugin-fonts/vite');
const { default: bundleSize } = await import('rollup-plugin-bundle-size');

/** @typedef {import("typescript").CompilerOptions} CompilerOptions */
/** @typedef {import("./config.js").ExternalOption} ExternalOption */
/** @typedef {import("./config.js").PackageInfo} PackageInfo */
/** @typedef {import("./config.js").PackageJSON} PackageJSON */
/** @typedef {import("./config.js").PackageJsonInline} PackageJsonInline */
/** @typedef {import("rollup").Plugin} RollupPlugin */
/** @typedef {import("rollup").RollupOptions} RollupOptions */
/**
 * @typedef {import("./config.js").ViteConfig} ViteConfig
 * @typedef {import("./config.js").JsonValue} JsonValue
 * @typedef {import("./config.js").JsonObject} JsonObject
 * @typedef {import("./config.js").JsonArray} JsonArray
 * @typedef {import("./config.js").PackageJSON} PackageJson
 * @typedef {import('./config.js').WorkspaceConfig} WorkspaceConfig
 * @typedef {import('./config.js').ExternalConfig} ExternalConfig
 * @typedef {import('./config.js').ExternalSpecifier} ExternalSpecifier
 */

/**
 * The package should be inlined into the output. In this situation, the `external` function should
 * return `false`. This is the default behavior.
 */
const INLINE = false;

/**
 * The package should be treated as an external dependency. In this situation, the `external` function
 * should return `true`. This is unusual and should be used when:
 *
 * - The package is a "helper library" (such as tslib) that we don't want to make a real dependency
 *   of the published package.
 * - (for now) The package doesn't have good support for ESM (i.e. `type: module` in package.json)
 *   but rollup will handle it for us.
 */
const EXTERNAL = true;

/**
 * @param {CompilerOptions} updates
 * @returns {CompilerOptions}
 */
export function tsconfig(updates) {
  return {
    declaration: true,
    declarationMap: true,
    verbatimModuleSyntax: true,
    noErrorTruncation: true,
    module: ModuleKind.NodeNext,
    moduleResolution: ModuleResolutionKind.NodeNext,
    experimentalDecorators: true,
    removeComments: false,
    ...updates,
  };
}

/**
 * @param {PackageInfo} pkg
 * @param {Partial<CompilerOptions>} [config]
 * @returns {RollupPlugin}
 */
export function typescript(pkg, config) {
  const typeScriptConfig = {
    ...config,
    paths: {
      '@glimmer/interfaces': [resolve(pkg.root, '../@glimmer/interfaces/index.d.ts')],
      '@glimmer/*': [resolve(pkg.root, '../@glimmer/*/src/dist/index.d.ts')],
    },
  };

  /** @type {[string, object][]} */
  const presets = [['@babel/preset-typescript', { allowDeclareFields: true }]];

  const ts = tsconfig(typeScriptConfig);

  return rollupTS({
    transpiler: 'babel',
    transpileOnly: true,
    babelConfig: { presets },

    tsconfig: ts,
  });
}

/**
 *
 * @param {ExternalSpecifier | undefined} specified
 * @returns {readonly string[]}
 */
function normalizeExternalsSpecifier(specified) {
  if (specified === undefined) {
    return [];
  } else if (typeof specified === 'string') {
    return [specified];
  } else {
    return specified;
  }
}

/** @type {Record<string, ExternalConfig>} */
const PRESETS = {
  'workspace:recommended': {
    inline: {
      is: ['tslib'],
      startsWith: ['.', '/', '#', '@babel/runtime/'],
    },
    external: {
      startsWith: ['@babel/', 'node:'],
    },
  },
};

// const EXTERNAL_OPTIONS = /** @type {const} */ ({
//   inline: {
//     is: ['@glimmer/local-debug-flags', '@glimmer/debug', '@glimmer/util', '@glimmer/vm'],
//     startsWith: ['.', '/', '#', '@babel/runtime/'],
//     endsWith: ['-debug-strip'],
//   },
//   external: {
//     is: ['@handlebars/parser', 'simple-html-tokenizer', 'babel-plugin-debug-macros'],
//     startsWith: ['@glimmer/', '@simple-dom/', '@babel/', 'node:'],
//   },
// });

/**
 * @param {Package} pkg
 * @returns {(id: string) => boolean | null}
 */
const matchExternals = (pkg) => (id) => matchExternalsWithPackage(id, pkg);

/**
 * @param {string} id
 * @param {Package} pkg
 * @returns {boolean | null}
 */
function matchExternalsWithPackage(id, pkg) {
  /** @type {ExternalConfig[]} */
  const presets = (pkg.workspace?.presets ?? ['workspace:recommended']).map(
    (preset) => PRESETS[preset]
  );

  let inline = pkg.workspace?.inline;

  if (inline) {
    let result = matchExternalsEntry(id, 'inline', inline);
    if (result !== null) return result;
  }

  let external = pkg.workspace?.external;

  if (external) {
    let result = matchExternalsEntry(id, 'external', external);
    if (result !== null) return result;
  }

  for (const preset of presets) {
    let result = matchExternalsConfig(id, preset);
    if (result !== null) return result;
  }

  return null;
}

/**
 * @param {string} id
 * @param {ExternalConfig} externalsConfig
 * @returns {boolean | null}
 */
function matchExternalsConfig(id, externalsConfig) {
  for (const [kind, config] of entries(externalsConfig)) {
    let result = matchExternalsEntry(id, kind, config);
    if (result !== null) return result;
  }

  return null;
}

/**
 * @param {string} id
 * @param {"inline" | "external"} kind
 * @param {import('./config.js').ExternalsConfig} config
 * @returns {boolean | null}
 */
function matchExternalsEntry(id, kind, config) {
  if (config !== undefined) {
    // console.dir({ verifying: { id, externalsConfig } }, { depth: null });
    for (const entry of entries(config)) {
      if (entry === undefined) continue;
      let [operator, patterns] = entry;
      let result = match(id, operator, normalizeExternalsSpecifier(patterns));

      if (result) {
        return kind === 'inline' ? INLINE : EXTERNAL;
      }
    }
  }

  return null;
}

/**
 * @template {readonly string[]} Prefixes
 * @param {string} id
 * @param {'is' | 'startsWith' | 'endsWith'} operator
 * @param {Prefixes} prefixes
 */
function match(id, operator, prefixes) {
  return prefixes.some((prefix) => {
    switch (operator) {
      case 'is':
        return normalizeIsPattern(prefix)(id);
      case 'startsWith':
        return id.startsWith(prefix);
      case 'endsWith':
        return id.endsWith(prefix);
    }
  });
}

/**
 * @param {string} pattern
 * @returns {(input: string) => boolean}
 */
function normalizeIsPattern(pattern) {
  if (pattern.includes('*')) {
    let regexp = new RegExp(`^${pattern.replace('*', '.*')}$`, 'u');
    return (string) => regexp.test(string);
  } else {
    return (string) => string === pattern;
  }
}

/**
 */

/**
 * @implements {PackageInfo}
 */
export class Package {
  /**
   * @param {ImportMeta} meta
   * @returns {string}
   */
  static root(meta) {
    const dir = fileURLToPath(meta.url);
    return dirname(resolve(dir));
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {Package | undefined}
   */
  static at(meta) {
    const root = typeof meta === 'string' ? meta : Package.root(meta);

    /** @type {PackageJSON} */
    const json = parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    if (json.main) {
      return new Package(
        {
          name: json.name,
          main: resolve(root, json.main),
          root,
        },
        json
      );
    } else {
      for (const main of ['index.ts', 'index.js', 'index.d.ts']) {
        const path = resolve(root, main);
        if (existsSync(path)) {
          return new Package(
            {
              name: json.name,
              main: path,
              root,
            },
            json
          );
        }
      }

      console.warn(`No main entry point found for ${json.name} (in ${root})`);
    }
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {import("./config.js").RollupExport}
   */
  static config(meta) {
    const pkg = Package.at(meta);

    if (pkg) {
      return pkg.config();
    } else {
      return [];
    }
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {Promise<ViteConfig>}
   */
  static async viteConfig(meta) {
    const pkg = Package.at(meta);

    if (pkg) return pkg.#viteConfig();

    throw Error(`No package found at ${typeof meta === 'string' ? meta : Package.root(meta)}`);
  }

  /** @readonly @type {PackageInfo} */
  #package;

  /** @readonly @type {PackageJSON} */
  #packageJSON;

  /***
   * @param {PackageInfo} pkg
   * @param {PackageJSON} packageJSON
   */
  constructor(pkg, packageJSON) {
    this.#package = pkg;
    this.#packageJSON = packageJSON;
  }

  /**
   * @returns {WorkspaceConfig | undefined}
   */
  get workspace() {
    return this.#packageJSON.publishConfig?.workspace;
  }

  /**
   * @returns {string}
   */
  get name() {
    return this.#package.name;
  }

  /**
   * @returns {string}
   */
  get root() {
    return this.#package.root;
  }

  /**
   * @returns {string}
   */
  get main() {
    return this.#package.main;
  }

  /**
   * @returns {import("rollup").RollupOptions[] | import("rollup").RollupOptions}
   */
  config() {
    if (process.env.MODE === 'production') {
      return this.rollupESM('production');
    } else {
      return [...this.rollupESM('development'), ...this.rollupCJS()];
    }
  }

  /**
   * @returns {Promise<import("./config.js").ViteConfig>}
   */
  async #viteConfig() {
    return viteConfig({
      plugins: [
        fonts({
          google: {
            families: ['Roboto:wght@300;400;500;700'],
            display: 'swap',
            preconnect: true,
          },
        }),
      ],
      optimizeDeps: {
        esbuildOptions: {
          define: {
            global: 'globalThis',
          },
        },
      },
      build: {},
    });
  }

  /**
   * @param {'development' | 'production'} mode
   * @returns {RollupOptions[]}
   */
  rollupESM(mode) {
    let productionPlugins =
      mode === 'production'
        ? [
            terser({
              module: true,
              compress: {},
              mangle: {},
              output: {},
              parse: {},
            }),
            bundleSize(),
          ]
        : [];

    return this.#shared('esm', mode).map((options) => ({
      ...options,
      external: this.#external,
      experimentalLogSideEffects: true,
      treeshake: {
        annotations: true,
        moduleSideEffects: false,
        tryCatchDeoptimization: false,
      },
      plugins: [
        inline(),
        nodePolyfills(),
        commonjs(),
        nodeResolve(),
        importMeta,
        typescript(this.#package, {
          target: ScriptTarget.ES2022,
          importsNotUsedAsValues: ImportsNotUsedAsValues.Preserve,
        }),
        ...productionPlugins,
      ],
    }));
  }

  /**
   * @returns {import("rollup").RollupOptions[]}
   */
  rollupCJS() {
    return this.#shared('cjs', 'development').map((options) => ({
      ...options,
      external: this.#external,
      plugins: [
        inline(),
        nodePolyfills(),
        commonjs(),
        nodeResolve(),
        importMeta,
        postcss(),
        typescript(this.#package, {
          target: ScriptTarget.ES2021,
          module: ModuleKind.CommonJS,
          moduleResolution: ModuleResolutionKind.NodeJs,
        }),
      ],
    }));
  }

  /**
   * @return {(id: string) => boolean}
   */
  get #external() {
    /**
     * @param {string} id
     * @returns {boolean}
     */
    return (id) => {
      const external = matchExternals(this)(id);

      if (external === null) {
        console.warn('unhandled external', id, {
          for: this.#package.name,
          config: inspect(this.workspace, { depth: null }),
        });
        return true;
      } else {
        return external;
      }
    };
  }

  /**
   * @param {"esm" | "cjs"} format
   * @param {"development" | "production"} mode
   * @returns {import("rollup").RollupOptions[]}
   */
  #shared(format, mode) {
    const { root, main } = this.#package;

    const ext = format === 'esm' ? 'js' : 'cjs';

    const modeSuffix = mode === 'production' ? '.production' : '';

    /**
     * @param {[string, string]} entry
     * @returns {import("rollup").RollupOptions}
     */
    function entryPoint([exportName, ts]) {
      const file = `${exportName}${modeSuffix}.${ext}`;

      return {
        input: resolve(root, ts),
        output: {
          file: resolve(root, 'dist', file),
          format,
          sourcemap: true,
          exports: format === 'cjs' ? 'named' : 'auto',
        },
        onwarn: (warning, warn) => {
          switch (warning.code) {
            case 'CIRCULAR_DEPENDENCY':
            case 'EMPTY_BUNDLE':
              return;
            default:
              warn(warning);
          }
        },
      };
    }

    return [entryPoint([`index`, main])];
  }
}

/**
 * @param {import("./config.js").ViteConfig} config
 */
async function viteConfig(config) {
  return Promise.resolve(config);
}

/**
 * @template T
 * @param {string} string
 * @returns {T}
 */
function parse(string) {
  return JSON.parse(string);
}
