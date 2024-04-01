import { describe, expect, it } from 'vitest'
import { parse } from 'acorn-loose'
import { joinURL, parseURL, withBase } from 'ufo'
import { hash } from 'ohash'
import type { AssetBundlerTransformerOptions } from '../../src/plugins/transform'
import { NuxtScriptAssetBundlerTransformer } from '../../src/plugins/transform'
import type { IntercomInput } from '~/src/runtime/registry/intercom'
import type { NpmInput } from '~/src/runtime/registry/npm'

async function transform(code: string | string[], options: AssetBundlerTransformerOptions) {
  const plugin = NuxtScriptAssetBundlerTransformer(options).vite() as any
  const res = await plugin.transform.call(
    { parse: (code: string) => parse(code, { ecmaVersion: 2022, sourceType: 'module', allowImportExportEverywhere: true, allowAwaitOutsideFunction: true }) },
    Array.isArray(code) ? code.join('\n') : code,
    'file.js',
  )
  return res?.code
}

describe('nuxtScriptTransformer', () => {
  it('string arg', async () => {
    const code = await transform(
    `const instance = useScript('https://static.cloudflareinsights.com/beacon.min.js', {
      assetStrategy: 'bundle',
    })`,
    {
      resolveScript(src) {
        return `/_scripts${parseURL(src).pathname}`
      },
    },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScript('/_scripts/beacon.min.js', )"`)
  })

  it('options arg', async () => {
    const code = await transform(
      `const instance = useScript({ defer: true, src: 'https://static.cloudflareinsights.com/beacon.min.js' }, {
      assetStrategy: 'bundle',
    })`,
      {
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScript({ defer: true, src: '/_scripts/beacon.min.js' }, )"`)
  })
  it('overrides', async () => {
    const code = await transform(
      `const instance = useScript({ key: 'cloudflareAnalytics', src: 'https://static.cloudflareinsights.com/beacon.min.js' })`,
      {
        overrides: {
          cloudflareAnalytics: {
            assetStrategy: 'bundle',
          },
        },
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScript({ key: 'cloudflareAnalytics', src: '/_scripts/beacon.min.js' })"`)
  })

  it('dynamic src is not transformed', async () => {
    const code = await transform(
      `const instance = useScript({ key: 'cloudflareAnalytics', src: \`https://static.cloudflareinsights.com/$\{123\}beacon.min.js\` })`,
      {
        overrides: {
          cloudflareAnalytics: {
            assetStrategy: 'bundle',
          },
        },
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`undefined`)
  })

  it('supplied src integration is transformed - opt-in', async () => {
    const code = await transform(
      `const instance = useScriptFathomAnalytics({ src: 'https://cdn.fathom/custom.js' }, { assetStrategy: 'bundle' })`,
      {
        defaultBundle: false,
        registry: [
          {
            name: 'useScriptFathomAnalytics',
            from: '',
            key: 'fathomAnalytics',
            src: 'https://cdn.usefathom.com/script.js',
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScriptFathomAnalytics({ src: '/_scripts/custom.js.js' }, )"`)
  })

  it('static src integration is transformed - opt-in', async () => {
    const code = await transform(
      `const instance = useScriptFathomAnalytics({ site: '123' }, { assetStrategy: 'bundle' })`,
      {
        defaultBundle: false,
        registry: [
          {
            name: 'useScriptFathomAnalytics',
            from: '',
            key: 'fathomAnalytics',
            src: 'https://cdn.usefathom.com/script.js',
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScriptFathomAnalytics({ site: '123', src: '/_scripts/script.js.js' }, )"`)
  })

  it('static src integration is transformed - opt-out', async () => {
    const code = await transform(
      `const instance = useScriptFathomAnalytics({ site: '123' }, { assetStrategy: null })`,
      {
        defaultBundle: true,
        registry: [
          {
            name: 'useScriptFathomAnalytics',
            from: '',
            key: 'fathomAnalytics',
            src: 'https://cdn.usefathom.com/script.js',
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`undefined`)
  })

  it('dynamic src integration is transformed - default', async () => {
    const code = await transform(
      `const instance = useScriptIntercom({ app_id: '123' })`,
      {
        defaultBundle: true,
        registry: [
          {
            name: 'useScriptIntercom',
            from: '',
            key: 'intercom',
            transform(options?: IntercomInput) {
              return joinURL(`https://widget.intercom.io/widget`, options?.app_id || '')
            },
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScriptIntercom({ app_id: '123', src: '/_scripts/widget/123.js' })"`)
  })

  it('dynamic src integration can be opted-out explicit', async () => {
    const code = await transform(
      `const instance = useScriptIntercom({ app_id: '123' }, { assetStrategy: null })`,
      {
        defaultBundle: true,
        registry: [
          {
            name: 'useScriptIntercom',
            from: '',
            key: 'intercom',
            transform(options?: IntercomInput) {
              return joinURL(`https://widget.intercom.io/widget`, options?.app_id || '')
            },
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`undefined`)
  })

  it('dynamic src integration can be opt-in explicit', async () => {
    const code = await transform(
      `const instance = useScriptIntercom({ app_id: '123' }, { assetStrategy: 'bundle' })`,
      {
        defaultBundle: false,
        registry: [
          {
            name: 'useScriptIntercom',
            from: '',
            key: 'intercom',
            transform(options?: IntercomInput) {
              return joinURL(`https://widget.intercom.io/widget`, options?.app_id || '')
            },
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScriptIntercom({ app_id: '123', src: '/_scripts/widget/123.js' }, )"`)
  })

  it('can re-use opt-in once it\'s loaded', async () => {
    const code = await transform(
      [`const instance = useScriptIntercom({ app_id: '123' }, { assetStrategy: 'bundle' })`, `const instance2 = useScriptIntercom()`].join('\n'),
      {
        defaultBundle: false,
        registry: [
          {
            name: 'useScriptIntercom',
            from: '',
            key: 'intercom',
            transform(options?: IntercomInput) {
              return joinURL(`https://widget.intercom.io/widget`, options?.app_id || '')
            },
          },
        ],
        resolveScript(src) {
          return `/_scripts${parseURL(src).pathname}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`
      "const instance = useScriptIntercom({ app_id: '123', src: '/_scripts/widget/123.js' }, )
      const instance2 = useScriptIntercom()"
    `)
  })

  it('useScriptNpm', async () => {
    const code = await transform(
      `const instance = useScriptNpm({ packageName: 'jsconfetti', version: '1.0.0', file: 'dist/index.js' })`,
      {
        defaultBundle: true,
        registry: [
          {
            name: 'useScriptNpm',
            from: '',
            transform(options?: NpmInput) {
              return withBase(options?.file || '', `https://unpkg.com/${options?.packageName || ''}@${options?.version || 'latest'}`)
            },
          },
        ],
        resolveScript(src) {
          return `/_scripts/${hash(parseURL(src).pathname)}.js`
        },
      },
    )
    expect(code).toMatchInlineSnapshot(`"const instance = useScriptNpm({ packageName: 'jsconfetti', version: '1.0.0', file: 'dist/index.js', src: '/_scripts/soMXoYlUxl.js' })"`)
  })
})
