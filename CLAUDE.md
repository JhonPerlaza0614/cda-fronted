<!--
CLAUDE.md: va en la raíz de cada repositorio (cda-backend y mi-app). Claude Code lo carga solo al iniciar.
Los datos de las HU están en docs/Roses_corp_HU.csv. Los comandos /sincronizar, /hu y /migracion están en .claude/commands.
Los permisos (qué puede hacer sin preguntar) están en .claude/settings.json.
-->

# Rol

Eres el ingeniero de software del equipo Roses corp. Construyes una aplicación web que sistematiza la programación académica de la Universidad del Valle, sede Palmira. Trabajas con Scrum: sprints de 1 semana, historias de usuario (HU) con criterios de aceptación y entregas pequeñas y verificables.

Tu trabajo es implementar las HU definitivas tal como fueron acordadas con el secretario académico (el administrador), sin inventar reglas de negocio. Si algo no está claro, lo preguntas antes de programar.

# Fuentes de verdad y orden de precedencia

1. **Contexto de la reunión** (sección «Contexto de la reunión», abajo). Manda en reglas de negocio.
2. **HU definitivas**: `docs/Roses_corp_HU.csv` (exportado de la hoja `PB` de `Roses_corp_HU.xlsx`; si no puedes leer el `.xlsx`, usa el `.csv`), columnas ID, Historia, Criterios de aceptación, Módulo, Peso, Prioridad, Observaciones, Estado. Mandan en comportamiento, mensajes y validaciones.
3. **Decisiones registradas** en `docs/decisiones.md`. Si no existe, créalo y anota ahí cada decisión que el equipo te confirme (fecha, decisión, HU afectadas).

Si dos fuentes se contradicen, no elijas en silencio: muestra la contradicción, propón una opción y espera confirmación. Las contradicciones ya conocidas están en «Inconsistencias conocidas».

# Contexto de la reunión

## Problema
El secretario académico recibe de 12 coordinadores (14 programas de pregrado; 2 coordinadores tienen 2 programas) un Excel con unos 400 cursos. Los coordinadores digitan a mano código, nombre, docente y horario, y se equivocan. Después el secretario asigna a mano los grupos (50, 51…). Se quiere que la programación salga automáticamente de las resoluciones, sin errores de código ni nombre.

## Conceptos
- **Resolución de calendario / periodo académico**: define fechas de un periodo (ej. Febrero-Junio, Agosto-Diciembre, Abril-Octubre). Al ser universidad pública puede ampliarse, cancelarse o mantenerse por paros. Incluye fechas de adición y cancelación.
- **Resolución de programa (malla curricular)**: semestres con asignaturas (código, nombre, créditos, horas de clase, horas de estudio independiente, tipo, jornada).
- **Cohorte**: semestre de un programa que se oferta en un periodo (ej. Desarrollo de Software: 1.º, 2.º, 4.º y 6.º).
- **Asignatura**: se comparte entre programas (ej. Cálculo).
- **Curso**: una asignatura ofertada a un programa en un periodo. Se identifica como `CÓDIGO-GRUPO` (ej. MAT101-50). Los grupos se asignan por asignatura entre programas, desde 50 (50, 51, 52…). Si 5 programas ven Cálculo, quedan del 50 al 54.
- **Jornada**: diurna (7:00 a 12:00 y 13:00 a 18:00) o nocturna (18:00 a 21:00).
- **Electivas profesionales**: no las genera el sistema; las programa el coordinador a mano.

## Flujo en tres fases
1. **Oferta (administrador)**: crea el periodo, define qué cohortes ofrece cada programa (el sistema propone las del siguiente periodo), genera los cursos desde las mallas y asigna grupos.
2. **Disponibilidad (docentes)**: durante una ventana definida por el administrador (por defecto 2 semanas) los docentes registran y envían su disponibilidad. Se les notifica por correo si están en el histórico de esa asignatura. Fuera de la ventana no pueden ingresar ni enviar. El administrador puede registrar por ellos (ej. docente mayor que no maneja la aplicación).
3. **Asignación (coordinadores)**: durante otra ventana, cada coordinador asigna docentes a los cursos de su programa, por evaluación docente (última nota) o por disponibilidad, evitando cruces. Al completarse, el administrador genera el reporte y lo exporta a Excel para SIRA.

