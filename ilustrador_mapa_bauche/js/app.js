/**
 * app.js - Inicializacion principal de la aplicacion
 * Editor Plano San Rafael
 */

// Estado global de la aplicacion
const AppState = {
    db: null,
    canvas: null,
    modoActual: 'select',
    loteSeleccionado: null,
    imagenCargada: false,
    cambiosSinGuardar: false,
    modoAnterior: null,
    proyectoActual: null, // ID del proyecto abierto
    imagenFondo: null
};

// Sistema de Undo
const UndoManager = {
    historial: [],
    maxHistorial: 50,

    guardarEstado() {
        const canvas = AppState.canvas;
        if (!canvas) return;

        const objetos = canvas.getObjects().filter(o => o !== AppState.imagenFondo);
        const estado = objetos.map(obj => {
            const base = {
                type: obj.type,
                left: obj.left,
                top: obj.top,
                fill: obj.fill,
                angle: obj.angle
            };

            if (obj.type === 'i-text') {
                base.text = obj.text;
                base.textoId = obj.textoId;
                base.loteId = obj.loteId;
                base.esOficial = obj.esOficial;
                base.fontSize = obj.fontSize;
            } else if (obj.type === 'line' && obj.esLineaDivisoria) {
                base.x1 = obj.x1;
                base.y1 = obj.y1;
                base.x2 = obj.x2;
                base.y2 = obj.y2;
                base.stroke = obj.stroke;
                base.strokeWidth = obj.strokeWidth;
                base.lineaId = obj.lineaId;
                base.esLineaDivisoria = true;
            }

            return base;
        });

        this.historial.push(JSON.stringify(estado));

        if (this.historial.length > this.maxHistorial) {
            this.historial.shift();
        }
    },

    deshacer() {
        if (this.historial.length < 2) {
            mostrarNotificacion('No hay mas acciones para deshacer', 'info');
            return;
        }

        this.historial.pop();
        const estadoAnterior = JSON.parse(this.historial[this.historial.length - 1]);

        const canvas = AppState.canvas;
        const objetosAEliminar = canvas.getObjects().filter(o => o !== AppState.imagenFondo);
        objetosAEliminar.forEach(o => canvas.remove(o));

        estadoAnterior.forEach(datos => {
            if (datos.type === 'i-text' && datos.text) {
                const texto = new fabric.IText(datos.text, {
                    left: datos.left,
                    top: datos.top,
                    fontSize: datos.fontSize || 14,
                    fill: datos.fill || '#0000FF',
                    fontFamily: 'Arial',
                    fontWeight: 'bold',
                    angle: datos.angle || 0,
                    editable: true,
                    textoId: datos.textoId,
                    loteId: datos.loteId,
                    esOficial: datos.esOficial
                });
                canvas.add(texto);
            } else if (datos.type === 'line' && datos.esLineaDivisoria) {
                const linea = new fabric.Line(
                    [datos.x1, datos.y1, datos.x2, datos.y2],
                    {
                        left: datos.left,
                        top: datos.top,
                        stroke: datos.stroke || '#8B0000',
                        strokeWidth: datos.strokeWidth || 2,
                        selectable: true,
                        evented: true,
                        hoverCursor: 'pointer',
                        lineaId: datos.lineaId,
                        esLineaDivisoria: true
                    }
                );
                canvas.add(linea);
            }
        });

        canvas.renderAll();
        mostrarNotificacion('Accion deshecha', 'success');
    },

    limpiar() {
        this.historial = [];
    }
};

// ==================== INICIALIZACION ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando Editor de Planos...');

    try {
        // Inicializar ProjectManager (IndexedDB)
        await ProjectManager.init();
        console.log('ProjectManager inicializado');

        // Mostrar vista de proyectos
        await renderizarProyectos();

        // Configurar eventos de la vista de proyectos
        setupProjectEvents();

        console.log('Aplicacion lista');
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarNotificacion('Error al inicializar la aplicacion', 'error');
    }
});

// ==================== GESTION DE PROYECTOS ====================

