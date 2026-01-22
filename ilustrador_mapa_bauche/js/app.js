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
    cambiosSinGuardar: false
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
        'polygon': 'Dibujar Poligono'
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
    // Remover notificacion anterior si existe
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
    const tipo = document.querySelector('input[name="nuevo-tipo"]:checked').value;

    if (!nombre) {
        mostrarNotificacion('El nombre es requerido', 'error');
        return;
    }

    try {
        const loteId = await crearLote({
            nombre_propietario: nombre,
            rol_propiedad: rol || null,
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

// Funciones placeholder que seran implementadas en otros modulos
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
    // Implementado en lote-manager.js
    if (typeof renderizarListaLotes === 'function') {
        await renderizarListaLotes();
    }
}

function filtrarLotes(filtro) {
    // Implementado en lote-manager.js
    if (typeof filtrarLotesEnLista === 'function') {
        filtrarLotesEnLista(filtro);
    }
}

function buscarLotes(termino) {
    // Implementado en lote-manager.js
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
    // Implementado en lote-manager.js
    if (typeof actualizarLoteSeleccionado === 'function') {
        actualizarLoteSeleccionado();
    }
}

function eliminarLoteSeleccionado() {
    // Implementado en lote-manager.js
    if (typeof eliminarLoteActual === 'function') {
        eliminarLoteActual();
    }
}
