import { useOutletContext } from 'react-router-dom'
import type { ManagedEvent } from '../../types'

// O evento carregado pelo EventShell, para os separadores.
export const useEvent = () => useOutletContext<ManagedEvent>()
