/**
 * canvas-manager.js - Manejo del canvas con Fabric.js
 * Editor Plano San Rafael
 */

// Dimensiones originales de la imagen
let dimensionesOriginales = { width: 0, height: 0 };

// Puntos del poligono en construccion
let puntosPoligono = [];
let lineasPoligono = [];

// Estado de paneo
let isPanning = false;
let lastPosX = 0;
let lastPosY = 0;

/**
 * Inicializa el canvas de Fabric.js
 */
function initCanvas() {
    const container = document.getElementById('canvas-container');

    // Obtener dimensiones del contenedor
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Crear canvas de Fabric.js
    AppState.canvas = new fabric.Canvas('canvas-principal', {
        width: width,
        height: height,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#d0d0d0',
        renderOnAddRemove: true
    });

    const canvas = AppState.canvas;

    // Eventos del canvas
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:wheel', onMouseWheel);
    canvas.on('object:modified', onObjectModified);
    canvas.on('selection:created', onObjectSelected);
    canvas.on('selection:updated', onObjectSelected);
    canvas.on('selection:cleared', onSelectionCleared);

    // Responsive
    window.addEventListener('resize', ajustarTamanoCanvas);

    // Cargar imagen por defecto
    cargarImagenPorDefecto();

    console.log('Canvas Fabric.js inicializado');
}

/**
 * Carga la imagen ORIGINAL automaticamente (sin los textos de Paint)
 */
function cargarImagenPorDefecto() {
    const rutaImagen = 'assets/20251111_201421.jpg';

    fabric.Image.fromURL(rutaImagen, function(img) {
        if (!img || img.width === 0) {
            console.log('No se pudo cargar la imagen por defecto');
            return;
        }

        const canvas = AppState.canvas;

        // Guardar dimensiones originales
        dimensionesOriginales.width = img.width;
        dimensionesOriginales.height = img.height;

        // Agregar imagen como objeto (no como fondo) para mejor control
        img.set({
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
            hoverCursor: 'default'
        });

        canvas.add(img);
        canvas.sendToBack(img);

        // Guardar referencia
        AppState.imagenFondo = img;

        // Ajustar zoom para ver toda la imagen
        const escalaX = canvas.width / img.width;
        const escalaY = canvas.height / img.height;
        const escala = Math.min(escalaX, escalaY) * 0.95;

        canvas.setZoom(escala);

        // Centrar la imagen
        const vpw = canvas.width / escala;
        const vph = canvas.height / escala;
        const offsetX = (vpw - img.width) / 2;
        const offsetY = (vph - img.height) / 2;

        canvas.absolutePan({ x: -offsetX * escala, y: -offsetY * escala });

        // Ocultar placeholder
        document.getElementById('canvas-placeholder')?.classList.add('hidden');

        AppState.imagenCargada = true;
        actualizarZoomUI(escala);

        canvas.renderAll();
        mostrarNotificacion('Imagen cargada: ' + img.width + 'x' + img.height + ' px', 'success');

        // Cargar datos iniciales después de que la imagen esté lista
        if (typeof cargarDatosIniciales === 'function') {
            setTimeout(() => cargarDatosIniciales(), 500);
        }
    }, { crossOrigin: 'anonymous' });
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
 * Carga una imagen desde archivo como fondo del canvas
 */
function cargarImagenFondo(archivo) {
    const reader = new FileReader();

    reader.onload = function(event) {
        fabric.Image.fromURL(event.target.result, function(img) {
            const canvas = AppState.canvas;

            // Remover imagen anterior si existe
            if (AppState.imagenFondo) {
                canvas.remove(AppState.imagenFondo);
            }

            // Guardar dimensiones originales
            dimensionesOriginales.width = img.width;
            dimensionesOriginales.height = img.height;

            // Agregar imagen como objeto
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                hoverCursor: 'default'
            });

            canvas.add(img);
            canvas.sendToBack(img);
            AppState.imagenFondo = img;

            // Ajustar zoom para ver toda la imagen
            const escalaX = canvas.width / img.width;
            const escalaY = canvas.height / img.height;
            const escala = Math.min(escalaX, escalaY) * 0.95;

            canvas.setZoom(escala);
            canvas.absolutePan({ x: 0, y: 0 });

            // Ocultar placeholder
            document.getElementById('canvas-placeholder')?.classList.add('hidden');

            AppState.imagenCargada = true;
            actualizarZoomUI(escala);

            canvas.renderAll();
            mostrarNotificacion('Imagen cargada: ' + img.width + 'x' + img.height + ' px', 'success');
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
                if (obj !== AppState.imagenFondo) {
                    obj.selectable = false;
                }
            });
            break;

        case 'polygon':
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
            canvas.forEachObject(obj => {
                if (obj !== AppState.imagenFondo) {
                    obj.selectable = false;
                }
            });
            break;

        case 'pan':
            canvas.selection = false;
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor = 'grab';
            canvas.forEachObject(obj => {
                if (obj !== AppState.imagenFondo) {
                    obj.selectable = false;
                }
            });
            break;
    }

    canvas.renderAll();
}

/**
 * Evento: rueda del mouse para zoom
 */
function onMouseWheel(opt) {
    const canvas = AppState.canvas;
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();

    // Zoom mas suave
    zoom *= 0.999 ** delta;

    // Limitar zoom
    if (zoom > 5) zoom = 5;
    if (zoom < 0.05) zoom = 0.05;

    // Zoom hacia el punto del mouse
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

    opt.e.preventDefault();
    opt.e.stopPropagation();

    actualizarZoomUI(zoom);
}

