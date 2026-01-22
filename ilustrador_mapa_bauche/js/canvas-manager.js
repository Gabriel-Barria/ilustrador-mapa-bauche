/**
 * canvas-manager.js - Manejo del canvas con Fabric.js
 * Editor Plano San Rafael
 */

// Dimensiones originales de la imagen
let dimensionesOriginales = { width: 0, height: 0 };

// Puntos del poligono en construccion
let puntosPoligono = [];
let lineasPoligono = [];

/**
 * Inicializa el canvas de Fabric.js
 */
function initCanvas() {
    const container = document.getElementById('canvas-container');
    const canvasEl = document.getElementById('canvas-principal');

    // Obtener dimensiones del contenedor
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Crear canvas de Fabric.js
    AppState.canvas = new fabric.Canvas('canvas-principal', {
        width: width,
        height: height,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#e5e5e5'
    });

    const canvas = AppState.canvas;

    // Eventos del canvas
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('object:modified', onObjectModified);
    canvas.on('object:selected', onObjectSelected);
    canvas.on('selection:cleared', onSelectionCleared);

    // Responsive
    window.addEventListener('resize', ajustarTamanoCanvas);

    console.log('Canvas Fabric.js inicializado');
}

/**
 * Ajusta el tamano del canvas al contenedor
 */
function ajustarTamanoCanvas() {
    const container = document.getElementById('canvas-container');
    const canvas = AppState.canvas;

    if (!canvas) return;

    canvas.setWidth(container.clientWidth);
    canvas.setHeight(container.clientHeight);
    canvas.renderAll();
}

/**
 * Carga una imagen como fondo del canvas
 */
function cargarImagenFondo(archivo) {
    const reader = new FileReader();

    reader.onload = function(event) {
        fabric.Image.fromURL(event.target.result, function(img) {
            const canvas = AppState.canvas;

            // Guardar dimensiones originales
            dimensionesOriginales.width = img.width;
            dimensionesOriginales.height = img.height;

            // Calcular escala para ajustar al canvas
            const escalaX = canvas.width / img.width;
            const escalaY = canvas.height / img.height;
            const escala = Math.min(escalaX, escalaY, 1); // No agrandar mas de 100%

            // Establecer como fondo
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                scaleX: escala,
                scaleY: escala,
                originX: 'left',
                originY: 'top'
            });

            // Ocultar placeholder
            document.getElementById('canvas-placeholder')?.classList.add('hidden');

            AppState.imagenCargada = true;
            mostrarNotificacion('Imagen cargada correctamente', 'success');
        });
    };

    reader.readAsDataURL(archivo);
}

/**
 * Configura el modo del canvas segun la herramienta seleccionada
 */
function setCanvasMode(modo) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Limpiar poligono en construccion si cambiamos de modo
    if (modo !== 'polygon' && puntosPoligono.length > 0) {
        cancelarPoligono();
    }

    switch (modo) {
        case 'select':
            canvas.selection = true;
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
            canvas.forEachObject(obj => {
                if (obj.type === 'i-text') {
                    obj.selectable = true;
                    obj.evented = true;
                }
            });
            break;

        case 'text':
            canvas.selection = false;
            canvas.defaultCursor = 'text';
            canvas.hoverCursor = 'text';
            canvas.forEachObject(obj => {
                obj.selectable = false;
            });
            break;

        case 'polygon':
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
            canvas.forEachObject(obj => {
                obj.selectable = false;
            });
            break;
    }

    canvas.renderAll();
}

/**
 * Evento: movimiento del mouse
 */
function onMouseMove(options) {
    const pointer = AppState.canvas.getPointer(options.e);

    // Actualizar barra de estado
    document.getElementById('status-pos').textContent =
        `x: ${Math.round(pointer.x)}, y: ${Math.round(pointer.y)}`;

    // Si estamos dibujando poligono, actualizar linea temporal
    if (AppState.modoActual === 'polygon' && puntosPoligono.length > 0) {
        actualizarLineaTemporalPoligono(pointer);
    }
}

/**
 * Evento: click en el canvas
 */
function onMouseDown(options) {
    if (options.target) return; // Click en un objeto existente

    const pointer = AppState.canvas.getPointer(options.e);

    switch (AppState.modoActual) {
        case 'text':
            agregarTextoEnPosicion(pointer);
            break;

        case 'polygon':
            agregarPuntoPoligono(pointer, options.e);
            break;
    }
}

/**
 * Evento: objeto modificado (movido, rotado, etc)
 */
function onObjectModified(options) {
    const obj = options.target;

    if (obj.textoId) {
        // Guardar nueva posicion del texto
        actualizarTexto(obj.textoId, {
            contenido: obj.text,
            pos_x: obj.left,
            pos_y: obj.top,
            font_size: obj.fontSize,
            color: obj.fill,
            angulo: obj.angle
        });

        AppState.cambiosSinGuardar = true;
    }
}

/**
 * Evento: objeto seleccionado
 */
function onObjectSelected(options) {
    const obj = options.target;

    if (obj.loteId) {
        seleccionarLote(obj.loteId);
    }
}

