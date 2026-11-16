import { useEffect, useRef } from 'react'
import type { RecordSubscription } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

/**
 * Assinatura realtime bruta para coleções PocketBase (In-Situ / NA),
 * espelhando o padrão do SyncContext para RDO/Planilha de Campo/Projetos:
 * pb.collection(...).subscribe('*') + teardown correta ao desmontar.
 *
 * Usamos subscribe direto (e não o hook use-realtime) porque precisamos do
 * mesmo comportamento do motor geral, incluindo a desconexão garantida
 * (causa de bugs conhecida quando o usuário troca de sessão).
 */
export function useCollectionRealtime<TRecord extends { id: string } = { id: string }>(
  collectionName: string,
  onEvent: (event: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let unsubscribeFn: (() => Promise<void>) | undefined

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (event) => {
        handlerRef.current(event)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {
        // Sem conexão: a revalidação por visibilitychange/online cobre o caso
      })

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useCollectionRealtime