/**
 * Evento: movimiento del mouse
 */
function onMouseMove(options) {
    const canvas = AppState.canvas;

    // Paneo con boton medio o Alt+click
    if (isPanning) {
        const e = options.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        return;
    }

    const pointer = canvas.getPointer(options.e);

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
    const canvas = AppState.canvas;
    const e = options.e;

    // Modo pan: siempre panear al arrastrar
    if (AppState.modoActual === 'pan') {
        isPanning = true;
        canvas.selection = false;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        canvas.defaultCursor = 'grabbing';
        return;
    }

    // Paneo con boton medio o Alt+click izquierdo (en cualquier modo)
    if (e.button === 1 || (e.altKey && e.button === 0)) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        canvas.defaultCursor = 'grabbing';
        return;
    }

    // Click derecho para pan rapido
    if (e.button === 2) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        canvas.defaultCursor = 'grabbing';
        e.preventDefault();
        return;
    }

    if (options.target && options.target !== AppState.imagenFondo) return;

    const pointer = canvas.getPointer(options.e);

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
 * Evento: soltar click
 */
function onMouseUp(options) {
    const canvas = AppState.canvas;

    if (isPanning) {
        isPanning = false;
        canvas.selection = AppState.modoActual === 'select';
        setCanvasMode(AppState.modoActual);
    }
}

/**
 * Evento: objeto modificado (movido, rotado, etc)
 */
function onObjectModified(options) {
    const obj = options.target;

    if (obj && obj.textoId) {
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
    const obj = options.selected ? options.selected[0] : null;

    if (obj && obj.loteId) {
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

    // Crear texto interactivo - tamano relativo a la imagen
    const fontSize = Math.max(12, Math.round(dimensionesOriginales.width / 150));

    const texto = new fabric.IText(contenido, {
        left: posicion.x,
        top: posicion.y,
        fontSize: fontSize,
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
        font_size: fontSize,
        color: color
    });

    texto.textoId = textoId;

    // Limpiar lote pendiente
    AppState.loteIdPendiente = null;
    AppState.cambiosSinGuardar = true;

    // Volver a modo seleccion
    cambiarHerramienta('select');
    canvas.renderAll();

    mostrarNotificacion('Texto agregado. Arrastralo para posicionarlo.', 'success');
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
    const puntoSize = Math.max(4, dimensionesOriginales.width / 500);
    const punto = new fabric.Circle({
        left: posicion.x - puntoSize,
        top: posicion.y - puntoSize,
        radius: puntoSize,
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
                strokeWidth: Math.max(2, dimensionesOriginales.width / 1000),
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
        mostrarNotificacion('Click para agregar puntos. Doble click para cerrar el poligono.', 'info');
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

    // Asociar al ultimo lote creado
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
        strokeWidth: Math.max(2, dimensionesOriginales.width / 1000),
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

    // Enviar detras de los textos pero delante de la imagen
    const objetos = canvas.getObjects();
    const indexImagen = objetos.indexOf(AppState.imagenFondo);
    if (indexImagen >= 0) {
        canvas.moveTo(poligono, indexImagen + 1);
    }

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
    mostrarNotificacion('Poligono creado para: ' + lotes[lotes.length - 1].nombre_propietario, 'success');

    // Volver a modo seleccion
    cambiarHerramienta('select');
}

/**
 * Cancela el poligono en construccion
 */
function cancelarPoligono() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Remover puntos y lineas temporales
    canvas.getObjects().filter(o => o.puntoPoligono || o.lineaPoligono || o.lineaTemporal)
        .forEach(o => canvas.remove(o));

    puntosPoligono = [];
    lineasPoligono = [];

    canvas.renderAll();
}

/**
 * Actualiza la UI del zoom
 */
function actualizarZoomUI(zoom) {
    const porcentaje = Math.round(zoom * 100) + '%';
    document.getElementById('zoom-level').textContent = porcentaje;
    document.getElementById('status-zoom').textContent = 'Zoom: ' + porcentaje;
}

/**
 * Controles de zoom
 */
function hacerZoom(factor) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    let zoom = canvas.getZoom() * factor;
    zoom = Math.min(Math.max(zoom, 0.05), 5);

    // Zoom hacia el centro del canvas
    const center = {
        x: canvas.width / 2,
        y: canvas.height / 2
    };

    canvas.zoomToPoint(center, zoom);
    actualizarZoomUI(zoom);
}

function ajustarZoom() {
    const canvas = AppState.canvas;
    if (!canvas || !AppState.imagenFondo) return;

    const img = AppState.imagenFondo;
    const escalaX = canvas.width / img.width;
    const escalaY = canvas.height / img.height;
    const escala = Math.min(escalaX, escalaY) * 0.95;

    canvas.setZoom(escala);

    // Centrar
    const vpw = canvas.width / escala;
    const vph = canvas.height / escala;
    const offsetX = (vpw - img.width) / 2;
    const offsetY = (vph - img.height) / 2;

    canvas.absolutePan({ x: -offsetX * escala, y: -offsetY * escala });

    actualizarZoomUI(escala);
    canvas.renderAll();
}

/**
 * Carga todos los elementos desde la BD al canvas
 */
async function cargarTodosLosElementos() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Limpiar canvas (excepto imagen de fondo)
    const objetosAEliminar = canvas.getObjects().filter(o => o !== AppState.imagenFondo);
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
    });

    canvas.renderAll();
}

/**
 * Guarda el estado actual
 */
function guardarEstadoActual() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    console.log('Estado guardado');
}