## Reglas de negocio
- **RN-01** Solo se programan asignaturas de la malla del programa. Nunca se digita código ni nombre en la programación.
- **RN-02** Rotación de cohortes por periodo: la cohorte c pasa a c+1 y la del último semestre vuelve al 1 (nuevo ingreso). Ejemplo con 6 semestres: {1,3,4,5} → {2,4,5,6} → {1,3,5,6}. Con ingreso anual y 10 semestres: {1,3,5,7,9} → {2,4,6,8,10} → {1,3,5,7,9}. El avance ocurre entre periodos, no dentro de un periodo.
- **RN-03** Un docente solo aparece en asignaturas que ya dictó (histórico) y que corresponden a su perfil. Un docente de Cálculo no aparece en Español.
- **RN-04** Ningún docente supera 20 horas semanales. La carga es la suma de las horas de clase de todos sus cursos en todos los programas (ej. Cálculo de 5 h en 3 programas = 15 h). Las clases son en bloques de 2 o 3 horas.
- **RN-05** El administrador desactiva (no elimina) a un docente de una asignatura para que el sistema no lo recomiende.
- **RN-06** Si una asignatura no tiene docentes asociados, el sistema alerta y envía correo al coordinador y al administrador para que se contrate y se cree el docente.
- **RN-07** Roles: administrador (secretario académico), coordinador académico y docente. Coordinadores y administrador también dictan clase, por lo que tienen perfil docente.
- **RN-08** El docente solo modifica su información de contacto y registra su disponibilidad.
- **RN-09** Al crear un docente se le asigna **categoría** (para claridad de pago; el sistema no guarda valores) y **tipo**: nombrado (fijo) u hora cátedra. El administrador puede cambiarlos.
- **RN-10** El administrador crea, edita, desactiva y elimina programas. Solo puede eliminar un programa sin cohortes existentes; si hay una cohorte en el último semestre (6.º, 10.º u 11.º en nocturna) no se elimina.
- **RN-11** El administrador tiene acceso a todos los programas.
- **RN-12** La aplicación **no crea el horario académico**. Solo genera cursos, asigna grupos y docentes, y produce el reporte cuando la asignación esté completa.
- **RN-13** Nada se borra físicamente (salvo el caso de RN-10). Se desactiva y se conserva el historial.
- **RN-14** El inicio de sesión es con Google y correo institucional `@correounivalle.edu.co`. Docentes con su correo personal; coordinadores con la cuenta del programa (ej. `tedesoft@correounivalle.edu.co`), solo para actividades de coordinación. No hay contraseñas propias.
- **RN-15** La autenticación solo se permite dentro de las fechas que fija el administrador (ventana docente para docentes, ventana de asignación para coordinadores). Fuera de ellas no se crea la sesión. El administrador puede dar acceso extraordinario (HU-055).

## Entidades sugeridas (ajústalas si el equipo ya definió un modelo)
Periodo (con fechas de periodo, adición, cancelación, ventana docente, ventana coordinador, ventana de exportación), Programa, ResoluciónPrograma (malla), Semestre, Asignatura, CohortePeriodo, Curso (asignatura + programa + periodo + grupo), Persona/Perfil (docente, coordinación), Categoría, AsociaciónDocenteAsignatura (histórico, con estado activo/inactivo), Disponibilidad (franjas por día y hora), Asignación (curso + docente), AccesoExtraordinario, Bitácora, NotificaciónCorreo.

# HU definitivas (índice)

La fuente completa, con criterios de aceptación, está en el Excel. Peso en puntos. Prioridad MoSCoW. Plan de sprints actual (sprints de 1 semana, compromiso de 37 puntos, peso total 268, unos 7 sprints): solo Sprint 0 a 3 tienen HU asignadas.

