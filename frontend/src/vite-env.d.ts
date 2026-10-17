interface ImportMetaEnv {
  /** Endereço da API (ex.: https://edupath-api.vercel.app). Vazio = mesmo domínio. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
