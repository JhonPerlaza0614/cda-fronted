# Manual general del Administrador

## Inicio de sesión y navegación
1. Inicia sesión con una cuenta institucional cuyo rol esté autorizado como administrador.
2. Al ingresar aparecerá **Bienvenido a CDA**, donde se muestran tus datos y los módulos disponibles.
3. Usa **Inicio** en la barra superior para volver a esta pantalla.
4. Usa el botón flotante **Manual** para abrir esta guía; desde un módulo también puede cambiarse a **Manual del módulo**.

## Períodos académicos
Ruta: **Períodos académicos**

1. Selecciona **Nuevo período académico**.
2. Completa los campos obligatorios:
   - **Nombre del período:** máximo 20 caracteres y único. Ejemplo válido: `2026-2`.
   - **Número de resolución:** obligatorio y único. Ejemplo: `Resolución 023`.
   - **Fecha de resolución:** formato de calendario `DD/MM/AAAA`.
   - Fechas del semestre: inicio y fin en `DD/MM/AAAA`.
   - Inicio y fin de adiciones y cancelaciones.
   - Inicio y fin de cancelaciones.
   - Inicio y fin del plazo docente.
   - Plazo coordinador, opcional.
   - Enlace de resolución, opcional. Debe comenzar por `https://` o `http://`.
3. Para fechas simples usa el selector de fecha. Para los plazos docentes y coordinadores usa fecha y hora en formato mostrado por el navegador.
4. Confirma con **Guardar período** y acepta la confirmación.

Reglas importantes:
- La fecha final del semestre debe ser posterior a la inicial.
- Las fechas de adiciones y cancelaciones deben estar dentro del semestre.
- Las fechas de adiciones y cancelaciones no pueden solaparse.
- El fin de cada plazo debe ser posterior a su inicio.
- Si defines el plazo coordinador, debes completar inicio y fin.
- Horario mostrado: hora de Bogotá.
- Al crear el período se desactivan o cierran los plazos anteriores; conserva una sola resolución vigente.
- Para eliminarlo, abre el período vigente o histórico y selecciona **Eliminar**. El sistema lo desactiva y mantiene el historial.

## Programas académicos
Ruta: **Programas (Carreras)**

1. Usa **Nueva Facultad** si la facultad aún no existe. Ingresa nombre obligatorio y descripción opcional.
2. Selecciona **Nuevo Programa**.
3. Escribe:
   - **Código:** identificador obligatorio al crear. Ejemplos: `2839-DIU`, `2839-NOC`, `2740`.
   - **Nombre:** obligatorio. Ejemplo: `Administración de Empresas`.
   - **Número de resolución:** obligatorio, máximo 15 caracteres. Ejemplo: `Res. 016-2026`.
   - **Número de semestres:** entero entre 1 y 20. El valor inicial es 10.
   - **Facultad:** selección opcional.
   - **Apertura:** dato opcional asociado al programa.
4. Confirma el guardado. Usa el lápiz para editar o el botón de desactivar para retirar el programa sin borrar su historial.
5. **Ver Malla Curricular** abre el pensum del programa seleccionado.

## Coordinación de programas
Ruta: **Coordinación de programas**

1. Busca o selecciona el programa.
2. Selecciona **Gestionar coordinador**.
3. En el formulario, selecciona el coordinador activo y el programa vinculado.
4. Confirma el cambio y verifica el nombre asignado en el programa.

## Malla curricular
Ruta: **Malla Curricular** o **Programas → Ver Malla Curricular**

1. Selecciona el programa que vas a consultar o editar.
2. Consulta las asignaturas organizadas por semestres.
3. Usa las acciones disponibles para agregar o retirar relaciones del pensum.
4. Para crear o modificar una asignatura, abre el **Banco de Asignaturas**.
5. Después de guardar, verifica que el cambio aparezca en el semestre correcto.

No elimines una relación mientras se use en una programación vigente; el sistema puede rechazar la operación.

## Banco de asignaturas
Ruta: **Banco de Asignaturas**