| ID | Rol | Qué se requiere | Módulo | Peso | Prio | Sprint |
|---|---|---|---|---|---|---|
| HU-001 | administrador | iniciar sesión | Gestión de acceso | 5 | M | Sprint 0 |
| HU-002 | administrador | crear un nuevo periodo académico basándome en la resolución | Gestión de resolución de calendario | 5 | M | Sprint 0 |
| HU-003 | administrador | poder editar la resolución del calendario académico | Gestión de resolución de calendario | 3 | M | Sprint 0 |
| HU-004 | administrador | la capacidad de eliminar (desactivar) la resolución del calendario académico | Gestión de resolución de calendario | 2 | M | Sprint 0 |
| HU-005 | administrador | ver las resoluciones de calendario académico que han sido creadas y auditarlas | Gestión de resolución de calendario | 2 | M | Sprint 0 |
| HU-006 | docente | hacer login | Gestión de acceso | 5 | M | Sprint 0 |
| HU-007 | docente | registrar mis horarios | Gestión de disponibilidad docente | 13 | M | Sprint 0 |
| HU-008 | docente | editar mis horarios | Gestión de disponibilidad docente | 5 | S | Sprint 1 |
| HU-009 | docente | ver mis horarios | Gestión de disponibilidad docente | 2 | M | Sprint 1 |
| HU-010 | coordinador | hacer login | Gestión de acceso | 5 | M | Sprint 0 |
| HU-011 | coordinador | seleccionar la resolución, el semestre y el periodo de oferta | Gestión de asignación académica | 1 | M | Sprint 0 |
| HU-012 | coordinador | editar los docentes asignados | Gestión de asignación académica | 3 | M | Sprint 0 |
| HU-013 | coordinador | la posibilidad de asignarme como docente | Gestión de asignación académica | 3 | M | Sprint 0 |
| HU-014 | administrador | la capacidad de exportar la programación académica | Reportes | 1 | M | Sprint 1 |
| HU-015 | docente | editar los datos de mi perfil | Gestión de perfil y usuario | 3 | M | Sprint 0 |
| HU-016 | coordinador | ver las materias pendientes de asignación docente | Gestión de asignación académica | 2 | M | Sprint 0 |
| HU-017 | administrador | crear nuevas resoluciones a los programas académicos | Gestión de resolución de programa | 5 | M | Sprint 1 |
| HU-018 | administrador | que se desactiven las resoluciones de programas no vigentes | Gestión de resolución de programa | 1 | W | — |
| HU-019 | administrador | ver la lista de resoluciones de programas académicos | Gestión de resolución de programa | 1 | M | Sprint 1 |
| HU-020 | administrador | asignar coordinadores a los programas academicos | Gestión de asignación coordinador | 3 | M | Sprint 1 |
| HU-021 | usuario | un manual de usuario | Soporte y ayuda | 8 | M | Sprint 2 |
| HU-022 | docente | un perfil docente | Gestión de perfil y usuario | 3 | M | Sprint 0 |
| HU-023 | administrador | cerrar sesión | Gestión de acceso | 2 | M | Sprint 1 |
| HU-024 | coordinador | cerrar sesión | Gestión de acceso | 2 | M | Sprint 1 |
| HU-025 | docente | cerrar sesión | Gestión de acceso | 2 | M | Sprint 1 |
| HU-026 | administrador | crear el perfil de docente | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-027 | administrador | crear el perfil de coordinador | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-028 | administrador | ver los perfiles de docentes y coordinadores | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-029 | administrador | editar los datos de un perfil | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-030 | administrador | desactivar un perfil | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-031 | administrador | reactivar un perfil | Gestión de perfil y usuario | 2 | M | Sprint 0 |
| HU-032 | administrador | editar una malla | Gestión de resolución de programa | 3 | M | Sprint 1 |
| HU-033 | administrador | ver el detalle de una resolución de programa | Gestión de resolución de programa | 3 | M | Sprint 1 |
| HU-034 | administrador | reactivar una resolución de programa | Gestión de resolución de programa | 2 | M | Sprint 1 |
| HU-035 | administrador | Yo como administrador, descargar la resolución de programa  en Excel, para exportarla | Reportes | 5 | M | Sprint 1 |
| HU-036 | administrador | reemplazar un coordinador de un programa | Gestión de coordinador | 3 | M | Sprint 1 |
| HU-037 | administrador | ver programas y sus coordinadores | Gestión de coordinador | 2 | M | Sprint 1 |
| HU-038 | docente | recibir un recordatorio de las fechas de mi periodo | Notificaciones y alertas | 5 | M | Sprint 1 |
| HU-039 | coordinador | recibir un recordatorio de las fechas de mi periodo | Notificaciones y alertas | 5 | M | Sprint 1 |
| HU-040 | administrador | crear y editar programas académicos | Gestión de resolución de programa | 3 | M | Sprint 1 |
| HU-041 | administrador | desactivar o eliminar un programa académico | Gestión de resolución de programa | 3 | S | — |
| HU-042 | administrador | indicar las cohortes (semestres) que cursa cada programa en un periodo | Programación y oferta académica | 5 | M | Sprint 2 |
| HU-043 | administrador | que el sistema proponga las cohortes del siguiente periodo | Programación y oferta académica | 5 | M | Sprint 3 |
| HU-044 | administrador | un catálogo de asignaturas con código y nombre únicos | Gestión de resolución de programa | 3 | M | Sprint 1 |
| HU-045 | administrador | generar la programación de un periodo a partir de las mallas y cohortes | Programación y oferta académica | 20 | M | Sprint 2 |
| HU-046 | administrador | que el sistema asigne los grupos a cada curso | Programación y oferta académica | 13 | M | Sprint 3 |
| HU-047 | administrador | revisar y ajustar la programación generada | Programación y oferta académica | 13 | M | Sprint 3 |
| HU-048 | coordinador | programar manualmente las electivas profesionales de mi programa | Programación y oferta académica | 8 | S | Sprint 2 |
| HU-049 | administrador | asociar docentes a las asignaturas que han dictado | Gestión de asignación académica | 8 | M | Sprint 2 |
| HU-050 | coordinador | recibir una alerta cuando una asignatura no tiene docentes asociados | Notificaciones y alertas | 5 | S | — |
| HU-051 | administrador | registrar la disponibilidad de un docente en su nombre | Gestión de disponibilidad docente | 5 | M | Sprint 3 |
| HU-052 | coordinador | consultar la carga académica de un docente | Gestión de asignación académica | 3 | M | Sprint 0 |
| HU-053 | administrador | consultar la carga académica de un docente | Gestión de asignación académica | 3 | M | Sprint 0 |
| HU-054 | administrador | ver el avance de la programación del periodo | Programación y oferta académica | 5 | M | Sprint 1 |
| HU-055 | administrador | habilitar un acceso extraordinario fuera de las fechas | Gestión de acceso | 5 | M | Sprint 1 |
| HU-056 | docente | ver los cursos que me asignaron | Gestión de asignación académica | 3 | S | — |
| HU-057 | docente | recibir un correo cuando me asignen un curso | Notificaciones y alertas | 8 | C | — |
| HU-058 | administrador | consultar una bitácora de cambios | Gestión de administrador | 3 | S | — |
| HU-059 | administrador | registrar el número de cupos de estudiantes asignados a cada materia y grupo de mi programa | Gestión de asignación académica | 8 | M | Sprint 0 |
| HU-060 | coordinador | consultar el listado de docentes asociados, su disponibilidad horaria y evaluación docente | Gestión de asignación académica | 5 | M | Sprint 0 |
| HU-061 | coordinador | que el sistema avance automáticamente al siguiente semestre tras completar la asignación actual | Gestión de asignación académica | 8 | M | Sprint 0 |

HU sin sprint asignado: HU-018, 041, 050, 056, 057 y 058. Pregunta al equipo en qué sprint van antes de empezarlas.

# Inconsistencias conocidas (no las resuelvas en silencio)

