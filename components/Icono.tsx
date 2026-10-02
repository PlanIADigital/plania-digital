// ============================================================
//  PlanIA Digital — components/Icono.tsx
//  [oct 2026] Iconografía oficial: íconos de línea (trazo de Lucide,
//  licencia ISC) incrustados aquí para no depender de otra librería.
//  'mi-diario' es propio de PlanIA: cuaderno con micrófono.
//  'semaforo' es propio de PlanIA [2 oct 2026]: semáforo vertical con 3 luces.
//  Uso: <Icono nombre="house" tamano={18} />
// ============================================================
import React from 'react'

type Nodo = [string, Record<string, string>]

const ICONOS: Record<string, Nodo[]> = {
  'hand': [['path', {"d": "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"}], ['path', {"d": "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"}], ['path', {"d": "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"}], ['path', {"d": "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"}]],
  'eye': [['path', {"d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}], ['circle', {"cx": "12", "cy": "12", "r": "3"}]],
  'ear': [['path', {"d": "M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"}], ['path', {"d": "M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"}]],
  'house': [['path', {"d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}], ['path', {"d": "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],
  'users': [['path', {"d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}], ['circle', {"cx": "9", "cy": "7", "r": "4"}], ['path', {"d": "M22 21v-2a4 4 0 0 0-3-3.87"}], ['path', {"d": "M16 3.13a4 4 0 0 1 0 7.75"}]],
  'sparkles': [['path', {"d": "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"}], ['path', {"d": "M20 3v4"}], ['path', {"d": "M22 5h-4"}], ['path', {"d": "M4 17v2"}], ['path', {"d": "M5 18H3"}]],
  'folder-open': [['path', {"d": "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"}]],
  'chart-column': [['path', {"d": "M3 3v16a2 2 0 0 0 2 2h16"}], ['path', {"d": "M18 17V9"}], ['path', {"d": "M13 17V5"}], ['path', {"d": "M8 17v-3"}]],
  'flag': [['path', {"d": "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"}], ['line', {"x1": "4", "x2": "4", "y1": "22", "y2": "15"}]],
  'calendar-days': [['path', {"d": "M8 2v4"}], ['path', {"d": "M16 2v4"}], ['rect', {"width": "18", "height": "18", "x": "3", "y": "4", "rx": "2"}], ['path', {"d": "M3 10h18"}], ['path', {"d": "M8 14h.01"}], ['path', {"d": "M12 14h.01"}], ['path', {"d": "M16 14h.01"}], ['path', {"d": "M8 18h.01"}], ['path', {"d": "M12 18h.01"}], ['path', {"d": "M16 18h.01"}]],
  'chart-pie': [['path', {"d": "M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"}], ['path', {"d": "M21.21 15.89A10 10 0 1 1 8 2.83"}]],
  'settings': [['path', {"d": "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"}], ['circle', {"cx": "12", "cy": "12", "r": "3"}]],
  'log-out': [['path', {"d": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}], ['polyline', {"points": "16 17 21 12 16 7"}], ['line', {"x1": "21", "x2": "9", "y1": "12", "y2": "12"}]],
  'download': [['path', {"d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}], ['polyline', {"points": "7 10 12 15 17 10"}], ['line', {"x1": "12", "x2": "12", "y1": "15", "y2": "3"}]],
  'pencil': [['path', {"d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}], ['path', {"d": "m15 5 4 4"}]],
  'layout-grid': [['rect', {"width": "7", "height": "7", "x": "3", "y": "3", "rx": "1"}], ['rect', {"width": "7", "height": "7", "x": "14", "y": "3", "rx": "1"}], ['rect', {"width": "7", "height": "7", "x": "14", "y": "14", "rx": "1"}], ['rect', {"width": "7", "height": "7", "x": "3", "y": "14", "rx": "1"}]],
  'target': [['circle', {"cx": "12", "cy": "12", "r": "10"}], ['circle', {"cx": "12", "cy": "12", "r": "6"}], ['circle', {"cx": "12", "cy": "12", "r": "2"}]],
  'link': [['path', {"d": "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}], ['path', {"d": "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],
  'plus': [['path', {"d": "M5 12h14"}], ['path', {"d": "M12 5v14"}]],
  'school': [['path', {"d": "M14 22v-4a2 2 0 1 0-4 0v4"}], ['path', {"d": "m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"}], ['path', {"d": "M18 5v17"}], ['path', {"d": "m4 6 8-4 8 4"}], ['path', {"d": "M6 5v17"}], ['circle', {"cx": "12", "cy": "9", "r": "2"}]],
  'mi-diario': [['rect', {"x": "4", "y": "2", "width": "16", "height": "20", "rx": "2"}], ['path', {"d": "M2 6h4M2 10h4M2 14h4M2 18h4"}], ['path', {"d": "M12 6.5a2.5 2.5 0 0 0-2.5 2.5v3a2.5 2.5 0 0 0 5 0V9a2.5 2.5 0 0 0-2.5-2.5z"}], ['path', {"d": "M16 11.5a4 4 0 0 1-8 0"}], ['path', {"d": "M12 15.5v2"}]],
  'semaforo': [['rect', {"x": "8", "y": "2", "width": "8", "height": "20", "rx": "3"}], ['circle', {"cx": "12", "cy": "7", "r": "1.6"}], ['circle', {"cx": "12", "cy": "12", "r": "1.6"}], ['circle', {"cx": "12", "cy": "17", "r": "1.6"}], ['path', {"d": "M8 6H5.5l2.5 2.5M16 6h2.5L16 8.5M8 11H5.5l2.5 2.5M16 11h2.5L16 13.5"}]],
}

export type NombreIcono = keyof typeof ICONOS

export default function Icono({ nombre, tamano = 20, grosor = 1.9, style }: {
  nombre: string; tamano?: number; grosor?: number; style?: React.CSSProperties
}) {
  const nodos = ICONOS[nombre]
  if (!nodos) return null
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={tamano} height={tamano} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0, display: 'block', ...style }}>
      {nodos.map(([etiqueta, attrs], i) => React.createElement(etiqueta, { key: i, ...attrs }))}
    </svg>
  )
}
