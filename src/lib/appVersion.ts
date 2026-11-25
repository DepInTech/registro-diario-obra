// Versão do bundle em execução no dispositivo.
//
// Lida do package.json no momento do build (resolveJsonModule) — a versão sobe
// automaticamente a cada commit, então este valor identifica EXATAMENTE qual
// bundle o dispositivo carregou (PWA/service worker em campo).
//
// tsconfig.app.json é gerenciado pela plataforma e não aceita resolveJsonModule,
// então o JSON é tipado localmente aqui (import de .json funciona no Vite
// independente do tsconfig para o build; o cast evita erro de tipo no tsc).
import packageJson from '../../package.json'

export const APP_VERSION: string = (packageJson as { version?: string }).version || '0.0.0'