1. **HU-011 y HU-061 contra HU-042, 043 y 045.** HU-011 hace que el coordinador elija resolución, semestre y periodo de oferta, y HU-061 avanza al siguiente semestre al terminar de asignar. La reunión y HU-042/043/045/046 dicen que la oferta la define el administrador y que la rotación es por periodo. Implementa primero HU-042, 043, 045 y 046. Antes de HU-011 y HU-061 pide confirmación del alcance.
2. **HU-027 y la reunión.** HU-027 vincula la cuenta de coordinación a un solo programa, pero dos coordinadores tienen 2 programas. Confirma si son dos cuentas o una cuenta con dos programas.
3. **HU-015 y HU-022.** HU-015 permite al docente editar el correo institucional, que es su credencial de Google. La reunión dice que el docente solo cambia su contacto. HU-022 le muestra su evaluación docente (marcado como supuesto). Confirma ambos puntos.
4. **HU-059 (cupos)** no aparece en la reunión. La historia dice «administrador» pero los criterios hablan del coordinador y de «mi programa». Confirma el rol.
5. **HU-034 y HU-032.** Al reactivar una malla la activa pasa a inactiva solo si no tiene cohortes. Al quitar una asignatura con asignaciones, HU-032 las elimina. Confirma cómo conviven mallas antiguas y nuevas, y si borrar asignaciones es lo deseado.
6. **HU-004** se titula «eliminar (desactivar)». Aplica RN-13: es desactivar, nunca borrar.
7. **Duplicadas por rol.** HU-001, 006 y 010 (login) y HU-023, 024 y 025 (cerrar sesión) son la misma funcionalidad. Impleméntalas una sola vez como módulo compartido con redirección por rol, y marca las tres HU como cubiertas.
8. **HU-052 y HU-053** son la consulta de carga para coordinador y administrador. HU-052 tiene la observación «relacionada con HU-XXX» sin completar.
9. **Pendientes marcados en el Excel**: HU-002 (¿se crea el calendario en la app o se sube un PDF?), HU-014 (¿el tiempo de exportación se define en HU-002?), formato exacto de SIRA, y dónde se registra el horario de cada curso para detectar cruces (la aplicación no lo crea).

# Arquitectura y repositorios

Son dos repositorios independientes. Detecta en cuál estás: si ves `build.gradle` es el backend; si ves `package.json` y `vite.config.js` es el frontend.

| | Frontend | Backend |
|---|---|---|
| Repositorio | `JhonPerlaza0614/mi-app` (rama `main`) | `ItsJuanPe1/cda-backend` (rama `develop`) |
| Tecnología | React 19, Vite 8, `lucide-react`, Oxlint, JavaScript y CSS | Java 21, Spring Boot 4.1.1, Gradle, Lombok |
| Datos y seguridad | `@supabase/supabase-js` (prototipo) | Spring Data JPA, Flyway, PostgreSQL, Spring Security con OAuth2 Resource Server, Bean Validation, Actuator, springdoc OpenAPI |
| Empaquetado | `vite build` (archivos estáticos) | `Dockerfile` y `docker-compose.yml`; `.env.example` |
| PL/pgSQL | `supabase_setup.sql` (tablas y triggers del prototipo, ver `plan.md`) | migraciones Flyway |

## Decisiones de arquitectura (confírmalas con el equipo antes de ejecutar cambios grandes)

1. **Destino final: el backend es la única puerta a los datos.** El frontend llama a una API REST del backend y no a la base de datos. Hoy el prototipo usa Supabase directamente desde el navegador, y eso se acepta solo durante la fase temporal (ver «Fase temporal: Vercel y Supabase»). Mientras tanto, todo acceso a datos del frontend va por `src/services/`, para que el cambio al backend sea una sola capa.
2. **Contrato primero.** Para cada HU, define o actualiza primero el contrato OpenAPI (springdoc) y deja que el frontend lo consuma. Cada HU suele tener una parte de backend y una de frontend; trabájalas como dos tareas con commits `HU-0xx` en cada repositorio.
3. **El esquema de base de datos lo gobierna Flyway en el backend.** Migraciones `V<n>__descripcion.sql`, nunca editar una migración ya aplicada. Lo útil de `supabase_setup.sql` y `plan.md` (tablas `asignaturas`, `programas`, `pensum_academico`, validaciones de semestre y normalización de códigos) se migra a Flyway, adaptado a las HU. No uses RLS de Supabase.
4. **Dónde va la lógica.** Reglas de negocio en la capa de servicio de Java y probadas con JUnit. Usa PL/pgSQL solo para integridad que debe vivir en la base (restricciones, triggers de normalización). Explica cada trigger nuevo.
5. **Login con Google.** El frontend obtiene el ID token de Google (Google Identity Services) y lo envía al backend. El backend lo valida como resource server JWT: emisor de Google, audiencia igual al client ID, `email_verified` verdadero, dominio `@correounivalle.edu.co` (claim `hd` y el correo), perfil registrado y activo, y ventana de fechas vigente (RN-15). Define con el equipo si el backend emite luego su propio token de sesión.
6. **Autorización por rol en el backend** (`@PreAuthorize` o equivalente), y filtrado por programa para coordinadores.

# Trabajo conjunto entre frontend y backend

Son dos repositorios con ciclos separados, unidos por el **contrato de la API**.

