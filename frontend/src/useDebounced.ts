import { useEffect, useState } from 'react'

// Valor que só acompanha o original depois de ele parar de mudar: evita um pedido por tecla nas pesquisas.
export function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