function setupProjectEvents() {
    // Crear proyecto
    document.getElementById('btn-crear-proyecto')?.addEventListener('click', () => {
        document.getElementById('modal-crear-proyecto').classList.remove('hidden');
        document.getElementById('proyecto-nombre').focus();
    });

    document.getElementById('btn-cancelar-proyecto')?.addEventListener('click', () => {
        document.getElementById('modal-crear-proyecto').classList.add('hidden');
        document.getElementById('form-crear-proyecto').reset();
    });

    document.getElementById('modal-crear-proyecto')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-crear-proyecto') {
            document.getElementById('modal-crear-proyecto').classList.add('hidden');
            document.getElementById('form-crear-proyecto').reset();
        }
    });

    document.getElementById('form-crear-proyecto')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('proyecto-nombre').value.trim();
        const imagenInput = document.getElementById('proyecto-imagen');
        const imagenFile = imagenInput.files[0];

        if (!nombre || !imagenFile) {
            mostrarNotificacion('Nombre e imagen son requeridos', 'error');
            return;
        }

        try {
            const proyectoId = await ProjectManager.crearProyecto(nombre, imagenFile);

            document.getElementById('modal-crear-proyecto').classList.add('hidden');
            document.getElementById('form-crear-proyecto').reset();

            mostrarNotificacion('Proyecto creado', 'success');

            // Abrir el proyecto recien creado
            await abrirProyecto(proyectoId);
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            mostrarNotificacion('Error al crear el proyecto', 'error');
        }
    });
}