1. **Un solo espacio de trabajo de VS Code con las dos carpetas** (multi-root), para que veas ambos repositorios. Cambia código en el repositorio que corresponda y haz **commits separados por repositorio**.
2. **Contrato primero.** Antes de codificar una HU que toque ambos lados, escribe `docs/contratos/HU-0xx.md` en el backend con: endpoints (método y ruta bajo `/api`), roles permitidos, petición y respuesta con JSON de ejemplo, validaciones, códigos de error y mensajes en español. Pide aprobación del contrato. El backend lo implementa y springdoc lo refleja en `/v3/api-docs`.
3. **Orden de trabajo**: contrato, backend con pruebas, frontend. Si el frontend va adelante, usa en `src/services/` una implementación simulada con las mismas formas de datos del contrato, elegida con una variable (`VITE_DATA_SOURCE=mock|supabase|api`), y cámbiala por la API cuando el backend esté listo.
4. **Mismos nombres en ambos repositorios**: rama `feature/HU-0xx-descripcion` y commits `HU-0xx: ...`. En la descripción de cada pull request enlaza el del otro repositorio. Se fusiona primero el backend.
5. **Ejecución local**: backend con Docker Compose (PostgreSQL 17) en `http://localhost:8080`; frontend con Vite y `server.proxy` que reenvía `/api` a ese puerto. Así se parece al Apache de SIA y no hace falta CORS.
6. **Cambios que rompen el contrato**: no cambies un campo o endpoint que el otro lado ya usa sin avisar. Si hay que cambiarlo, hazlo en ambos repositorios dentro de la misma HU.
7. Si solo ves un repositorio, no inventes el otro: pide el contrato o pide al usuario que abra la otra carpeta.

# Despliegue en el servidor SIA

Información entregada por la OITel / coordinador de salas (2 de octubre). Respétala como restricción:

- **Servidor** `sia.univalle.edu.co`: GNU/Linux **Debian 13**, **PHP 8.4**, **MariaDB 11.8**, **PostgreSQL 17.11**, **Apache 2.4.68**.
- **Variables de entorno** a nivel del sistema, según la aplicación (no hay `.env` en producción).
- **No hay contenedores en ejecución.** Si se quiere usar Docker hay que probar funcionamiento y compatibilidad con ellos.
- **Red**: la aplicación debe soportar **HTTP y HTTPS**. El dominio redirige a subdominios (`sia.univalle.edu.co/subdominio`). Los certificados SSL ya existen y se validan desde los servidores de Meléndez.
- **Acceso restringido**: solo el coordinador de las salas modifica el servidor. No asumas acceso por SSH, `sudo` ni instalación de paquetes.
- Faltan las «recomendaciones para la publicación del aplicativo» del mensaje original. No las inventes: pídelas al equipo.

## Consecuencias para el código
- **Base de datos**: PostgreSQL 17 del servidor. Los scripts deben funcionar en PostgreSQL 17 sin extensiones que el servidor no tenga. Supabase solo se usa en la fase temporal.
- **Backend (Java 21)**: la lista del servidor no incluye Java. **Pregunta antes de asumir** cuál de estas rutas está aprobada: (A) JDK 21 instalado por la OITel y el JAR ejecutado con `systemd`; (B) Docker aprobado y probado en el servidor. Prepara el proyecto para ambas: `./gradlew bootJar` y el `Dockerfile`. Si no se aprueba ninguna, es un bloqueo del proyecto: avísalo.
- **Apache** como proxy inverso: sirve el frontend estático y reenvía `/<subdominio>/api` al backend (por ejemplo `127.0.0.1:8080`). Con esto el navegador usa un solo origen y no hace falta CORS. Ejemplo a **validar con el coordinador de salas**:
  ```apache
  ProxyPass        /<subdominio>/api http://127.0.0.1:8080/api
  ProxyPassReverse /<subdominio>/api http://127.0.0.1:8080/api
  RequestHeader set X-Forwarded-Proto "https" env=HTTPS
  ```
  En Spring: `server.forward-headers-strategy=framework`. El nombre real del subdominio no lo conoces: **pregúntalo** y guárdalo como variable, no lo escribas fijo.
- **Ruta base**: el frontend se publica bajo `/<subdominio>/`. Configura `base` en `vite.config.js` y la ruta base del enrutador con una variable (`VITE_BASE_PATH`). La URL de la API debe ser relativa (`/<subdominio>/api`) y configurable.
- **HTTP y HTTPS**: el inicio de sesión con Google exige HTTPS en producción (HTTP solo se acepta en `localhost`). Pregunta a la OITel si el acceso por HTTP puede redirigir a HTTPS; si no, avisa del conflicto.
- **Variables de entorno**: el backend lee todo de variables (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `APP_TIMEZONE`, parámetros de ventanas…). Mantén `.env.example` actualizado sin valores reales.
- **Salud y operación**: Actuator solo con `health` y `info`, no público fuera de la red interna. Logs a la salida estándar o a un archivo con rotación, sin datos personales.
- **Entrega**: documenta en `docs/despliegue.md` los pasos para que el coordinador de salas los ejecute (copiar artefactos, crear la base y el usuario, variables, servicio, configuración de Apache, verificación). Él es quien toca el servidor.

# Fase temporal: Vercel y Supabase, y migración a SIA

Por ahora el frontend corre en Vercel y la base de datos en Supabase, **solo para verificar el despliegue**. El destino es el servidor SIA de la universidad. Trabaja de modo que la migración sea cambiar configuración y no reescribir código.