/**
 * Evento: seleccion limpiada
 */
function onSelectionCleared() {
    deseleccionarLote();
}

/**
 * Agrega un texto en la posicion indicada
 */
function agregarTextoEnPosicion(posicion) {
    const canvas = AppState.canvas;
    const loteId = AppState.loteIdPendiente;

    // Obtener datos del lote si existe
    let contenido = 'Nuevo texto';
    let esOficial = true;

    if (loteId) {
        const lote = obtenerLotePorId(loteId);
        if (lote) {
            contenido = lote.nombre_propietario;
            esOficial = lote.es_oficial === 1;
        }
    }

    // Color segun tipo
    const color = esOficial ? '#0000FF' : '#FF6600';

    // Crear texto interactivo
    const texto = new fabric.IText(contenido, {
        left: posicion.x,
        top: posicion.y,
        fontSize: 14,
        fill: color,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        editable: true,
        loteId: loteId,
        esOficial: esOficial
    });

    canvas.add(texto);
    canvas.setActiveObject(texto);

    // Guardar en base de datos
    const textoId = crearTexto({
        lote_id: loteId,
        contenido: contenido,
        pos_x: posicion.x,
        pos_y: posicion.y,
        font_size: 14,
        color: color
    });

    texto.textoId = textoId;

    // Limpiar lote pendiente
    AppState.loteIdPendiente = null;
    AppState.cambiosSinGuardar = true;

    // Volver a modo seleccion
    cambiarHerramienta('select');
    canvas.renderAll();
}

/**
 * Agrega un punto al poligono en construccion
 */
function agregarPuntoPoligono(posicion, evento) {
    const canvas = AppState.canvas;

    // Doble click cierra el poligono
    if (evento.detail === 2 && puntosPoligono.length >= 3) {
        finalizarPoligono();
        return;
    }

    puntosPoligono.push({ x: posicion.x, y: posicion.y });

    // Dibujar punto
    const punto = new fabric.Circle({
        left: posicion.x - 4,
        top: posicion.y - 4,
        radius: 4,
        fill: '#2563eb',
        selectable: false,
        evented: false,
        puntoPoligono: true
    });
    canvas.add(punto);

    // Dibujar linea al punto anterior
    if (puntosPoligono.length > 1) {
        const puntoAnterior = puntosPoligono[puntosPoligono.length - 2];
        const linea = new fabric.Line(
            [puntoAnterior.x, puntoAnterior.y, posicion.x, posicion.y],
            {
                stroke: '#2563eb',
                strokeWidth: 2,
                selectable: false,
                evented: false,
                lineaPoligono: true
            }
        );
        canvas.add(linea);
        lineasPoligono.push(linea);
    }

    canvas.renderAll();

    // Mostrar instruccion
    if (puntosPoligono.length === 1) {
        mostrarNotificacion('Click para agregar mas puntos. Doble click para cerrar.', 'info');
    }
}

/**
 * Actualiza la linea temporal mientras se mueve el mouse
 */
function actualizarLineaTemporalPoligono(posicion) {
    const canvas = AppState.canvas;

    // Remover linea temporal anterior
    const lineaTemporal = canvas.getObjects().find(o => o.lineaTemporal);
    if (lineaTemporal) {
        canvas.remove(lineaTemporal);
    }

    // Crear nueva linea temporal
    const ultimoPunto = puntosPoligono[puntosPoligono.length - 1];
    const linea = new fabric.Line(
        [ultimoPunto.x, ultimoPunto.y, posicion.x, posicion.y],
        {
            stroke: '#2563eb',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            lineaTemporal: true
        }
    );
    canvas.add(linea);
    canvas.renderAll();
}

/**
 * Finaliza el poligono actual
 */
function finalizarPoligono() {
    const canvas = AppState.canvas;

    if (puntosPoligono.length < 3) {
        mostrarNotificacion('Se necesitan al menos 3 puntos', 'error');
        cancelarPoligono();
        return;
    }

    // Preguntar a que lote asociar
    const lotes = obtenerLotes();
    if (lotes.length === 0) {
        mostrarNotificacion('Primero debes crear un lote', 'error');
        cancelarPoligono();
        return;
    }

    // Por ahora, asociar al ultimo lote o crear selector
    // TODO: Mostrar selector de lote
    const loteId = lotes[lotes.length - 1].id;
    const esOficial = lotes[lotes.length - 1].es_oficial === 1;

    // Limpiar puntos y lineas temporales
    canvas.getObjects().filter(o => o.puntoPoligono || o.lineaPoligono || o.lineaTemporal)
        .forEach(o => canvas.remove(o));

    // Crear poligono final
    const colorRelleno = esOficial ? 'rgba(0, 100, 255, 0.15)' : 'rgba(255, 100, 0, 0.25)';
    const colorBorde = esOficial ? '#0064FF' : '#FF6400';

    const poligono = new fabric.Polygon(puntosPoligono, {
        fill: colorRelleno,
        stroke: colorBorde,
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
        loteId: loteId,
        esOficial: esOficial
    });

    // Eventos del poligono
    poligono.on('mouseover', function() {
        this.set('fill', esOficial ? 'rgba(0, 100, 255, 0.35)' : 'rgba(255, 100, 0, 0.45)');
        canvas.renderAll();
        mostrarTooltipLote(this.loteId);
    });

    poligono.on('mouseout', function() {
        this.set('fill', colorRelleno);
        canvas.renderAll();
        ocultarTooltip();
    });

    poligono.on('mousedown', function() {
        seleccionarLote(this.loteId);
    });

    canvas.add(poligono);
    canvas.sendToBack(poligono);

    // Guardar en BD
    const poligonoId = crearPoligono({
        lote_id: loteId,
        puntos: puntosPoligono.map(p => [p.x, p.y]),
        color_borde: colorBorde,
        color_relleno: colorRelleno
    });

    poligono.poligonoId = poligonoId;

    // Limpiar estado
    puntosPoligono = [];
    lineasPoligono = [];

    AppState.cambiosSinGuardar = true;

    canvas.renderAll();
    mostrarNotificacion('Poligono creado', 'success');

    // Volver a modo seleccion
    cambiarHerramienta('select');
}