async function renderizarProyectos() {
    const proyectos = await ProjectManager.obtenerProyectos();
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('projects-empty');

    if (proyectos.length === 0) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    empty.classList.add('hidden');
    grid.innerHTML = '';

    for (const proyecto of proyectos) {
        const card = document.createElement('div');
        card.className = 'project-card';

        const thumbUrl = ProjectManager.obtenerThumbnailURL(proyecto.id);

        const fecha = new Date(proyecto.fecha_modificacion).toLocaleDateString('es-CL');

        const totalLotes = proyecto.total_lotes || 0;

        card.innerHTML = `
            <div class="project-thumb">
                <img src="${thumbUrl}" alt="${proyecto.nombre}" onerror="this.style.display='none'">
            </div>
            <div class="project-info">
                <h3 class="project-name">${proyecto.nombre}</h3>
                <div class="project-meta">
                    <span class="project-lotes">${totalLotes} ${totalLotes === 1 ? 'lote' : 'lotes'}</span>
                    <span class="project-date">${fecha}</span>
                </div>
            </div>
            <div class="project-actions">
                <button class="btn btn-small btn-primary btn-abrir" data-id="${proyecto.id}">Abrir proyecto</button>
                <button class="btn btn-small btn-danger btn-eliminar-proyecto" data-id="${proyecto.id}">&times;</button>
            </div>
        `;

        // Eventos
        card.querySelector('.btn-abrir').addEventListener('click', () => {
            abrirProyecto(proyecto.id);
        });

        card.querySelector('.btn-eliminar-proyecto').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar el proyecto "${proyecto.nombre}"? Esta accion no se puede deshacer.`)) {
                await ProjectManager.eliminarProyecto(proyecto.id);
                await renderizarProyectos();
                mostrarNotificacion('Proyecto eliminado', 'success');
            }
        });

        // Double click to open
        card.addEventListener('dblclick', () => {
            abrirProyecto(proyecto.id);
        });

        grid.appendChild(card);
    }
}

async function abrirProyecto(proyectoId) {
    try {
        AppState.proyectoActual = proyectoId;

        // Obtener datos del proyecto
        const proyectos = await ProjectManager.obtenerProyectos();
        const proyecto = proyectos.find(p => p.id === proyectoId);

        if (!proyecto) {
            mostrarNotificacion('Proyecto no encontrado', 'error');
            return;
        }

        // Cambiar vista
        document.getElementById('projects-view').classList.add('hidden');
        document.getElementById('editor-view').classList.remove('hidden');

        // Actualizar titulo
        document.getElementById('editor-titulo').textContent = proyecto.nombre;

        // Inicializar BD
        const dbGuardada = await ProjectManager.obtenerDatabase(proyectoId);
        await initDatabase(dbGuardada);

        // Inicializar canvas
        initCanvas();

        // Cargar imagen del proyecto desde el servidor
        const imagenUrl = ProjectManager.obtenerImagenURL(proyectoId);
        await cargarImagenProyecto(imagenUrl);

        // Configurar eventos de UI del editor
        setupUIEvents();

        // Cargar lotes existentes al canvas
        const lotesExistentes = obtenerLotes();
        if (lotesExistentes.length > 0) {
            await cargarTodosLosElementos();
        }

        await cargarLotesEnLista();
        actualizarBarraEstado();

        // Limpiar undo
        UndoManager.limpiar();

        // Auto-guardado
        setupAutoSave();

        console.log('Proyecto abierto:', proyecto.nombre);
    } catch (error) {
        console.error('Error al abrir proyecto:', error);
        mostrarNotificacion('Error al abrir el proyecto', 'error');
    }
}

async function volverAProyectos() {
    // Guardar cambios actuales
    if (AppState.cambiosSinGuardar) {
        await guardarTodo();
    }

    // Limpiar auto-save
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }

    // Destruir canvas
    if (AppState.canvas) {
        AppState.canvas.dispose();
        AppState.canvas = null;
    }

    // Limpiar estado
    AppState.db = null;
    AppState.imagenFondo = null;
    AppState.imagenCargada = false;
    AppState.cambiosSinGuardar = false;
    AppState.loteSeleccionado = null;
    AppState.proyectoActual = null;
    UndoManager.limpiar();

    // Cambiar vista
    document.getElementById('editor-view').classList.add('hidden');
    document.getElementById('projects-view').classList.remove('hidden');

    // Recargar lista de proyectos
    await renderizarProyectos();
}

// ==================== RENOMBRAR PROYECTO ====================

async function renombrarProyecto() {
    if (!AppState.proyectoActual) return;

    const tituloEl = document.getElementById('editor-titulo');
    const nombreActual = tituloEl.textContent;
    const nuevoNombre = prompt('Nombre del proyecto:', nombreActual);

    if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre.trim() === nombreActual) return;

    try {
        const response = await fetch(`/api/projects/${AppState.proyectoActual}/metadata`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nuevoNombre.trim() })
        });

        if (response.ok) {
            tituloEl.textContent = nuevoNombre.trim();
            mostrarNotificacion('Proyecto renombrado', 'success');
        } else {
            mostrarNotificacion('Error al renombrar', 'error');
        }
    } catch (error) {
        console.error('Error al renombrar:', error);
        mostrarNotificacion('Error al renombrar', 'error');
    }
}

// ==================== EVENTOS DEL EDITOR ====================

let editorEventsSetup = false;

function setupUIEvents() {
    if (editorEventsSetup) return;
    editorEventsSetup = true;

    // Boton volver
    document.getElementById('btn-volver')?.addEventListener('click', volverAProyectos);

    // Click en titulo para renombrar proyecto
    document.getElementById('editor-titulo')?.addEventListener('click', renombrarProyecto);

    // Botones de herramientas
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const toolId = e.currentTarget.id;
            cambiarHerramienta(toolId.replace('tool-', ''));
        });
    });

    // Controles de zoom
    document.getElementById('zoom-in')?.addEventListener('click', () => hacerZoom(1.1));
    document.getElementById('zoom-out')?.addEventListener('click', () => hacerZoom(0.9));
    document.getElementById('zoom-fit')?.addEventListener('click', ajustarZoom);

    // Boton deshacer
    document.getElementById('btn-deshacer')?.addEventListener('click', () => UndoManager.deshacer());

    // Filtros de lotes
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filtrarLotes(e.target.dataset.filter);
        });
    });

    // Busqueda de lotes
    document.getElementById('buscar-lote')?.addEventListener('input', (e) => {
        buscarLotes(e.target.value);
    });

    // Importar base de datos
    document.getElementById('input-db')?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importarBaseDatos(e.target.files[0]);
        }
    });

    // Botones de toolbar
    document.getElementById('btn-guardar')?.addEventListener('click', guardarTodo);
    document.getElementById('btn-exportar-png')?.addEventListener('click', exportarPNG);
    document.getElementById('btn-exportar-excel')?.addEventListener('click', exportarLotesExcel);
    document.getElementById('btn-exportar-db')?.addEventListener('click', exportarBaseDatos);
    document.getElementById('btn-imprimir')?.addEventListener('click', imprimirCanvas);

    // Modal nuevo lote
    document.getElementById('btn-nuevo-lote')?.addEventListener('click', abrirModalNuevoLote);

    // Cargar datos iniciales (53 clientes)
    document.getElementById('btn-cargar-iniciales')?.addEventListener('click', async () => {
        if (typeof cargarDatosIniciales === 'function') {
            if (confirm('Se cargaran 53 clientes del listado San Rafael. ¿Continuar?')) {
                await cargarDatosIniciales();
                AppState.cambiosSinGuardar = true;
            }
        }
    });
    document.getElementById('btn-cancelar-lote')?.addEventListener('click', cerrarModalNuevoLote);
    document.getElementById('form-nuevo-lote')?.addEventListener('submit', crearNuevoLote);

    // Formulario propiedades
    document.getElementById('form-propiedades')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarPropiedadesLote();
    });
    document.getElementById('btn-eliminar-lote')?.addEventListener('click', eliminarLoteSeleccionado);

    // Cerrar modal al hacer clic fuera
    document.getElementById('modal-nuevo-lote')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-nuevo-lote') {
            cerrarModalNuevoLote();
        }
    });

    // Compartir proyecto
    document.getElementById('btn-compartir')?.addEventListener('click', compartirProyecto);
    document.getElementById('btn-cerrar-compartir')?.addEventListener('click', () => {
        document.getElementById('modal-compartir').classList.add('hidden');
    });
    document.getElementById('btn-copiar-link')?.addEventListener('click', () => {
        const input = document.getElementById('share-url');
        input.select();
        navigator.clipboard.writeText(input.value);
        mostrarNotificacion('Enlace copiado al portapapeles', 'success');
    });
    document.getElementById('modal-compartir')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-compartir') {
            document.getElementById('modal-compartir').classList.add('hidden');
        }
    });

    // Aviso antes de cerrar con cambios sin guardar
    window.addEventListener('beforeunload', (e) => {
        if (AppState.cambiosSinGuardar) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Atajos de teclado
    setupKeyboardShortcuts();
}

/**
 * Configura los atajos de teclado
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Solo en vista editor
        if (document.getElementById('editor-view').classList.contains('hidden')) return;

        // Espacio activa pan temporal
        if (e.code === 'Space' && !e.repeat) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (AppState.modoActual !== 'pan') {
                    AppState.modoAnterior = AppState.modoActual;
                    cambiarHerramienta('pan');
                }
            }
        }

        // No procesar otros atajos si estamos en un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        // Ctrl/Cmd + Z: Deshacer
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            UndoManager.deshacer();
            return;
        }

        // Ctrl/Cmd + S: Guardar
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            guardarTodo();
            return;
        }

        // Ctrl/Cmd + E: Exportar PNG
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            exportarPNG();
            return;
        }

        // Sin modificadores
        switch (e.key) {
            case 'v':
            case 'V':
                cambiarHerramienta('select');
                break;
            case 't':
            case 'T':
                cambiarHerramienta('text');
                break;
            case 'p':
            case 'P':
                if (!e.ctrlKey && !e.metaKey) {
                    cambiarHerramienta('polygon');
                }
                break;
            case 'l':
            case 'L':
                cambiarHerramienta('line');
                break;
            case 'm':
            case 'M':
                cambiarHerramienta('pan');
                break;
            case 'Delete':
            case 'Backspace':
                eliminarObjetoSeleccionado();
                break;
            case 'Escape':
                if (AppState.modoActual === 'polygon') {
                    cancelarPoligono();
                }
                cambiarHerramienta('select');
                deseleccionarLote();
                break;
            case '+':
            case '=':
                hacerZoom(1.1);
                break;
            case '-':
                hacerZoom(0.9);
                break;
            case '0':
                ajustarZoom();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            if (AppState.modoAnterior && AppState.modoActual === 'pan') {
                cambiarHerramienta(AppState.modoAnterior);
                AppState.modoAnterior = null;
            }
        }
    });
}

// ==================== FUNCIONES DEL EDITOR ====================

function eliminarObjetoSeleccionado() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    const objetoActivo = canvas.getActiveObject();
    if (!objetoActivo) return;

    UndoManager.guardarEstado();

    if (objetoActivo.textoId) {
        eliminarTexto(objetoActivo.textoId);
    }

    if (objetoActivo.lineaId && typeof eliminarLinea === 'function') {
        eliminarLinea(objetoActivo.lineaId);
    }

    canvas.remove(objetoActivo);
    canvas.renderAll();
    AppState.cambiosSinGuardar = true;
    mostrarNotificacion('Objeto eliminado', 'success');
}

let autoSaveInterval = null;

function setupAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    autoSaveInterval = setInterval(async () => {
        if (AppState.cambiosSinGuardar && AppState.proyectoActual) {
            console.log('Auto-guardando...');
            await guardarTodo();
        }
    }, 30000);
}

function cambiarHerramienta(herramienta) {
    AppState.modoActual = herramienta;

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tool-${herramienta}`);
    });

    if (AppState.canvas) {
        setCanvasMode(herramienta);
    }

    const modos = {
        'select': 'Seleccionar',
        'text': 'Agregar Texto',
        'polygon': 'Dibujar Poligono',
        'line': 'Dibujar Linea',
        'pan': 'Mover Vista'
    };
    document.getElementById('status-modo').textContent = `Modo: ${modos[herramienta] || herramienta}`;
}