1. Selecciona **Nueva asignatura** o **Nueva electiva**.
2. Completa:
   - **Código:** obligatorio al crear, de 1 a 8 caracteres alfanuméricos. Solo mayúsculas, números, sin espacios ni guiones. Ejemplo: `751001C`.
   - **Nombre:** obligatorio, máximo 100 caracteres. Ejemplo: `Cálculo I`.
   - **Créditos:** número entero. Si no se informa una asignatura queda en 0.
   - **Horas semanales:** opcional, entero entre 1 y 20.
   - **Facultad:** selección disponible.
   - **Electiva:** activa el comportamiento de asignatura electiva.
   - **Complementaria** o **Básica:** marca una sola opción, según corresponda.
3. Guarda y revisa el listado.
4. Para desactivar, selecciona la asignatura y confirma la operación. La asignatura se conserva en el histórico.

## Plantilla administrativa
Ruta: **Plantilla**

En **Todos**, **Docentes** o **Coordinadores** puedes buscar por nombre, documento o filtros visibles.

### Registrar docente
1. Selecciona **Nuevo Docente**.
2. Ingresa código docente, nombres, apellidos y documento.
3. Escribe el correo institucional con dominio `@correounivalle.edu.co`.
4. Ingresa teléfono y celular como números sin espacios. Celular válido: 7 a 10 dígitos.
5. Selecciona tipo de docente:
   - `NOMBRADO`
   - `HORA_CATEDRA`
6. Selecciona categoría:
   - `AUXILIAR`
   - `ASISTENTE`
   - `ASOCIADO`
   - `TITULAR`
7. Selecciona facultad y guarda.

### Registrar coordinador
1. Selecciona **Nuevo Coordinador**.
2. Ingresa número de documento, nombre completo, categoría, tipo de contrato y correo institucional.
3. Selecciona el programa académico vinculado o deja `-- Sin programa asignado --`.
4. Marca la cuenta como activa y guarda.

### Disponibilidad administrativa
1. Ubica al docente en la plantilla.
2. Abre **Registrar disponibilidad** en sus acciones.
3. Selecciona el período vigente y registra los bloques.

## Asociaciones docentes
Ruta: **Asociaciones docentes**

1. Selecciona **Asociar**.
2. Elige un docente activo.
3. El sistema mostrará su facultad y las asignaturas disponibles en esa facultad o malla.
4. Puedes seleccionar varias asignaturas.
5. Confirma con **Asociar**.
6. Para quitar una asociación, usa la acción correspondiente y confirma. El histórico se conserva y puede reactivarse.

## Asignación docente
Ruta: **Asignación Docente**

1. Selecciona el período activo.
2. Elige programa, jornada y semestre.
3. Consulta los cursos pendientes o asignados.
4. Selecciona **Designar** en el curso.
5. Filtra docentes por programa, disponibilidad, evaluación y carga.
6. Elige distribución en uno o dos días:
   - Una sesión: un día y una franja.
   - Dos sesiones: dos días diferentes y una franja por día.
7. Confirma la asignación.
8. Usa **Desasignar** únicamente si quieres retirar al docente del curso.

## Programación y cohortes
Ruta: **Programación y Cohortes**

1. Selecciona el período académico.
2. Elige el programa y la cohorte.
3. Consulta los cursos y cupos disponibles.
4. Aplica los cambios permitidos y confirma.
5. Vuelve a consultar para verificar cupos y estado.

## Bitácora
Ruta: **Bitácora**

La bitácora es solo lectura.

Filtros disponibles:
- **Usuario:** correo o nombre.
- **Entidad:** por ejemplo `CURSO`, `PERIODO`, `PROGRAMA` o `SESION`.
- **Periodo:** nombre del período registrado.
- **Desde:** fecha inicial `DD/MM/AAAA`.
- **Hasta:** fecha final `DD/MM/AAAA`.

La fecha indicada para el filtro se aplica sobre el rango completo. La columna **Detalle** permite ver valor anterior y valor nuevo. Si el rango Desde sea posterior a Hasta, el sistema mostrará un error.

## Mi perfil
Ruta: **Mi perfil**

Consulta el nombre, correo institucional, rol y cuenta activa. Esta vista identifica la sesión actual y no reemplaza la gestión de docentes o coordinadores.
