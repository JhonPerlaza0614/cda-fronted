# Períodos académicos

## Qué se consulta
- Período vigente en la sección superior.
- Períodos históricos debajo.
- Número de resolución.
- Fechas de resolución y semestre.
- Rango de adiciones y cancelaciones.
- Plazos docente y coordinador.
- Enlace público de la resolución.

Las fechas simples se muestran como `DD/MM/AAAA`. Los plazos se muestran con fecha y hora de Bogotá.

## Crear período
1. Selecciona **Nuevo período académico**.
2. Escribe el nombre, máximo 20 caracteres. Ejemplo: `2026-2`.
3. Escribe el número de resolución. Ejemplo: `Resolución 045 de 2026`.
4. Selecciona las fechas:
   - Resolución.
   - Inicio del semestre.
   - Fin del semestre.
   - Inicio y fin de adiciones.
   - Inicio y fin de cancelaciones.
5. Selecciona inicio y fin del plazo docente.
6. Opcional: selecciona inicio y fin del plazo coordinador.
7. Opcional: pega una dirección válida que comience por `http://` o `https://`.
8. Confirma el resumen y selecciona **Guardar período**.

Ejemplo de rangos válidos:
- Nombre: `2026-2`
- Resolución: `Res. 015-2026`
- Inicio semestre: `20/07/2026`
- Fin semestre: `28/11/2026`
- Adiciones: `20/07/2026` a `24/07/2026`
- Cancelaciones: `27/07/2026` a `14/08/2026`
- Plazo docente: `18/07/2026 08:00` a `22/07/2026 18:00`

## Reglas que bloquean el guardado
- Nombre vacío o mayor de 20 caracteres.
- Número de resolución vacío o repetido.
- Fin del semestre igual o anterior al inicio.
- Fechas de adición o cancelación fuera del semestre.
- Rangos de adición o cancelación invertidos.
- Adiciones y cancelaciones que se solapan.
- Fin del plazo docente igual o anterior al inicio.
- Solo uno de los dos límites del plazo coordinador.
- Enlace que no use `http` o `https`.

## Editar
Solo el período vigente puede mostrar acciones de edición para el administrador.

1. Abre **Ver detalle**.
2. Selecciona **Editar**.
3. Modifica los campos y vuelve a confirmar.
4. Verifica que las fechas cumplan todas las reglas.

## Eliminar o desactivar
1. Abre el detalle del período.
2. Selecciona **Eliminar**.
3. Lee la advertencia: quedará sin período vigente y se cerrarán los plazos.
4. Selecciona **Aceptar**.

El registro pasa a historial y no se elimina físicamente. Después de esta operación, crea o activa otro período antes de abrir nuevas designaciones.
