import Link from "next/link";

const INDIGO = "#3D3A8C";
const MENTA = "#E8F5F2";
const INDIGO_CLARO = "#EEEDF8";
const NEGRO = "#1A1A2E";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-2" style={{ color: INDIGO }}>
        {titulo}
      </h2>
      <div className="text-sm md:text-base leading-relaxed" style={{ color: NEGRO }}>
        {children}
      </div>
    </section>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border-l-4 rounded-md p-4 my-4 text-sm md:text-base"
      style={{ backgroundColor: "#FFF3CD", borderColor: "#8A6D00", color: "#5C4600" }}
    >
      {children}
    </div>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: MENTA }}>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <Link href="/" className="text-sm underline" style={{ color: INDIGO }}>
          ← Volver a PlanIA Digital
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mt-4 mb-1" style={{ color: INDIGO }}>
          Aviso de Privacidad
        </h1>
        <p className="text-sm text-gray-500 mb-6">Versión simplificada — borrador de trabajo</p>

        <Aviso>
          <strong>⚠ Documento en preparación.</strong> Este texto es un borrador redactado con
          apoyo de IA, pendiente de revisión por un abogado especialista en protección de datos
          antes de su publicación oficial o activación en el flujo de registro.
        </Aviso>

        <Bloque titulo="Responsable">
          <p>
            PlanIA Digital es responsable del tratamiento de sus datos personales. Puede
            contactarnos en [PENDIENTE — correo de contacto de privacidad].
          </p>
        </Bloque>

        <Bloque titulo="Finalidad">
          <p>
            Usamos sus datos para crear y administrar su cuenta, generar planeaciones didácticas
            alineadas a la Nueva Escuela Mexicana mediante inteligencia artificial, dar
            seguimiento a su avance curricular y, si usted lo autoriza, enviarle comunicaciones
            sobre nuevas funciones de la plataforma.
          </p>
        </Bloque>

        <Bloque titulo="Datos de sus alumnos">
          <p>
            PlanIA no recaba nombres reales de estudiantes. La información pedagógica de su grupo
            se asocia a códigos internos definidos por orden de inscripción, nunca por nombre.
          </p>
        </Bloque>

        <Bloque titulo="Transferencias">
          <p>
            Para operar la plataforma compartimos información con nuestros proveedores
            tecnológicos de almacenamiento, inteligencia artificial, hosting y envío de correo,
            quienes procesan los datos por nuestra cuenta y bajo confidencialidad.
          </p>
        </Bloque>

        <Bloque titulo="Derechos ARCO">
          <p>
            Usted puede Acceder, Rectificar o Cancelar sus datos, Oponerse a su uso, o revocar su
            consentimiento en cualquier momento, escribiendo a [PENDIENTE — correo de contacto].
          </p>
        </Bloque>

        <div
          className="rounded-md p-4 my-6 text-sm md:text-base"
          style={{ backgroundColor: INDIGO_CLARO, color: INDIGO }}
        >
          Para conocer el detalle completo del tratamiento de sus datos consulte nuestro Aviso de
          Privacidad Integral. [PENDIENTE — página completa, se publicará más adelante]
        </div>

        <Aviso>
          <strong>⚠ Recordatorio final.</strong> Este documento contiene marcadores [PENDIENTE] y
          aún no ha sido validado por un abogado especialista.
        </Aviso>
      </div>
    </main>
  );
}