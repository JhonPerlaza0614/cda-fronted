# Manual de Usuario – Administrador

> **Objetivo**: Guiar al administrador sobre todas las funcionalidades disponibles en la aplicación y cómo usarlas.

## Pantalla de Bienvenida
Al iniciar sesión como **Administrador**, se muestra una pantalla de bienvenida con el siguiente mensaje:

> "Bienvenido, Administrador. Aquí puedes gestionar usuarios, módulos y la configuración general del sistema."

En esta pantalla se presentan enlaces rápidos a los módulos críticos:

- **Gestión de Usuarios** – crear, editar y desactivar cuentas de coordinadores y docentes.
- **Configuración del Sistema** – modificar parámetros globales, conectar con servicios externos (Google, base de datos, etc.).
- **Reportes y Estadísticas** – visualizar métricas de uso y actividad académica.

## Módulos Disponibles para el Administrador

| Módulo | Funcionalidad principal | Enlace al código |
|---|---|---|
| **Gestión de Asociaciones Docentes** | Crear, editar y ver asociaciones entre docentes y asignaturas. | [AsociacionesDocentesView.jsx](../../components/asociaciones/AsociacionesDocentesView.jsx) |
| **Bitácora de Eventos** | Registro de acciones importantes del sistema. | [BitacoraView.jsx](../../components/bitacora/BitacoraView.jsx) |
| **Carga Masiva de Docentes** | Importar docentes desde CSV/Excel. | [CargaDocente.jsx](../../components/cargaDocente/CargaDocente.jsx) |
| **Disponibilidad Docente** | Gestionar horarios disponibles de los docentes. | [DisponibilidadDialog.jsx](../../components/disponibilidad/DisponibilidadDialog.jsx) |
| **Gestión de Periodos Académicos** | Crear, editar y cerrar periodos académicos. | [PeriodosView.jsx](../../components/periodos/PeriodosView.jsx) |
| **Plantilla de Programación** | Definir la carga académica base para cada docente. | [PlantillaView.jsx](../../components/plantilla/PlantillaView.jsx) |
| **Programación de Cohortes y Cursos** | Crear y gestionar cohortes, asignar docentes, definir horarios y avanzar en la planificación. | [ProgramacionCohortesView.jsx](../../components/programacion/ProgramacionCohortesView.jsx) |
| **Pensum y Malla Curricular** | Visualizar y gestionar el plan de estudios. | [PensumView.jsx](../../components/pensum/PensumView.jsx) |
| **Gestión de Programas y Coordinadores** | Administrar programas académicos y asignar coordinadores. | [ProgramasView.jsx](../../components/programas/ProgramasView.jsx) |
| **Servicios Compartidos** | Auth, Academic y utilidades generales. | [authService.js](../../services/authService.js) |

## Flujos de Trabajo Clave
1. **Crear un nuevo docente** → *Carga Masiva* → asignar disponibilidad → incluir en la plantilla.
2. **Definir un periodo académico** → *Gestión de Periodos* → activar programación de cohortes.
3. **Programar un curso** → *Programación de Cohortes* → asignar docente → publicar.

## Buenas Prácticas
- Revisar siempre la Bitácora después de operaciones críticas.
- Validar la disponibilidad antes de asignar docentes a cohortes.
- Respaldar la configuración usando la opción de exportar en *Configuración del Sistema*.

---

Para más detalle sobre cada módulo, consulta el **Manual General** (`general_manual.md`).
