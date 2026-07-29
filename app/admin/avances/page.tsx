'use client'
import { useState, useEffect } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

type Item = {
  id: number
  categoria: string
  elemento: string
  estado: 'pendiente' | 'en_progreso' | 'completo'
  nota: string | null
  orden: number
}

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: '#9CA3AF', bg: '#F3F4F6' },
  en_progreso: { label: 'En progreso', color: '#B45309', bg: '#FEF3C7' },
  completo: { label: 'Completo', color: '#065F46', bg: '#D1FAE5' },
}

const ORDEN_CATEGORIAS = [
  'Producto Core',
  'Interfaz y Diseño',
  'Seguridad',
  'Datos y Backend',
  'Pagos y Suscripciones',
  'Legal y Cumplimiento',
  'Soporte y Retención',
  'Roles Especiales',
  'Lanzamiento y Decisiones de Negocio',
]

function siguienteEstado(actual: Item['estado']): Item['estado'] {
  if (actual === 'pendiente') return 'en_progreso'
  if (actual === 'en_progreso') return 'completo'
  return 'pendiente'
}

export default function AvancesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [notaAbierta, setNotaAbierta] = useState<number | null>(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [nuevoElemento, setNuevoElemento] = useState<Record<string, string>>({})

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const res = await fetchAdmin('/api/admin/avances')
      const json = await res.json()
      setItems(json.data || [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  async function cambiarEstado(item: Item) {
    const nuevoEstado = siguienteEstado(item.estado)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, estado: nuevoEstado } : i))
    try {
      await fetchAdmin('/api/admin/avances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, estado: nuevoEstado }),
      })
    } catch {
      cargar()
    }
  }

  function abrirNota(item: Item) {
    setNotaAbierta(item.id)
    setNotaTexto(item.nota || '')
  }

  async function guardarNota(id: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, nota: notaTexto } : i))
    setNotaAbierta(null)
    try {
      await fetchAdmin('/api/admin/avances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nota: notaTexto }),
      })
    } catch {
      cargar()
    }
  }

  async function agregarElemento(categoria: string) {
    const texto = (nuevoElemento[categoria] || '').trim()
    if (!texto) return
    try {
      const res = await fetchAdmin('/api/admin/avances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, elemento: texto }),
      })
      const json = await res.json()
      if (json.data) {
        setItems(prev => [...prev, json.data])
        setNuevoElemento(prev => ({ ...prev, [categoria]: '' }))
      }
    } catch {}
  }

  const categorias = ORDEN_CATEGORIAS.filter(c => items.some(i => i.categoria === c))
    .concat(Array.from(new Set(items.map(i => i.categoria))).filter(c => !ORDEN_CATEGORIAS.includes(c)))

  const total = items.length
  const completos = items.filter(i => i.estado === 'completo').length
  const enProgreso = items.filter(i => i.estado === 'en_progreso').length
  const pendientes = items.filter(i => i.estado === 'pendiente').length
  const porcentaje = total > 0 ? Math.round((completos / total) * 100) : 0

  if (loading) {
    return <p className="text-sm text-gray-400 p-8">Cargando control de avances...</p>
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Control de Avances</h1>
      <p className="text-sm text-gray-500 mb-6">
        Estado general de todos los elementos que necesita PlanIA Digital para un lanzamiento exitoso.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-3xl font-bold" style={{ color: '#3D3A8C' }}>{porcentaje}%</p>
            <p className="text-xs text-gray-500">completado</p>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
              <div style={{ width: `${(completos / total) * 100}%`, background: '#00A896' }} />
              <div style={{ width: `${(enProgreso / total) * 100}%`, background: '#F59E0B' }} />
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <span><strong style={{ color: '#065F46' }}>{completos}</strong> completos</span>
            <span><strong style={{ color: '#B45309' }}>{enProgreso}</strong> en progreso</span>
            <span><strong style={{ color: '#9CA3AF' }}>{pendientes}</strong> pendientes</span>
            <span className="text-gray-400">de {total} elementos totales</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {categorias.map(categoria => {
          const itemsCategoria = items.filter(i => i.categoria === categoria)
          return (
            <div key={categoria} className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#3D3A8C' }}>
                {categoria}
              </h2>
              <div className="flex flex-col gap-1">
                {itemsCategoria.map(item => {
                  const cfg = ESTADO_CONFIG[item.estado]
                  return (
                    <div key={item.id} className="py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => cambiarEstado(item)}
                          title={cfg.label}
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border"
                          style={{ background: cfg.bg, borderColor: cfg.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 leading-snug">{item.elemento}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                            <button
                              onClick={() => abrirNota(item)}
                              className="text-[10px] text-gray-400 hover:text-gray-600"
                            >
                              {item.nota ? '📝 ver nota' : '+ nota'}
                            </button>
                          </div>
                          {notaAbierta === item.id && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              <textarea
                                value={notaTexto}
                                onChange={e => setNotaTexto(e.target.value)}
                                placeholder="Nota corta..."
                                rows={2}
                                className="text-[11px] border border-gray-200 rounded-md p-1.5 w-full outline-none focus:border-indigo-400"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => guardarNota(item.id)}
                                  className="text-[10px] font-medium text-white px-2 py-0.5 rounded"
                                  style={{ background: '#3D3A8C' }}
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setNotaAbierta(null)}
                                  className="text-[10px] text-gray-400"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-100 flex gap-1">
                <input
                  type="text"
                  placeholder="+ agregar elemento"
                  value={nuevoElemento[categoria] || ''}
                  onChange={e => setNuevoElemento(prev => ({ ...prev, [categoria]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarElemento(categoria)}
                  className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