function actualizarBarraEstado() {
    const totalLotes = obtenerTotalLotes();
    document.getElementById('status-lotes').textContent = `${totalLotes} lotes`;
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const anterior = document.querySelector('.notification');
    if (anterior) anterior.remove();

    const notif = document.createElement('div');
    notif.className = `notification ${tipo}`;
    notif.textContent = mensaje;
    document.body.appendChild(notif);

    setTimeout(() => notif.remove(), 3000);
}

// ==================== MODAL NUEVO LOTE ====================

function abrirModalNuevoLote() {
    document.getElementById('modal-nuevo-lote').classList.remove('hidden');
    document.getElementById('nuevo-nombre').focus();
}

function cerrarModalNuevoLote() {
    document.getElementById('modal-nuevo-lote').classList.add('hidden');
    document.getElementById('form-nuevo-lote').reset();
}

async function crearNuevoLote(e) {
    e.preventDefault();

    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const rol = document.getElementById('nuevo-rol').value.trim();
    const telefono = document.getElementById('nuevo-telefono')?.value.trim();
    const tipo = document.querySelector('input[name="nuevo-tipo"]:checked').value;

    if (!nombre) {
        mostrarNotificacion('El nombre es requerido', 'error');
        return;
    }

    try {
        const loteId = await crearLote({
            nombre_propietario: nombre,
            rol_propiedad: rol || null,
            telefono: telefono || null,
            es_oficial: parseInt(tipo)
        });

        cerrarModalNuevoLote();
        await cargarLotesEnLista();
        actualizarBarraEstado();

        cambiarHerramienta('text');
        AppState.loteIdPendiente = loteId;

        mostrarNotificacion('Lote creado. Haz clic en el mapa para colocar el texto.', 'success');
    } catch (error) {
        console.error('Error al crear lote:', error);
        mostrarNotificacion('Error al crear el lote', 'error');
    }
}

