import Link from "next/link";

const INDIGO = "#3D3A8C";
const CIAN = "#00A896";
const MENTA = "#E8F5F2";
const INDIGO_CLARO = "#EEEDF8";
const NEGRO = "#1A1A2E";

function Seccion({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg md:text-xl font-semibold mb-3" style={{ color: INDIGO }}>
        {numero}. {titulo}
      </h2>
      <div className="space-y-3 text-sm md:text-base leading-relaxed" style={{ color: NEGRO }}>
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

function Destacado({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md p-4 my-4 font-medium text-sm md:text-base"
      style={{ backgroundColor: INDIGO_CLARO, color: INDIGO }}
    >
      {children}
    </div>
  );
}

export default function TerminosPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: MENTA }}>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <Link href="/" className="text-sm underline" style={{ color: INDIGO }}>
          ← Volver a PlanIA Digital
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mt-4 mb-1" style={{ color: INDIGO }}>
          Términos y Condiciones de Uso
        </h1>
        <p className="text-sm text-gray-500 mb-6">Borrador de trabajo — versión 1</p>

        <Aviso>
          <strong>⚠ Documento en preparación.</strong> Este texto es un borrador redactado con
          apoyo de IA, pendiente de revisión por un abogado especialista antes de su publicación
          oficial o activación en el flujo de registro.
        </Aviso>

        <Seccion numero="1" titulo="Objeto y aceptación">
          <p>
            Los presentes Términos y Condiciones (&quot;Términos&quot;) regulan el acceso y uso de
            la plataforma PlanIA Digital (&quot;PlanIA&quot;, &quot;la Plataforma&quot;, &quot;el
            Servicio&quot;), disponible a través de plania.digital y operada por PlanIA Digital
            (&quot;el Prestador&quot;).
          </p>
          <p>
            Al crear una cuenta o utilizar la Plataforma, usted (&quot;el Usuario&quot;, &quot;la
            educadora/el educador&quot;, &quot;la/el directivo&quot;) declara haber leído,
            entendido y aceptado estos Términos en su totalidad. Si no está de acuerdo, debe
            abstenerse de usar el Servicio.
          </p>
        </Seccion>

        <Seccion numero="2" titulo="Descripción del Servicio">
          <p>
            PlanIA es una plataforma de software como servicio (SaaS) dirigida a educadoras y
            educadores de preescolar, maestras y maestros de música itinerantes, y directivos
            escolares en México, que utiliza inteligencia artificial para generar propuestas de
            planeación didáctica alineadas a los planteamientos de la Nueva Escuela Mexicana (NEM)
            y al Programa Sintético de Educación Preescolar vigente.
          </p>
          <p>
            El Servicio incluye, entre otras funciones: generación asistida de planeaciones
            didácticas, seguimiento de cobertura curricular (Campos Formativos, Procesos de
            Desarrollo de Aprendizaje, Ejes Articuladores), gestión de grupo, e instrumentos de
            evaluación.
          </p>
        </Seccion>

        <Seccion numero="3" titulo="Relación con la Secretaría de Educación Pública">
          <Destacado>
            PlanIA Digital no es una entidad afiliada, patrocinada ni respaldada por la Secretaría
            de Educación Pública (SEP).
          </Destacado>
          <p>
            PlanIA es una herramienta tecnológica independiente creada para apoyar el trabajo
            docente. Las planeaciones generadas son propuestas de apoyo pedagógico; la
            responsabilidad profesional sobre su aplicación, adecuación al contexto del grupo y
            cumplimiento normativo ante las autoridades educativas corresponde al Usuario en su
            carácter de profesional de la educación.
          </p>
        </Seccion>

        <Seccion numero="4" titulo="Registro de cuenta y responsabilidades del Usuario">
          <ul className="list-disc pl-5 space-y-2">
            <li>El Usuario debe proporcionar información veraz y mantenerla actualizada.</li>
            <li>
              El Usuario es responsable de la confidencialidad de su contraseña y de toda
              actividad realizada desde su cuenta.
            </li>
            <li>
              El acceso a ciertas funciones puede estar limitado según el rol asignado
              (Educadora/Educador, Maestra/Maestro de Música, Directivo).
            </li>
            <li>
              El Usuario se compromete a no compartir su cuenta con terceros ni a utilizar la
              Plataforma con fines distintos a los educativos para los que fue diseñada.
            </li>
            <li>
              El Usuario es responsable de que la información que introduce sobre sus alumnos
              (códigos internos, observaciones pedagógicas) cumpla con las políticas de protección
              de datos de su propio centro educativo.
            </li>
          </ul>
        </Seccion>

        <Seccion numero="5" titulo="Naturaleza del contenido generado por inteligencia artificial">
          <p>
            Las planeaciones y demás contenidos que PlanIA genera se producen mediante modelos de
            inteligencia artificial a partir de la información proporcionada por el Usuario y de
            reglas pedagógicas configuradas por PlanIA.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              El contenido generado es una propuesta de apoyo y no sustituye el juicio
              profesional, la experiencia ni la responsabilidad pedagógica del docente.
            </li>
            <li>
              PlanIA no garantiza que cada planeación esté libre de errores, imprecisiones u
              omisiones, y recomienda siempre la revisión profesional del Usuario antes de aplicar
              el contenido con su grupo.
            </li>
            <li>El Usuario conserva la responsabilidad final sobre el contenido que decide utilizar en su práctica docente.</li>
          </ul>
        </Seccion>

        <Seccion numero="6" titulo="Planes, suscripciones y pagos">
          <p>
            PlanIA puede ofrecer distintos planes de membresía, cuyas características, precios y
            condiciones se detallan en la Plataforma al momento de la contratación.
          </p>
          <p>
            Los pagos se procesan a través de un proveedor externo especializado; PlanIA no
            almacena los datos completos de instrumentos de pago del Usuario.
          </p>
        </Seccion>

        <Seccion numero="7" titulo="Cancelación de membresía y acceso a planeaciones pasadas">
          <p>
            El Usuario puede cancelar su membresía en cualquier momento desde su panel de cuenta.
          </p>
          <Destacado>
            Como valor ético de PlanIA, el Usuario conservará acceso de solo lectura, de forma
            permanente, a las planeaciones didácticas que haya generado durante el tiempo en que
            mantuvo una membresía activa, incluso después de cancelar su suscripción.
          </Destacado>
          <p>
            Este acceso de solo lectura no incluye la generación de nuevo contenido ni el uso de
            funciones activas de la Plataforma, las cuales requieren una membresía vigente.
          </p>
        </Seccion>

        <Seccion numero="8" titulo="Propiedad intelectual">
          <p>
            <strong>8.1</strong> El software, la marca &quot;PlanIA Digital&quot;, el diseño de la
            Plataforma, los personajes del universo Musilandia, los prompts y reglas pedagógicas
            propias, y demás elementos desarrollados por PlanIA son propiedad de PlanIA Digital.
          </p>
          <p>
            <strong>8.2</strong> Las planeaciones didácticas y demás documentos generados
            específicamente a partir de la información del Usuario quedan a su disposición para
            uso educativo propio.
          </p>
          <p>
            <strong>8.3</strong> Las referencias al Programa Sintético de Educación Preescolar y
            demás materiales oficiales de la SEP se utilizan únicamente con fines de alineación
            pedagógica; PlanIA parafrasea y no reproduce textualmente los materiales oficiales con
            fines comerciales.
          </p>
        </Seccion>

        <Seccion numero="9" titulo="Uso aceptable de la Plataforma">
          <p>El Usuario se compromete a no utilizar PlanIA para:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Introducir nombres reales u otra información que permita identificar directamente a
              un menor de edad, más allá de los mecanismos de codificación previstos por la
              Plataforma.
            </li>
            <li>Realizar ingeniería inversa, copiar o distribuir el software o los prompts de PlanIA.</li>
            <li>Usar la Plataforma con fines distintos a la actividad educativa para la que fue diseñada.</li>
            <li>Cualquier actividad que viole la legislación mexicana aplicable.</li>
          </ul>
        </Seccion>

        <Seccion numero="10" titulo="Limitación de responsabilidad">
          <p>
            En la máxima medida permitida por la legislación aplicable, PlanIA no será responsable
            por daños indirectos, incidentales o consecuentes derivados del uso de la Plataforma,
            incluyendo interrupciones del servicio, pérdida de información no atribuible a PlanIA,
            o decisiones pedagógicas tomadas por el Usuario a partir del contenido generado.
          </p>
        </Seccion>

        <Seccion numero="11" titulo="Modificaciones a estos Términos">
          <p>
            PlanIA podrá modificar estos Términos en cualquier momento para reflejar cambios
            legales, mejoras del Servicio o ajustes operativos. El uso continuado del Servicio
            después de una notificación de cambios constituye aceptación de los nuevos Términos.
          </p>
        </Seccion>

        <Seccion numero="12" titulo="Legislación aplicable y jurisdicción">
          <p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.</p>
        </Seccion>

        <Seccion numero="13" titulo="Contacto">
          <p>Para dudas relacionadas con estos Términos, puede escribir a [PENDIENTE — correo de contacto].</p>
        </Seccion>

        <Aviso>
          <strong>⚠ Recordatorio final.</strong> Este documento aún no ha sido validado por un
          abogado especialista. No debe considerarse vinculante hasta su publicación oficial.
        </Aviso>
      </div>
    </main>
  );
}