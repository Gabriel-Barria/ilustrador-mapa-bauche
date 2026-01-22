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
    modoAnterior: null // Para restaurar despues de pan con espacio
};

// Sistema de Undo
const UndoManager = {
    historial: [],
    maxHistorial: 50,

    guardarEstado() {
        const canvas = AppState.canvas;
        if (!canvas) return;

        // Guardar estado del canvas (sin la imagen de fondo)
        const objetos = canvas.getObjects().filter(o => o !== AppState.imagenFondo);
        const estado = objetos.map(obj => ({
            type: obj.type,
            left: obj.left,
            top: obj.top,
            text: obj.text,
            textoId: obj.textoId,
            loteId: obj.loteId,
            esOficial: obj.esOficial,
            fontSize: obj.fontSize,
            fill: obj.fill,
            angle: obj.angle
        }));

        this.historial.push(JSON.stringify(estado));

        // Limitar historial
        if (this.historial.length > this.maxHistorial) {
            this.historial.shift();
        }
    },

    deshacer() {
        if (this.historial.length < 2) {
            mostrarNotificacion('No hay mas acciones para deshacer', 'info');
            return;
        }

        // Quitar estado actual
        this.historial.pop();

        // Obtener estado anterior
        const estadoAnterior = JSON.parse(this.historial[this.historial.length - 1]);

        // Restaurar canvas
        const canvas = AppState.canvas;
        const objetosAEliminar = canvas.getObjects().filter(o => o !== AppState.imagenFondo);
        objetosAEliminar.forEach(o => canvas.remove(o));

        // Recrear objetos
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
            }
        });

        canvas.renderAll();
        mostrarNotificacion('Accion deshecha', 'success');
    }
};

// Inicializacion al cargar la pagina
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando Editor Plano San Rafael...');

    try {
        // 1. Inicializar base de datos
        await initDatabase();
        console.log('Base de datos inicializada');

        // 2. Inicializar canvas
        initCanvas();
        console.log('Canvas inicializado');

        // 3. Configurar eventos de UI
        setupUIEvents();
        console.log('Eventos de UI configurados');

        // 4. Cargar lotes existentes
        await cargarLotesEnLista();

        // 5. Actualizar barra de estado
        actualizarBarraEstado();

        console.log('Aplicacion lista');
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarNotificacion('Error al inicializar la aplicacion', 'error');
    }
});

/**
 * Configura todos los eventos de la interfaz de usuario
 */
function setupUIEvents() {
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

    // Cargar imagen
    const inputsImagen = document.querySelectorAll('#input-imagen, #input-imagen-inicial');
    inputsImagen.forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                cargarImagenFondo(e.target.files[0]);
            }
        });
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
    document.getElementById('btn-exportar-db')?.addEventListener('click', exportarBaseDatos);
    document.getElementById('btn-imprimir')?.addEventListener('click', imprimirCanvas);

    // Modal nuevo lote
    document.getElementById('btn-nuevo-lote')?.addEventListener('click', abrirModalNuevoLote);
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

    // Aviso antes de cerrar con cambios sin guardar
    window.addEventListener('beforeunload', (e) => {
        if (AppState.cambiosSinGuardar) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Atajos de teclado
    setupKeyboardShortcuts();

    // Auto-guardado cada 30 segundos
    setupAutoSave();
}

/**
 * Configura los atajos de teclado
 */
function setupKeyboardShortcuts() {
    // Espacio para pan temporal
    document.addEventListener('keydown', (e) => {
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

    // Soltar espacio restaura modo anterior
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            if (AppState.modoAnterior && AppState.modoActual === 'pan') {
                cambiarHerramienta(AppState.modoAnterior);
                AppState.modoAnterior = null;
            }
        }
    });
}

/**
 * Elimina el objeto seleccionado del canvas
 */
function eliminarObjetoSeleccionado() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    const objetoActivo = canvas.getActiveObject();
    if (!objetoActivo) return;

    // Guardar estado para undo
    UndoManager.guardarEstado();

    // Si es un texto, eliminar de la BD tambien
    if (objetoActivo.textoId) {
        eliminarTexto(objetoActivo.textoId);
    }

    canvas.remove(objetoActivo);
    canvas.renderAll();
    AppState.cambiosSinGuardar = true;
    mostrarNotificacion('Objeto eliminado', 'success');
}

/**
 * Configura el auto-guardado
 */
let autoSaveInterval = null;

function setupAutoSave() {
    autoSaveInterval = setInterval(() => {
        if (AppState.cambiosSinGuardar) {
            console.log('Auto-guardando...');
            guardarTodo();
        }
    }, 30000);
}

/**
 * Cambia la herramienta activa
 */
function cambiarHerramienta(herramienta) {
    AppState.modoActual = herramienta;

    // Actualizar botones
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tool-${herramienta}`);
    });

    // Actualizar cursor y modo del canvas
    if (AppState.canvas) {
        setCanvasMode(herramienta);
    }

    // Actualizar barra de estado
    const modos = {
        'select': 'Seleccionar',
        'text': 'Agregar Texto',
        'polygon': 'Dibujar Poligono',
        'pan': 'Mover Vista'
    };
    document.getElementById('status-modo').textContent = `Modo: ${modos[herramienta] || herramienta}`;
}

/**
 * Actualiza la barra de estado
 */
function actualizarBarraEstado() {
    const totalLotes = obtenerTotalLotes();
    document.getElementById('status-lotes').textContent = `${totalLotes} lotes`;
}

/**
 * Muestra una notificacion temporal
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    const anterior = document.querySelector('.notification');
    if (anterior) anterior.remove();

    const notif = document.createElement('div');
    notif.className = `notification ${tipo}`;
    notif.textContent = mensaje;
    document.body.appendChild(notif);

    setTimeout(() => notif.remove(), 3000);
}

/**
 * Modal nuevo lote
 */
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

        // Cambiar a modo texto para agregar el texto del lote
        cambiarHerramienta('text');
        AppState.loteIdPendiente = loteId;

        mostrarNotificacion('Lote creado. Haz clic en el mapa para colocar el texto.', 'success');
    } catch (error) {
        console.error('Error al crear lote:', error);
        mostrarNotificacion('Error al crear el lote', 'error');
    }
}

// Funciones auxiliares
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

function guardarTodo() {
    if (typeof guardarEstadoActual === 'function') {
        guardarEstadoActual();
    }
    AppState.cambiosSinGuardar = false;
    mostrarNotificacion('Cambios guardados', 'success');
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
