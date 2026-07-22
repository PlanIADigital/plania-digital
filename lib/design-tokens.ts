// ============================================================
//  PlanIA Digital — Design Tokens
//  lib/design-tokens.ts
//
//  FUENTE ÚNICA DE VERDAD para toda la identidad visual.
//  Para cambiar la paleta, bordes o tipografía de la app:
//  edita SOLO este archivo.
// ============================================================

export const colors = {
  // Paleta oficial PlanIA
  indigo:       '#3D3A8C',  // Color de marca principal
  indigoLight:  '#EEEDF8',  // Superficies activas, fondos suaves
  indigoHover:  '#302D75',  // Hover de botones primarios
  cyan:         '#00A896',  // CTAs, acentos, íconos
  cyanLight:    '#E8F5F2',  // Fondo menta general
  black:        '#1A1A2E',  // Tipografía principal
  
  // Neutrales
  white:        '#FFFFFF',
  gray50:       '#F9FAFB',
  gray100:      '#F3F4F6',
  gray200:      '#E5E7EB',
  gray300:      '#D1D5DB',
  gray400:      '#9CA3AF',
  gray500:      '#6B7280',
  gray700:      '#374151',
  gray900:      '#111827',

  // Semánticos
  success:      '#065F46',
  successBg:    '#D1FAE5',
  successBorder:'#6EE7B7',
  warning:      '#92400E',
  warningBg:    '#FFFBEB',
  warningBorder:'#FDE68A',
  error:        '#DC2626',
  errorBg:      '#FEF2F2',
  errorBorder:  '#FECACA',
  info:         '#3730A3',
  infoBg:       '#EEF2FF',
  infoBorder:   '#C7D2FE',

  // Centro de Aprendizaje (gamificación) — dorado exclusivo para
  // XP, medallas de logros/ranking y barra de progreso de nivel.
  // NUNCA usarlo en botones, badges de tipo de misión o navegación.
  gold:         '#C9971C',
  goldLight:    '#FBF1DA',
  goldBorder:   '#E7C878',
}

export const radius = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  full: '9999px',
}

export const shadow = {
  sm:  '0 1px 3px rgba(0,0,0,0.06)',
  md:  '0 4px 12px rgba(61,58,140,0.08)',
  lg:  '0 8px 24px rgba(61,58,140,0.12)',
}

export const font = {
  sans: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
  size: {
    xs:   '10px',
    sm:   '12px',
    base: '13px',
    md:   '14px',
    lg:   '16px',
    xl:   '20px',
    xxl:  '24px',
  },
  weight: {
    normal:  400,
    medium:  500,
    semibold:600,
    bold:    700,
  }
}

export const spacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '20px',
  xxl: '24px',
  xxxl:'32px',
}

// Componentes compuestos — usar estos en el Super Admin
export const card = {
  background: colors.white,
  border: `1px solid ${colors.gray200}`,
  borderRadius: radius.lg,
  padding: spacing.xxl,
  boxShadow: shadow.sm,
}

export const badge = {
  active:  { background: colors.successBg,  color: colors.success,  borderRadius: radius.full },
  warning: { background: colors.warningBg,  color: colors.warning,  borderRadius: radius.full },
  info:    { background: colors.infoBg,     color: colors.info,     borderRadius: radius.full },
  purple:  { background: colors.indigoLight,color: colors.indigo,   borderRadius: radius.full },
}

export const button = {
  primary: {
    background: colors.indigo,
    color: colors.white,
    borderRadius: radius.md,
    fontWeight: font.weight.semibold,
    fontSize: font.size.base,
    padding: `${spacing.sm} ${spacing.lg}`,
    border: 'none',
    cursor: 'pointer',
  },
  secondary: {
    background: colors.white,
    color: colors.indigo,
    borderRadius: radius.md,
    fontWeight: font.weight.medium,
    fontSize: font.size.base,
    padding: `${spacing.sm} ${spacing.lg}`,
    border: `1px solid ${colors.gray200}`,
    cursor: 'pointer',
  },
}
