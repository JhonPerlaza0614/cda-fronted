# Bitácora

## Resultado de la consulta
La tabla muestra 20 registros por página y contiene:
- Fecha y hora.
- Usuario.
- Rol.
- Acción.
- Entidad.
- Período.
- Detalle.

Los roles se presentan como `Administrador`, `Coordinador` y `Docente`. Las entidades conocidas son `Sesión`, `Curso`, `Período` y `Programa`.

## Filtros
### Usuario
Escribe correo o nombre completo. Ejemplo: `ana.rodriguez@correounivalle.edu.co`.

### Entidad
Escribe el valor exacto o busca la entidad visible:
- `SESION`
- `CURSO`
- `PERIODO`
- `PROGRAMA`

Ejemplo válido: `CURSO`.

### Período
Selecciona un período del listado o deja `Todos los periodos`.

Ejemplo válido:
- `2026-2`

### Desde y Hasta
Usa los selectores de fecha. El formato mostrado es `DD/MM/AAAA`.

Ejemplo de rango válido:
- Desde: `01/07/2026`
- Hasta: `31/07/2026`

El rango es inclusivo y debe tener desde menor o igual que hasta. Si desde es posterior a hasta, el backend devuelve un error.

## Flujo recomendado
1. Completa los filtros que necesitas.
2. Selecciona **Buscar**.
3. Revisa la cantidad de registros y la página actual.
4. Selecciona **Ver cambios** para comparar valor anterior y valor nuevo.
5. Usa **Anterior** o **Siguiente** para cambiar de página.
6. Usa **Limpiar** para retirar todos los filtros.
7. Usa **Actualizar** para repetir la consulta actual.

## Lectura de registros
- `Ingreso aceptado`: acceso válido.
- `Ingreso rechazado`: incluye el motivo, por ejemplo dominio no institucional, cuenta no registrada o perfil desactivado.
- `Creación`, `Edición`, `Eliminación`, `Desactivación` o `Reactivación`: cambios sobre entidades.
- `—`: no hay valores anteriores o nuevos disponibles.

No se pueden modificar ni borrar registros desde esta pantalla.
