'use client'
// ============================================================
//  PlanIA Digital — lib/diarioPendientes.ts
//  [2 oct 2026] Mi diario sin señal: si no hay conexión al terminar
//  de grabar, el audio se guarda SOLO en este teléfono (IndexedDB)
//  y se transcribe cuando vuelve la señal. En cuanto se transcribe,
//  el audio se borra del teléfono; el texto espera a que la
//  educadora lo revise y lo guarde. Nada de esto sale del teléfono
//  hasta que hay conexión.
// ============================================================

export type Pendiente = {
  id: string
  userId: string
  destino: string                 // 'grupo' o 'AL-XX'
  tipo: 'observacion' | 'incidente'
  segundos: number
  sucedido: string                // 'YYYY-MM-DDTHH:mm' (hora local del teléfono)
  creado: number
  audio?: Blob                    // se borra al transcribir
  texto?: string                  // ya filtrado por MÍA (sin nombres)
  avisoNombres?: string
  error?: string                  // si el servidor no pudo transcribirla
}

const BASE = 'plania-mi-diario'
const ALMACEN = 'pendientes'
export const MAX_PENDIENTES = 20

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Sin almacenamiento local')); return }
    const r = indexedDB.open(BASE, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN, { keyPath: 'id' }) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(ALMACEN, modo)
    const req = fn(tx.objectStore(ALMACEN))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function listarPendientes(userId: string): Promise<Pendiente[]> {
  try {
    const todos = await operar<Pendiente[]>('readonly', s => s.getAll() as IDBRequest<Pendiente[]>)
    return (todos || []).filter(p => p.userId === userId).sort((a, b) => a.creado - b.creado)
  } catch { return [] }
}

export async function guardarPendiente(p: Pendiente): Promise<void> {
  await operar('readwrite', s => s.put(p))
}

export async function borrarPendiente(id: string): Promise<void> {
  try { await operar('readwrite', s => s.delete(id)) } catch {}
}
