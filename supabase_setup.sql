-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.asignaturas (
  code_course character varying NOT NULL,
  name_course character varying NOT NULL,
  credits integer,
  is_elective boolean NOT NULL DEFAULT false,
  id_facultad integer,
  es_complementaria boolean DEFAULT false,
  es_basica boolean DEFAULT false,
  facultad character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT asignaturas_pkey PRIMARY KEY (code_course),
  CONSTRAINT asignaturas_id_facultad_fkey FOREIGN KEY (id_facultad) REFERENCES public.Facultad(id)
);
CREATE TABLE public.programas (
  code_program character varying NOT NULL,
  name_program character varying NOT NULL,
  numero_semestre integer,
  id_facultad_programa integer,
  semestres_nocturna integer,
  apertura character varying CHECK (apertura IS NULL OR (apertura::text = ANY (ARRAY['SEMESTRAL'::character varying, 'ANUAL'::character varying]::text[]))),
  jornada character varying NOT NULL DEFAULT 'DIURNA'::character varying CHECK (jornada::text = ANY (ARRAY['DIURNA'::character varying, 'NOCTURNA'::character varying, 'AMBAS'::character varying]::text[])),
  ingreso character varying NOT NULL DEFAULT 'SEMESTRAL'::character varying CHECK (ingreso::text = ANY (ARRAY['SEMESTRAL'::character varying, 'ANUAL'::character varying]::text[])),
  estado character varying NOT NULL DEFAULT 'ACTIVO'::character varying CHECK (estado::text = ANY (ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying]::text[])),
  numero_resolucion character varying,
  CONSTRAINT programas_pkey PRIMARY KEY (code_program),
  CONSTRAINT programas_id_facultad_programa_fkey FOREIGN KEY (id_facultad_programa) REFERENCES public.Facultad(id)
);
CREATE TABLE public.pensum_academico (
  code_program character varying NOT NULL,
  code_course character varying NOT NULL DEFAULT ''::character varying,
  semestre integer NOT NULL,
  facultad character varying,
  is_elective boolean,
  activo boolean NOT NULL DEFAULT true,
  fecha_desactivacion timestamp without time zone,
  fecha_reactivacion timestamp without time zone,
  version integer NOT NULL DEFAULT 1,
  vigente boolean NOT NULL DEFAULT true,
  numero_resolucion character varying,
  numero_semestres integer,
  editada boolean NOT NULL DEFAULT false,
  fecha_edicion timestamp without time zone,
  name_course_snapshot character varying,
  CONSTRAINT pensum_academico_pkey PRIMARY KEY (code_program, code_course, version),
  CONSTRAINT pensum_academico_code_program_fkey FOREIGN KEY (code_program) REFERENCES public.programas(code_program),
  CONSTRAINT pensum_academico_code_course_fkey FOREIGN KEY (code_course) REFERENCES public.asignaturas(code_course)
);
CREATE TABLE public.Facultad (
  id integer NOT NULL DEFAULT nextval('"Facultad_id_seq"'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  CONSTRAINT Facultad_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios (
  id integer NOT NULL DEFAULT nextval('"Usuario_id_seq"'::regclass),
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  telefono integer,
  email_institucional character varying NOT NULL,
  email_personal character varying NOT NULL,
  rol integer NOT NULL,
  detalle_docente text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.flyway_schema_history (
  installed_rank integer NOT NULL,
  version character varying,
  description character varying NOT NULL,
  type character varying NOT NULL,
  script character varying NOT NULL,
  checksum integer,
  installed_by character varying NOT NULL,
  installed_on timestamp without time zone NOT NULL DEFAULT now(),
  execution_time integer NOT NULL,
  success boolean NOT NULL,
  CONSTRAINT flyway_schema_history_pkey PRIMARY KEY (installed_rank)
);
CREATE TABLE public.coordinadores (
  id integer NOT NULL DEFAULT nextval('coordinadores_id_seq'::regclass),
  identificacion character varying NOT NULL UNIQUE,
  nombre_completo character varying NOT NULL,
  correo character varying,
  correo_institucional character varying NOT NULL UNIQUE,
  telefono character varying,
  code_program character varying,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  categoria character varying DEFAULT 'Auxiliar'::character varying,
  tipo_contrato character varying,
  id_categoria integer,
  id_tipo_contrato integer,
  CONSTRAINT coordinadores_pkey PRIMARY KEY (id),
  CONSTRAINT fk_coordinador_programa FOREIGN KEY (code_program) REFERENCES public.programas(code_program),
  CONSTRAINT fk_coordinador_categoria FOREIGN KEY (id_categoria) REFERENCES public.categoria(id),
  CONSTRAINT fk_coordinador_tipo_contrato FOREIGN KEY (id_tipo_contrato) REFERENCES public.tipo_contrato(id)
);
CREATE TABLE public.tipo_contrato (
  id integer NOT NULL DEFAULT nextval('tipo_contrato_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  CONSTRAINT tipo_contrato_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categoria (
  id integer NOT NULL DEFAULT nextval('categoria_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  CONSTRAINT categoria_pkey PRIMARY KEY (id)
);
CREATE TABLE public.docentes (
  id bigint NOT NULL DEFAULT nextval('docentes_id_seq'::regclass),
  codigo character varying NOT NULL UNIQUE,
  nombres character varying NOT NULL,
  apellidos character varying NOT NULL,
  tipo_documento character varying NOT NULL CHECK (tipo_documento::text = ANY (ARRAY['CC'::character varying, 'CE'::character varying, 'PP'::character varying]::text[])),
  numero_documento character varying NOT NULL UNIQUE,
  correo_institucional character varying NOT NULL UNIQUE,
  telefono character varying,
  tipo_docente character varying NOT NULL CHECK (tipo_docente::text = ANY (ARRAY['NOMBRADO'::character varying, 'HORA_CATEDRA'::character varying]::text[])),
  categoria character varying NOT NULL CHECK (categoria::text = ANY (ARRAY['AUXILIAR'::character varying, 'ASISTENTE'::character varying, 'ASOCIADO'::character varying, 'TITULAR'::character varying]::text[])),
  code_program character varying,
  foto_url character varying,
  evaluacion_periodo character varying,
  evaluacion_valor numeric,
  estado boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  correo_personal character varying,
  id_facultad integer,
  CONSTRAINT docentes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_docentes_programa FOREIGN KEY (code_program) REFERENCES public.programas(code_program),
  CONSTRAINT docentes_id_facultad_fkey FOREIGN KEY (id_facultad) REFERENCES public.Facultad(id)
);
CREATE TABLE public.disponibilidades_docentes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_docente bigint NOT NULL,
  dia integer NOT NULL CHECK (dia >= 1 AND dia <= 6),
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  periodo_id bigint NOT NULL,
  CONSTRAINT disponibilidades_docentes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_disponibilidad_periodo FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id),
  CONSTRAINT fk_disponibilidad_docente FOREIGN KEY (id_docente) REFERENCES public.docentes(id)
);
CREATE TABLE public.periodos_academicos (
  id bigint NOT NULL DEFAULT nextval('periodos_academicos_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  numero_resolucion character varying NOT NULL UNIQUE,
  fecha_resolucion date NOT NULL,
  fecha_inicio_semestre date NOT NULL,
  fecha_fin_semestre date NOT NULL,
  fecha_adicion_inicio date NOT NULL,
  fecha_adicion_fin date NOT NULL,
  fecha_cancelacion_inicio date NOT NULL,
  fecha_cancelacion_fin date NOT NULL,
  plazo_docente_inicio timestamp with time zone NOT NULL,
  plazo_docente_fin timestamp with time zone NOT NULL,
  plazo_coordinador_inicio timestamp with time zone,
  plazo_coordinador_fin timestamp with time zone,
  enlace_resolucion text,
  vigente boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado character varying NOT NULL DEFAULT 'VIGENTE'::character varying CHECK (estado::text = ANY (ARRAY['VIGENTE'::character varying, 'HISTORIAL'::character varying, 'DESACTIVADO'::character varying]::text[])),
  CONSTRAINT periodos_academicos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.docente_fotos (
  id bigint NOT NULL DEFAULT nextval('docente_fotos_id_seq'::regclass),
  docente_id bigint NOT NULL UNIQUE,
  contenido bytea NOT NULL,
  tipo_mime character varying NOT NULL CHECK (tipo_mime::text = ANY (ARRAY['image/jpeg'::character varying, 'image/png'::character varying]::text[])),
  tamano_bytes integer NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
  activa boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT docente_fotos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_docente_fotos_docente FOREIGN KEY (docente_id) REFERENCES public.docentes(id)
);
CREATE TABLE public.resolucion_asignaturas (
  semestre integer NOT NULL,
  code_course character varying NOT NULL,
  resolucion_id bigint NOT NULL,
  CONSTRAINT resolucion_asignaturas_pkey PRIMARY KEY (code_course, resolucion_id),
  CONSTRAINT fk48d3jgwldlih42sx1wtg5iouk FOREIGN KEY (code_course) REFERENCES public.asignaturas(code_course)
);
CREATE TABLE public.periodos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  enlace_resolucion character varying,
  estado character varying NOT NULL CHECK (estado::text = ANY (ARRAY['VIGENTE'::character varying, 'HISTORICO'::character varying, 'DESACTIVADO'::character varying]::text[])),
  fecha_adicion date,
  fecha_cancelacion date,
  fecha_desactivacion timestamp with time zone,
  fin_semestre date NOT NULL,
  inicio_semestre date NOT NULL,
  nombre character varying NOT NULL,
  numero_resolucion character varying,
  plazo_coordinadores_fin timestamp with time zone,
  plazo_coordinadores_inicio timestamp with time zone,
  plazo_docentes_fin timestamp with time zone,
  plazo_docentes_inicio timestamp with time zone,
  CONSTRAINT periodos_pkey PRIMARY KEY (id)
);


CREATE TABLE public.cohortes_periodo (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  periodo_id bigint NOT NULL,
  code_program character varying NOT NULL,
  semestre integer NOT NULL CHECK (semestre >= 1 AND semestre <= 20),
  jornada character varying NOT NULL DEFAULT 'DIURNA'::character varying CHECK (jornada::text = ANY (ARRAY['DIURNA'::character varying, 'NOCTURNA'::character varying]::text[])),
  numero_resolucion character varying NOT NULL,
  confirmada boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cohortes_periodo_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cohortes_periodo FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id),
  CONSTRAINT fk_cohortes_programa FOREIGN KEY (code_program) REFERENCES public.programas(code_program),
  CONSTRAINT uq_cohorte_programa_periodo_semestre_jornada UNIQUE (periodo_id, code_program, semestre, jornada)
);

CREATE TABLE public.cursos_programacion (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  periodo_id bigint NOT NULL,
  code_program character varying NOT NULL,
  code_course character varying NOT NULL,
  semestre integer NOT NULL,
  jornada character varying NOT NULL DEFAULT 'DIURNA'::character varying CHECK (jornada::text = ANY (ARRAY['DIURNA'::character varying, 'NOCTURNA'::character varying]::text[])),
  numero_resolucion character varying NOT NULL,
  grupo integer,
  credits integer NOT NULL DEFAULT 0,
  nombre_asignatura character varying NOT NULL,
  id_docente bigint,
  estado character varying NOT NULL DEFAULT 'PROGRAMADO'::character varying CHECK (estado::text = ANY (ARRAY['PROGRAMADO'::character varying, 'ASIGNADO'::character varying, 'EXCLUIDO'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cursos_programacion_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cursos_periodo FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id),
  CONSTRAINT fk_cursos_programa FOREIGN KEY (code_program) REFERENCES public.programas(code_program),
  CONSTRAINT fk_cursos_asignatura FOREIGN KEY (code_course) REFERENCES public.asignaturas(code_course),
  CONSTRAINT fk_cursos_docente FOREIGN KEY (id_docente) REFERENCES public.docentes(id),
  CONSTRAINT uq_curso_periodo_programa_materia_jornada UNIQUE (periodo_id, code_program, code_course, jornada)
);
