import React, { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from './components/layout/Navbar'
import PensumView from './components/pensum/PensumView'
import ProgramasView from './components/programas/ProgramasView'
import ProgramasCoordinadoresView from './components/programas/ProgramasCoordinadoresView'
import AsignaturasView from './components/asignaturas/AsignaturasView'
import PlantillaView from './components/plantilla/PlantillaView'
import PeriodosView from './components/periodos/PeriodosView'
import DedicatedInProgressView from './components/layout/DedicatedInProgressView'
import MiPerfilView from './components/perfil/MiPerfilView'
import DisponibilidadView from './components/disponibilidad/DisponibilidadView'
import SqlSetupModal from './components/layout/SqlSetupModal'
import Toast from './components/layout/Toast'
import {
  getProgramas,
  getAsignaturas,
  getAllPensum,
  checkDatabaseHealth
} from './services/academicService'
import { getMiPerfilCoordinador } from './services/docenteService'
import { AlertCircle, Database, RefreshCw } from 'lucide-react'
import './App.css'

// Si el backend ya trae nombre y créditos (lo normal) no se vuelve a cruzar nada en el navegador;
// solo se completa cuando la fila viene del fallback de Supabase sin esos campos.
const withCourseInfo = (item, asigMap) => {
  if (item.name_course && item.credits !== undefined && item.credits !== null) return item
  const asig = asigMap.get(item.code_course)
  return {
    ...item,
    name_course: item.name_course || asig?.name_course || item.code_course,
    credits: item.credits ?? asig?.credits ?? 0,
  }
}

export default function App({ user, onLogout }) {
  const rol = Number(user?.rol ?? 1) // 1: Admin, 2: Coordinador, 3: Docente
  const isAdmin = rol === 1
  const isCoordinador = rol === 2
  const isDocente = rol === 3
  const canSeeAcademicData = isAdmin || isCoordinador

  // Todos los roles ingresan primero a la pantalla de bienvenida "Bienvenido a CDA"
  const [activeTab, setActiveTab] = useState('inicio')

  const [programas, setProgramas] = useState([])
  const [asignaturas, setAsignaturas] = useState([])
  const [pensumList, setPensumList] = useState([])
  const [selectedProgramCode, setSelectedProgramCode] = useState('')
  const [coordinadorPerfil, setCoordinadorPerfil] = useState(null)
  // HU-037: programa a editar al llegar a «Programas» desde «Programas y coordinadores»
  const [programaCoordinadorCode, setProgramaCoordinadorCode] = useState(null)

  const [loading, setLoading] = useState(!isDocente)
  const [initialError, setInitialError] = useState(null)
  const [isConnected, setIsConnected] = useState(true)
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  // Evita que una carga lenta pise a una más reciente
  const loadSeq = useRef(0)

  // Carga global de datos desde Backend / Supabase
  const loadData = useCallback(async (isSilent = false) => {
    if (isDocente) {
      setLoading(false)
      return
    }

    const seq = ++loadSeq.current
    if (!isSilent) setLoading(true)
    setInitialError(null)

    // El health check corre en paralelo: ya no retrasa la carga de datos
    checkDatabaseHealth()
      .then(h => { if (seq === loadSeq.current) setIsConnected(h.connected) })
      .catch(() => { if (seq === loadSeq.current) setIsConnected(false) })

    try {
      const [progs, asigs, pensum, coordData] = await Promise.all([
        canSeeAcademicData ? getProgramas() : Promise.resolve([]),
        canSeeAcademicData ? getAsignaturas() : Promise.resolve([]),
        canSeeAcademicData ? getAllPensum() : Promise.resolve([]),
        isCoordinador && user?.email
          ? getMiPerfilCoordinador(user.email).catch(() => null)
          : Promise.resolve(null)
      ])
      if (seq !== loadSeq.current) return

      const asigMap = new Map(asigs.map(a => [a.code_course, a]))
      setProgramas(progs)
      setAsignaturas(asigs)
      setPensumList(pensum.map(item => withCourseInfo(item, asigMap)))

      if (isCoordinador) {
        setCoordinadorPerfil(coordData)
        if (coordData?.code_program) {
          setSelectedProgramCode(coordData.code_program)
        } else {
          setSelectedProgramCode('')
        }
      } else if (progs.length > 0) {
        // Si no hay programa seleccionado (o ya no existe), seleccionar el primero
        setSelectedProgramCode(prev =>
          progs.some(p => p.code_program === prev) ? prev : progs[0].code_program
        )
      }
    } catch (err) {
      if (seq !== loadSeq.current) return
      console.error('Error al cargar datos:', err)
      setInitialError(err.message || 'No fue posible cargar la información académica')
    } finally {
      if (seq === loadSeq.current && !isSilent) setLoading(false)
    }
  }, [canSeeAcademicData, isCoordinador, isDocente, user?.email])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGestionarCoordinador = (code) => {
    setProgramaCoordinadorCode(code)
    setActiveTab('programas')
  }

  const handleSelectProgramForPensum = (code) => {
    setSelectedProgramCode(code)
    setActiveTab('pensum')
  }

  const coordinadorProgramCode = coordinadorPerfil?.code_program || null
  const programasParaPensum = isCoordinador
    ? (coordinadorProgramCode ? programas.filter(p => p.code_program === coordinadorProgramCode) : [])
    : programas

  return (
    <div className="app-layout">
      {/* Barra superior de navegación */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
        isConnected={isConnected}
        user={user}
        onLogout={onLogout}
      />

      {/* Alerta si ocurre un error de RLS o configuración */}
      {initialError && !isDocente && (
        <div className="system-alert-banner">
          <div className="alert-content">
            <AlertCircle size={20} className="text-warning" />
            <div>
              <strong>Aviso de carga académica:</strong> {initialError}
              <p className="alert-hint">
                El inicio de sesión puede funcionar aunque falle una consulta académica. Revisa el backend y las migraciones si el problema persiste.
              </p>
            </div>
          </div>
          <div className="alert-actions">
            <button className="btn-secondary btn-sm" onClick={() => setIsSqlModalOpen(true)}>
              <Database size={14} /> Ver Script SQL y Triggers
            </button>
            <button className="btn-primary btn-sm" onClick={() => loadData()}>
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="main-content">
        {loading ? (
          <div className="loading-state-container">
            <div className="spinner"></div>
            <p>Conectando con el sistema y cargando mallas curriculares...</p>
          </div>
        ) : (
          <>
            {/* Pantalla de bienvenida institucional "Bienvenido a CDA" */}
            {(activeTab === 'inicio' || activeTab === 'docente_portal' || activeTab === 'coordinador_portal') && (
              <DedicatedInProgressView
                user={user}
                coordinadorPerfil={coordinadorPerfil}
                onNavigate={setActiveTab}
                onLogout={onLogout}
              />
            )}

            {/* Disponibilidad docente: visible únicamente para el rol docente */}
            {isDocente && activeTab === 'disponibilidad' && <DisponibilidadView />}

            {/* Períodos Académicos (Resolución de Calendario) */}
            {activeTab === 'periodos' && (
              <PeriodosView user={user} onShowToast={showToast} />
            )}

            {/* Malla Curricular */}
            {activeTab === 'pensum' && (
              <PensumView
                programas={programasParaPensum}
                asignaturas={asignaturas}
                selectedProgramCode={isCoordinador ? (coordinadorProgramCode || '') : selectedProgramCode}
                setSelectedProgramCode={isCoordinador ? () => {} : setSelectedProgramCode}
                pensumList={pensumList}
                onRefresh={() => loadData(true)}
                onShowToast={showToast}
                onNavigateToAsignaturas={() => setActiveTab('asignaturas')}
                onNavigateToProgramas={() => setActiveTab('programas')}
                canEdit
                isProgramLocked={isCoordinador}
              />
            )}

            {/* Programas */}
            {activeTab === 'programas' && (
              <ProgramasView
                programas={programas}
                pensumList={pensumList}
                onRefresh={() => loadData(true)}
                onShowToast={showToast}
                onSelectProgramForPensum={handleSelectProgramForPensum}
                canAssignCoordinator={isAdmin}
                initialEditCode={programaCoordinadorCode}
                onInitialEditHandled={() => setProgramaCoordinadorCode(null)}
              />
            )}

            {/* Programas y coordinadores (HU-037): solo administrador */}
            {isAdmin && activeTab === 'programas_coordinadores' && (
              <ProgramasCoordinadoresView
                onGestionarCoordinador={handleGestionarCoordinador}
                onShowToast={showToast}
                onRefresh={() => loadData(true)}
              />
            )}

            {/* Banco de Asignaturas */}
            {activeTab === 'asignaturas' && (
              <AsignaturasView
                asignaturas={asignaturas}
                programas={programas}
                pensumList={pensumList}
                onRefresh={() => loadData(true)}
                onShowToast={showToast}
              />
            )}

            {/* Plantilla Administrativa */}
            {(activeTab === 'plantilla' || activeTab === 'coordinadores') && (
              <PlantillaView
                programas={programas}
                onShowToast={showToast}
              />
            )}

            {/* Mi Perfil */}
            {activeTab === 'mi-perfil' && (
              <MiPerfilView
                user={user}
                onShowToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Modal de Configuración SQL */}
      <SqlSetupModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        onRefreshData={() => loadData(true)}
      />

      {/* Notificaciones flotantes (Toast) */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