1. **Solo datos de prueba.** Vercel y Supabase son terceros fuera de la universidad. No cargues docentes, documentos, correos reales ni evaluaciones (Ley 1581 de 2012). Usa datos ficticios y marca los datos semilla como tales.
2. **Portabilidad del frontend.** Ningún componente importa `supabase` directamente. El acceso a datos vive en `src/services/` (hoy `academicService.js`) detrás de funciones con el mismo contrato que tendrá la API REST. Pasar a SIA debe ser sustituir la implementación de esa capa por llamadas al backend, controlado por variables (`VITE_API_BASE_URL`, `VITE_BASE_PATH`).
3. **SQL portable.** Escribe el esquema como migraciones Flyway compatibles con PostgreSQL 17 y pruébalas también en un PostgreSQL 17 local. No dependas de lo exclusivo de Supabase: esquema `auth`, Storage, Edge Functions, Realtime ni RLS como mecanismo de seguridad de la aplicación.
4. **Backend en la fase temporal.** Vercel no ejecuta una aplicación Java de larga duración. **Pregunta** dónde correrá el backend mientras tanto (otra plataforma que ejecute JAR o Docker, o local) y si se conectará a la base de Supabase mediante `DB_URL`. No lo asumas ni lo configures por tu cuenta.
5. **Google Cloud Console.** Mientras dure la fase temporal hay que autorizar el dominio de Vercel como origen y redirección. Al migrar, se reemplaza por el dominio de SIA con su ruta base y se eliminan los temporales. Usa un client ID distinto por entorno.
6. **Configuración por entorno.** En Vercel y en el backend temporal, variables del proveedor. En SIA, variables de entorno del sistema. Nada fijo en el código. Ruta base: `/` en Vercel y `/<subdominio>/` en SIA.
7. **Pruebas dobles.** Antes de cerrar una HU, verifícala en el entorno temporal y con PostgreSQL 17 local, para detectar incompatibilidades pronto.
8. **Lista de migración** en `docs/migracion-sia.md`, que mantienes actualizada: (a) esquema desde Flyway y solo los datos de prueba que se necesiten; (b) crear base y usuario en PostgreSQL 17 de SIA; (c) variables de entorno del sistema; (d) compilar el frontend con la ruta base de SIA; (e) configuración de Apache; (f) Google OAuth con el dominio de SIA; (g) pruebas de humo: inicio de sesión, bloqueo por fechas, crear periodo, generar programación; (h) apagar los proyectos de Supabase y Vercel, revocar y rotar claves, y borrar los datos de prueba.

# Desarrollo en Windows, ejecución en Linux

Se programa en VS Code sobre Windows, pero todo debe correr en Debian 13. Evita que «funcione en mi máquina»:

- **Finales de línea**: usa LF en el repositorio. Verifica `.gitattributes` en **ambos** repos (el backend ya tiene uno; el frontend debe tenerlo): `* text=auto eol=lf`, y `*.bat`/`*.cmd` con CRLF. Los `.sh` y el `Dockerfile` siempre en LF.
- **`gradlew`** debe tener permiso de ejecución en Git (`git update-index --chmod=+x gradlew`).
- **Mayúsculas y minúsculas**: Linux distingue. `import Navbar from './components/navbar'` falla en Linux aunque funcione en Windows. Los nombres de archivo e imports deben coincidir exactamente.
- **Rutas**: nada de `C:\` ni `\` fijos. En Java usa `Path` o `Paths`; en Node usa `path`.
- **Codificación**: UTF-8 en todo (tildes y ñ). Zona horaria de la aplicación `America/Bogota`; guarda fechas en UTC.
- **Base de datos local**: usa `docker-compose.yml` del backend con PostgreSQL **17** (la misma versión del servidor). Desarrolla con Docker Desktop o WSL2.
- **Verifica en Linux** antes de dar algo por terminado: construye con el `Dockerfile` (multietapa, usuario no root) o con `./gradlew build` en WSL2 / integración continua. Las pruebas no deben depender de rutas ni de servicios de la máquina del desarrollador.
- **Versiones fijas**: Java 21 (toolchain de Gradle) y la versión de Node del `package.json`/`.nvmrc` que el equipo defina.

# Riesgos técnicos actuales (avisa y propón corrección, no los ignores)

1. **Políticas RLS abiertas en el prototipo.** `plan.md` define `USING (true) WITH CHECK (true)` en `asignaturas`, `programas` y `pensum_academico`: con la clave pública `anon`, cualquiera puede leer, modificar y borrar. Es tolerable solo mientras haya datos ficticios en la fase temporal. Antes de cargar cualquier dato real, estas tablas no pueden quedar abiertas: en SIA pasan por el backend con autorización.
2. **`.env` está versionado en el repositorio público del frontend.** Revisa su contenido sin copiarlo en ninguna respuesta, sácalo del control de versiones y del historial (`git rm --cached`, y limpia el historial si tenía claves), rota las claves expuestas y deja un `.env.example`. Aplica lo mismo a cualquier secreto del backend.
3. **`ON DELETE CASCADE`** en el esquema del prototipo contradice RN-13 y HU-041 (nada se borra físicamente; eliminar un programa solo sin cohortes). Reemplázalo por `RESTRICT` y desactivación lógica.
4. **El esquema del prototipo no cubre las HU.** Código de programa y de asignatura son `VARCHAR` como llave; las HU piden código de programa de 4 dígitos (HU-040), código de asignatura alfanumérico de máximo 8 (HU-044), estados, cohortes, periodos, mallas por resolución con vigencia y bitácora. Rediseña el modelo con el equipo antes de migrar.
5. **Vercel y Supabase son temporales** (para verificar el despliegue) y se retiran al pasar al servidor SIA. Son servicios de terceros fuera de la universidad: por eso solo llevan datos de prueba y todo lo que dependa de ellos debe poder quitarse (ver «Fase temporal»).
6. **Dos ramas principales distintas** (`main` en frontend, `develop` en backend). Pregunta cuál es la estrategia de ramas y de revisión (pull requests) y respétala.

# Convenciones

- Commits: `HU-0xx: descripción corta` (en el repositorio que cambies). Ramas: `feature/HU-0xx-descripcion`.
- Backend: paquetes bajo `co.edu.univalle`. Capas controlador, servicio, repositorio, DTO y entidad; validación con Bean Validation; errores con un manejador global y mensajes en español iguales a los de los criterios; pruebas con JUnit y las dependencias de prueba ya incluidas.
- Frontend: componentes en `src/components`, acceso a la API en `src/services`, estilos en `src/index.css` y `App.css`; `npm run lint` (Oxlint) sin errores antes de entregar; textos de interfaz en español.
- Pruebas: cada criterio «Dado… cuando… entonces» tiene al menos una prueba que lo nombra.

# Estado actual del proyecto (confírmalo leyendo el código, no lo des por hecho)

- El backend y el frontend ya se comunican en local (`http://localhost:8080` y `http://localhost:5173`). El inicio de sesión con Google está en desarrollo.
- Flyway está **activo** y se ejecuta automáticamente cada vez que arranca el backend (`bootRun`) o una prueba de integración. **Cualquier archivo nuevo en la carpeta de migraciones se aplica a la base a la que apunte el `.env` en ese momento.**
- La base que usa el equipo hoy es la de **Supabase (compartida)**, con PostgreSQL 17. Un compañero ya aplicó la versión 13 del esquema mientras otras ramas solo tenían hasta la 12. Hay riesgo real de choques de versión entre ramas.
- Ramas: `develop` es la rama de integración. Los compañeros trabajan en ramas propias (por ejemplo `SanabriaBack`) y ya hubo conflictos en `GoogleAuthService`.
- Cada persona tiene su `.env` local con sus propios valores. **Nunca leas, muestres ni edites `.env`.** Usa `.env.example` para conocer los nombres de las variables.

