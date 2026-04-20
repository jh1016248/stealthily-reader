/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/lib/foliate-js/epub.js' {
  export class EPUB {
    constructor(opts: {
      loadText: (uri: string) => string | null
      loadBlob: (uri: string) => ArrayBuffer | null
      getSize: (name: string) => number
      sha1?: undefined
    })
    init(): Promise<void>
    metadata: {
      title: string | { [lang: string]: string }
      author: Array<{ name: string | { [lang: string]: string } }>
      language: string[]
      publisher: { name: string } | undefined
      description: string
      identifier: string
    }
    toc: Array<{
      label: string
      href: string
      subitems?: Array<{ label: string; href: string }>
    }>
    resources: Map<string, any>
  }
}

declare module '@/lib/foliate-js/epubcfi.js' {
  export const CFI: any
}

declare module './foliate-js/epub.js' {
  export { EPUB } from '@/lib/foliate-js/epub.js'
}

declare module './foliate-js/epubcfi.js' {
  export { CFI } from '@/lib/foliate-js/epubcfi.js'
}
