//#region src/navigate-fallback-denylist.d.ts
declare const NAVIGATE_FALLBACK_DENYLIST: RegExp[];
//#endregion
//#region src/sso-recovery.d.ts
interface ReloadFlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
/**
 * Falha de rede, de axios ou de `fetch`. Timeout e cancelamento ficam de fora:
 * têm outra causa e outro remédio.
 *
 * O erro do axios é reconhecido por `isAxiosError`/`code`, sem importar o
 * axios: duas cópias dele no bundle quebrariam um `instanceof`, e app com
 * fetch puro nem o tem instalado.
 */
declare function isNetworkFailure(error: unknown): boolean;
/**
 * Recarrega uma única vez por sessão de aba. Se a página acabou de recarregar
 * por isso e falhou de novo, a rede está fora mesmo: desarma e deixa o chamador
 * seguir pro form de login. Storage bloqueado (modo privado, política) não
 * recarrega — sem a marca não há como impedir o loop.
 */
declare function reloadOnceForSso(storage: ReloadFlagStorage, reload: () => void): boolean;
declare function clearSsoReloadFlag(storage: ReloadFlagStorage): void;
//#endregion
export { NAVIGATE_FALLBACK_DENYLIST, type ReloadFlagStorage, clearSsoReloadFlag, isNetworkFailure, reloadOnceForSso };