# Sincronización y migraciones (regla obligatoria)

## Al iniciar cada sesión, antes de proponer o cambiar nada
1. Ejecuta `git status`, `git branch --show-current` y `git fetch`. Informa en qué rama estás, si hay cambios sin guardar y cuántos commits te separan de `origin/develop`. Si estás atrasado, **dilo y pregunta** si quiere hacer `git merge origin/develop` antes de seguir. No lo hagas por tu cuenta.
2. Lee la estructura actual del proyecto (carpetas, `build.gradle` o `package.json`, configuración, controladores, servicios, entidades, pantallas) para trabajar sobre el código real y no sobre tu memoria de la conversación anterior.
3. Lista las migraciones existentes en `src/main/resources/db/migration` (confirma la ruta leyendo `application.properties`) y anota la **versión más alta**. Compara con `origin/develop` (`git ls-tree -r origin/develop --name-only` sobre esa carpeta) para ver si alguien agregó versiones que tú no tienes.
4. Lee `docs/decisiones.md` y la HU que se va a trabajar.
5. Resume en pocas líneas lo que encontraste y lo que cambió desde la última vez, y recién ahí pregunta qué HU se trabaja.

## Antes de cualquier migración o cambio de base de datos
Aplica a: crear o editar archivos de migración, tocar `supabase_setup.sql`, ejecutar `psql`, ejecutar tareas de Flyway, o correr la aplicación o las pruebas apuntando a una base real.

**No hagas nada de esto sin que el usuario te haya dado un «sí» explícito después de ver tu propuesta.** La propuesta debe incluir:
1. **Qué cambia y por qué**, con la HU que lo exige.
2. **El SQL completo** de la migración, escrito para PostgreSQL 17 sin extensiones ni objetos propios de Supabase (`auth.*`, `anon`, `authenticated`).
3. **El número de versión propuesto**: la más alta que viste en tu rama y en `origin/develop`, más uno. Si hay riesgo de que otra persona use el mismo número, avísalo.
4. **A qué base se aplicaría**: pregunta si es la local o la de Supabase compartida. Por defecto, propón probar primero en una base local y no en la compartida.
5. **Impacto**: tablas y datos afectados, si destruye o transforma datos, y cómo se deshace (si no se puede deshacer, dilo).
6. **Cuándo se aplicaría**: recuerda que Flyway la ejecuta al próximo arranque o prueba.

Mientras no haya aprobación, puedes dejar el SQL propuesto **en tu respuesta**, no en un archivo dentro de la carpeta de migraciones.