/**
 * Cancela el poligono en construccion
 */
function cancelarPoligono() {
    const canvas = AppState.canvas;

    // Remover puntos y lineas temporales
    canvas.getObjects().filter(o => o.puntoPoligono || o.lineaPoligono || o.lineaTemporal)
        .forEach(o => canvas.remove(o));

    puntosPoligono = [];
    lineasPoligono = [];

    canvas.renderAll();
}

/**
 * Controles de zoom
 */
function hacerZoom(factor) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    let zoom = canvas.getZoom() * factor;
    zoom = Math.min(Math.max(zoom, 0.1), 5); // Limitar entre 10% y 500%

    canvas.setZoom(zoom);
    canvas.renderAll();

    // Actualizar UI
    document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
    document.getElementById('status-zoom').textContent = 'Zoom: ' + Math.round(zoom * 100) + '%';
}

function ajustarZoom() {
    const canvas = AppState.canvas;
    if (!canvas || !canvas.backgroundImage) return;

    const img = canvas.backgroundImage;
    const escalaX = canvas.width / (img.width * img.scaleX);
    const escalaY = canvas.height / (img.height * img.scaleY);
    const escala = Math.min(escalaX, escalaY, 1);

    canvas.setZoom(escala);
    canvas.renderAll();

    document.getElementById('zoom-level').textContent = Math.round(escala * 100) + '%';
    document.getElementById('status-zoom').textContent = 'Zoom: ' + Math.round(escala * 100) + '%';
}

/**
 * Carga todos los elementos desde la BD al canvas
 */
async function cargarTodosLosElementos() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Limpiar canvas (excepto fondo)
    const objetosAEliminar = canvas.getObjects().filter(o => !o.isBackground);
    objetosAEliminar.forEach(o => canvas.remove(o));

    // Cargar textos
    const textos = obtenerTextos();
    textos.forEach(t => {
        const color = t.es_oficial === 1 ? '#0000FF' : '#FF6600';
        const texto = new fabric.IText(t.contenido, {
            left: t.pos_x,
            top: t.pos_y,
            fontSize: t.font_size || 14,
            fill: t.color || color,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            angle: t.angulo || 0,
            editable: true,
            textoId: t.id,
            loteId: t.lote_id,
            esOficial: t.es_oficial === 1
        });
        canvas.add(texto);
    });

    // Cargar poligonos
    const poligonos = obtenerPoligonos();
    poligonos.forEach(p => {
        const esOficial = p.es_oficial === 1;
        const colorRelleno = esOficial ? 'rgba(0, 100, 255, 0.15)' : 'rgba(255, 100, 0, 0.25)';

        const poligono = new fabric.Polygon(
            p.puntos.map(punto => ({ x: punto[0], y: punto[1] })),
            {
                fill: colorRelleno,
                stroke: p.color_borde,
                strokeWidth: 2,
                selectable: false,
                evented: true,
                hoverCursor: 'pointer',
                poligonoId: p.id,
                loteId: p.lote_id,
                esOficial: esOficial
            }
        );

        // Eventos
        poligono.on('mouseover', function() {
            this.set('fill', esOficial ? 'rgba(0, 100, 255, 0.35)' : 'rgba(255, 100, 0, 0.45)');
            canvas.renderAll();
            mostrarTooltipLote(this.loteId);
        });

        poligono.on('mouseout', function() {
            this.set('fill', colorRelleno);
            canvas.renderAll();
            ocultarTooltip();
        });

        poligono.on('mousedown', function() {
            seleccionarLote(this.loteId);
        });

        canvas.add(poligono);
        canvas.sendToBack(poligono);
    });

    canvas.renderAll();
}

/**
 * Guarda el estado actual
 */
function guardarEstadoActual() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Los textos ya se guardan al modificarse
    // Aqui podriamos guardar configuracion adicional

    console.log('Estado guardado');
}
