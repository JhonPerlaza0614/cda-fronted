import React, { useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';

const ROLE_FILES = {
  1: 'admin_manual.md',
  2: 'coordinator_manual.md',
  3: 'teacher_manual.md',
};

const MODULE_NAMES = {
  inicio: 'Bienvenida',
  pensum: 'Malla curricular',
  programas: 'Programas',
  asignaturas: 'Banco de asignaturas',
  asociaciones: 'Asociaciones docentes',
  bitacora: 'Bitácora',
  programas_coordinadores: 'Coordinación de programas',
  plantilla: 'Plantilla',
  coordinadores: 'Coordinadores',
  periodos: 'Períodos académicos',
  programacion_cohortes: 'Programación y cohortes',
  asignacion_docente: 'Asignación docente',
  disponibilidad: 'Disponibilidad docente',
  disponibilidad_admin: 'Disponibilidad administrativa',
  mis_cursos: 'Mis cursos',
  'mi-perfil': 'Mi perfil',
};

function InlineText({ text }) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g);
  return pieces.map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      return <strong key={index}>{piece.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{piece}</React.Fragment>;
  });
}

function MarkdownText({ content }) {
  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let orderedItems = [];

  const flushOrderedList = () => {
    if (orderedItems.length) {
      elements.push(
        <ol key={`ordered-list-${elements.length}`}>
          {orderedItems.map((item, index) => (
            <li key={index}><InlineText text={item} /></li>
          ))}
        </ol>
      );
      orderedItems = [];
    }
  };

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`list-${elements.length}`}>
          {listItems.map((item, index) => (
            <li key={index}><InlineText text={item} /></li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushOrderedList();
      return;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      flushOrderedList();
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#+\s*/, '');
      if (level === 1) elements.push(<h2 key={index}>{text}</h2>);
      else if (level === 2) elements.push(<h3 key={index}>{text}</h3>);
      else elements.push(<h4 key={index}>{text}</h4>);
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      orderedItems.push(trimmed.replace(/^\d+\.\s*/, ''));
      return;
    }
    if (/^[-*]\s/.test(trimmed)) {
      flushOrderedList();
      listItems.push(trimmed.replace(/^[-*]\s*/, ''));
      return;
    }
    flushList();
    flushOrderedList();
    elements.push(<p key={index}><InlineText text={trimmed} /></p>);
  });
  flushList();
  flushOrderedList();

  return <div className="manual-markdown">{elements}</div>;
}

export default function ManualViewer({ role, activeTab = 'inicio', isOpen, onClose }) {
  const [content, setContent] = useState('Cargando manual…');
  const [moduleContent, setModuleContent] = useState('');
  const [activeView, setActiveView] = useState('general');

  useEffect(() => {
    if (!isOpen) return;
    setActiveView(activeTab === 'inicio' || activeTab === 'docente_portal' || activeTab === 'coordinador_portal' ? 'general' : 'module');
    setContent('Cargando manual…');
    setModuleContent('');

    const roleFile = ROLE_FILES[Number(role)];
    if (!roleFile) {
      setContent('No se encontró manual para este rol.');
      return;
    }

    Promise.all([
      fetch(`/manuals/${roleFile}`).then((res) => {
        if (!res.ok) throw new Error('manual general');
        return res.text();
      }),
      activeTab !== 'inicio' && activeTab !== 'docente_portal' && activeTab !== 'coordinador_portal'
        ? fetch(`/manuals/modules/${activeTab}.md`).then((res) => res.ok ? res.text() : '')
        : Promise.resolve(''),
    ])
      .then(([general, module]) => {
        setContent(general);
        setModuleContent(module);
      })
      .catch(() => setContent('No se pudo cargar el manual.'));
  }, [isOpen, role, activeTab]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isModuleAvailable = Boolean(moduleContent);
  const moduleName = MODULE_NAMES[activeTab] || 'Módulo';

  return (
    <div className="modal-backdrop manual-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className="modal-card modal-large manual-modal" role="dialog" aria-modal="true" aria-label="Manual de usuario">
        <div className="modal-header manual-modal-header">
          <div className="modal-title-with-icon">
            <BookOpen size={22} className="text-primary" />
            <div>
              <h2>Manual de usuario</h2>
              <span className="manual-modal-subtitle">{activeView === 'module' ? moduleName : 'Guía general'}</span>
            </div>
          </div>
          <button type="button" className="modal-close-btn manual-modal-close" onClick={onClose} aria-label="Cerrar manual">×</button>
        </div>

        {isModuleAvailable && (
          <div className="manual-tabs" role="tablist" aria-label="Tipo de manual">
            <button type="button" className={activeView === 'general' ? 'active' : ''} onClick={() => setActiveView('general')}>
              Manual general
            </button>
            <button type="button" className={activeView === 'module' ? 'active' : ''} onClick={() => setActiveView('module')}>
              Manual del módulo
            </button>
          </div>
        )}

        <div className="modal-body manual-modal-body">
          <MarkdownText content={activeView === 'module' && isModuleAvailable ? moduleContent : content} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