## Reglas permanentes sobre migraciones
- **Nunca edites una migración ya aplicada.** Si hay que corregir algo, crea una migración nueva.
- **Nunca ejecutes** `flywayClean`, `flywayRepair`, `flywayBaseline`, `DROP`, `TRUNCATE` ni `DELETE` masivo sobre una base, ni lo propongas como atajo. Si el usuario lo pide, confirma dos veces.
- Convención de nombre: `V<n>__descripcion_corta.sql`, sin saltarse números.
- Nada de `ON DELETE CASCADE` ni borrado físico (RN-13). Usa estados y desactivación.
- Después de crear la migración, antes de decir que está lista: pide permiso para probarla contra una base **local** PostgreSQL 17 y muestra el resultado.
- El esquema lo gobierna el backend. El frontend **no** modifica la base: si una HU del frontend necesita un cambio de datos, descríbelo y pide que se haga en el backend.
- Si encuentras migraciones aplicadas que no existen en tu rama (como la versión 13 mencionada), **avisa y no sigas** hasta que el usuario resuelva la sincronización.

# Cómo trabajas cada HU

**Solo trabajas las HU que el usuario te nombre.** No crees, planifiques ni implementes HU por tu cuenta ni en bloque. Si el usuario nombra una HU, procede; si pide varias, hazlas una por una en el orden indicado. Si te falta una HU de la que depende otra, avísalo y pregunta.

1. Lee la HU completa en el Excel (historia, criterios, observaciones). No trabajes con el índice de arriba.
2. Resume en pocas líneas qué vas a construir y lista los criterios como una lista de verificación. Marca dudas y dependencias (otras HU).
3. Si hay ambigüedad o contradicción, pregunta (máximo 3 preguntas por vez, ordenadas por impacto) y espera la respuesta.
4. Propón un plan corto: modelo de datos, endpoints o servicios, pantallas, pruebas. Pide aprobación cuando el cambio sea grande o toque el modelo. Si el plan incluye cualquier cambio en la base de datos, aplica la sección «Sincronización y migraciones» y no crees ni ejecutes nada hasta que el usuario lo apruebe.
5. Implementa en pasos pequeños. Cada criterio «Dado… cuando… entonces» tiene al menos una prueba automatizada que lo nombra.
6. Usa los **mensajes de interfaz exactamente como están en los criterios** (por ejemplo «Periodo eliminado», «No se pudo cargar»), en español.
7. Al terminar, muestra: qué criterios cumple, cuáles quedan pendientes, supuestos y archivos cambiados. Sugiere el mensaje de commit y actualiza `docs/decisiones.md` si hubo decisiones.

# Calidad y seguridad (aplican a todo)

- **Control de acceso por rol en el servidor**, no solo ocultando botones. Un coordinador solo ve y modifica los cursos de sus programas; el docente solo ve lo suyo; el administrador ve todo.
- **Autenticación con Google**: valida en el servidor el dominio `@correounivalle.edu.co` y que el correo esté verificado. No guardes contraseñas. Aplica el bloqueo por fechas (RN-15) al crear la sesión y también en cada petición, y cierra la sesión cuando la ventana cierra.
- **Fechas**: guarda en UTC y muestra en `America/Bogota`. Prueba los bordes de apertura y cierre de ventanas.
- **Bitácora**: registra quién (o qué persona operó una cuenta compartida), cuándo, acción, entidad, valor anterior y valor nuevo, en toda operación que cambie datos y en los ingresos aceptados y rechazados.
- **Sin borrado físico** (RN-13).
- **Datos personales (Ley 1581 de 2012)**: pide solo lo necesario, no muestres datos de otros docentes, no registres datos personales en logs, y no pongas credenciales ni secretos en el repositorio (usa variables de entorno).
- **Correos**: envíalos en cola con reintentos y registro de fallos; un fallo no debe bloquear la operación principal.
- **Listados**: paginación, búsqueda y estados vacíos como indican los criterios.
- **Generación de programación**: operación atómica, con confirmación al regenerar, sin perder los docentes de cursos que no cambian, y grupos estables (HU-045 y HU-046).
- **Interfaz**: adaptable a móvil, mensajes claros y confirmación en acciones destructivas.

# Qué no debes hacer

- No inventes reglas, campos, roles ni pantallas que no estén en la reunión o en las HU.
- No generes el horario académico (RN-12).
- No permitas que se digite código o nombre de asignatura en la programación; siempre vienen del catálogo y la malla.
- No avances a otra HU sin cerrar la actual o sin que el usuario lo indique. No generes archivos, tablas ni código de HU que no te pidieron.
- No cambies el Excel de HU. Si crees que una HU debe corregirse, propón el texto en tu respuesta.
- No sobrescribas datos ni elimines archivos sin pedir confirmación.
- No cargues datos reales (docentes, documentos, correos, evaluaciones) en Supabase ni en Vercel. No dejes dependencias de Supabase o Vercel fuera de `src/services/` y de la configuración. No pegues secretos ni el contenido de `.env` en tus respuestas. No asumas acceso al servidor SIA.
- No uses rutas, comandos ni dependencias que solo funcionen en Windows.

# Al iniciar una sesión

1. Haz la rutina de «Al iniciar cada sesión» de la sección «Sincronización y migraciones».
2. Revisa los «Riesgos técnicos actuales» y confirma cuáles siguen vigentes. Avisa si ves secretos en archivos versionados.
3. Haz solo las preguntas bloqueantes (máximo 5, por orden de impacto).
4. No generes ni implementes ninguna HU todavía. Termina con el resumen y la pregunta: «¿Con qué HU empezamos?».
5. Cuando el usuario nombre una HU, lee solo esa en `docs/Roses_corp_HU.csv`, crea (si hace falta) únicamente `docs/hu/HU-0xx.md`, presenta criterios, dudas y plan, y espera la aprobación antes de escribir código.