// ==================== FUNCIONES AUXILIARES ====================

function obtenerTotalLotes() {
    if (!AppState.db) return 0;
    try {
        const result = AppState.db.exec('SELECT COUNT(*) as total FROM lotes');
        return result[0]?.values[0]?.[0] || 0;
    } catch {
        return 0;
    }
}

async function cargarLotesEnLista() {
    if (typeof renderizarListaLotes === 'function') {
        await renderizarListaLotes();
    }
}

function filtrarLotes(filtro) {
    if (typeof filtrarLotesEnLista === 'function') {
        filtrarLotesEnLista(filtro);
    }
}

function buscarLotes(termino) {
    if (typeof buscarLotesEnLista === 'function') {
        buscarLotesEnLista(termino);
    }
}

async function guardarTodo() {
    try {
        if (typeof guardarEstadoActual === 'function') {
            await guardarEstadoActual();
        }

        // Guardar en el servidor bajo el proyecto actual
        if (AppState.proyectoActual) {
            await ProjectManager.guardarDatabase(AppState.proyectoActual);
        }

        AppState.cambiosSinGuardar = false;
        mostrarNotificacion('Cambios guardados', 'success');
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarNotificacion('Error al guardar cambios', 'error');
    }
}

async function compartirProyecto() {
    if (!AppState.proyectoActual) return;

    if (AppState.cambiosSinGuardar) {
        await guardarTodo();
    }

    try {
        const response = await fetch(`/api/projects/${AppState.proyectoActual}/share`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Error al generar enlace');

        const data = await response.json();
        const shareUrl = `${window.location.origin}/viewer.html?token=${data.token}`;

        document.getElementById('share-url').value = shareUrl;
        document.getElementById('modal-compartir').classList.remove('hidden');
    } catch (error) {
        console.error('Error al compartir:', error);
        mostrarNotificacion('Error al generar enlace de compartir', 'error');
    }
}

function guardarPropiedadesLote() {
    if (typeof actualizarLoteSeleccionado === 'function') {
        actualizarLoteSeleccionado();
    }
}

function eliminarLoteSeleccionado() {
    if (typeof eliminarLoteActual === 'function') {
        eliminarLoteActual();
    }
}
