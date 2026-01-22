/**
 * lote-manager.js - Gestion de lotes y su interaccion
 * Editor Plano San Rafael
 */

/**
 * Renderiza la lista de lotes en el panel izquierdo
 */
async function renderizarListaLotes(filtro = 'all', busqueda = '') {
    const lista = document.getElementById('lista-lotes');
    if (!lista) return;

    const lotes = obtenerLotes(filtro);

    // Filtrar por busqueda
    let lotesFiltrados = lotes;
    if (busqueda) {
        const termino = busqueda.toLowerCase();
        lotesFiltrados = lotes.filter(l =>
            l.nombre_propietario.toLowerCase().includes(termino) ||
            (l.rol_propiedad && l.rol_propiedad.toLowerCase().includes(termino)) ||
            (l.telefono && l.telefono.includes(termino))
        );
    }

    // Limpiar lista
    lista.innerHTML = '';

    if (lotesFiltrados.length === 0) {
        lista.innerHTML = '<li class="lote-item empty">No hay lotes que mostrar</li>';
        return;
    }

    // Renderizar cada lote
    lotesFiltrados.forEach(lote => {
        const li = document.createElement('li');
        li.className = `lote-item ${lote.es_oficial ? 'oficial' : 'agregado'}`;
        li.dataset.loteId = lote.id;

        if (AppState.loteSeleccionado === lote.id) {
            li.classList.add('selected');
        }

        li.innerHTML = `
            <div class="lote-nombre">${lote.nombre_propietario}</div>
            ${lote.rol_propiedad ? `<div class="lote-rol">Rol: ${lote.rol_propiedad}</div>` : ''}
        `;

        li.addEventListener('click', () => {
            seleccionarLote(lote.id);
            centrarEnLote(lote.id);
        });

        lista.appendChild(li);
    });
}

/**
 * Filtra los lotes en la lista
 */
function filtrarLotesEnLista(filtro) {
    const busqueda = document.getElementById('buscar-lote')?.value || '';
    renderizarListaLotes(filtro, busqueda);
}

/**
 * Busca lotes por termino
 */
function buscarLotesEnLista(termino) {
    const filtroActivo = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    renderizarListaLotes(filtroActivo, termino);
}

/**
 * Selecciona un lote y muestra sus propiedades
 */
function seleccionarLote(loteId) {
    AppState.loteSeleccionado = loteId;

    // Actualizar lista
    document.querySelectorAll('.lote-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.loteId == loteId);
    });

    // Mostrar panel de propiedades
    const lote = obtenerLotePorId(loteId);
    if (!lote) return;

    document.getElementById('propiedades-vacio')?.classList.add('hidden');
    document.getElementById('form-propiedades')?.classList.remove('hidden');

    // Llenar formulario
    document.getElementById('prop-nombre').value = lote.nombre_propietario;
    document.getElementById('prop-rol').value = lote.rol_propiedad || '';
    document.getElementById('prop-telefono').value = lote.telefono || '';
    document.querySelector(`input[name="prop-tipo"][value="${lote.es_oficial}"]`).checked = true;
    document.getElementById('prop-notas').value = lote.notas || '';

    // Verificar si el lote tiene texto en el canvas
    const canvas = AppState.canvas;
    if (canvas) {
        const textoExistente = canvas.getObjects().find(o => o.loteId === loteId && o.type === 'i-text');

        if (!textoExistente) {
            // No tiene texto - crear uno en el centro de la vista actual
            crearTextoEnCentroVista(loteId, lote);
        } else {
            // Tiene texto - resaltar y centrar vista en él
            resaltarLoteEnCanvas(loteId);
            centrarVistaEnObjeto(textoExistente);
        }
    }
}

/**
 * Crea un texto en el centro de la vista actual del canvas
 */
function crearTextoEnCentroVista(loteId, lote) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Calcular el centro de la vista actual
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;

    // Centro del viewport en coordenadas del canvas
    const centerX = (-vpt[4] + canvas.width / 2) / zoom;
    const centerY = (-vpt[5] + canvas.height / 2) / zoom;

    const esOficial = lote.es_oficial === 1;
    const color = esOficial ? '#0000FF' : '#FF6600';
    const fontSize = Math.max(16, Math.round(dimensionesOriginales.width / 120));

    // Guardar estado para undo
    if (typeof UndoManager !== 'undefined') {
        UndoManager.guardarEstado();
    }

    // Crear texto
    const texto = new fabric.IText(lote.nombre_propietario, {
        left: centerX,
        top: centerY,
        fontSize: fontSize,
        fill: color,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        editable: true,
        loteId: loteId,
        esOficial: esOficial,
        originX: 'center',
        originY: 'center'
    });

    canvas.add(texto);
    canvas.setActiveObject(texto);

    // Guardar en base de datos
    const textoId = crearTexto({
        lote_id: loteId,
        contenido: lote.nombre_propietario,
        pos_x: centerX,
        pos_y: centerY,
        font_size: fontSize,
        color: color
    });

    texto.textoId = textoId;

    // Ajustar origen después de guardar para que las coordenadas sean correctas
    texto.set({ originX: 'left', originY: 'top' });
    texto.setCoords();

    canvas.renderAll();
    AppState.cambiosSinGuardar = true;

    mostrarNotificacion(`"${lote.nombre_propietario}" agregado. Arrastralo para posicionarlo.`, 'success');
}

/**
 * Centra la vista del canvas en un objeto específico
 */
function centrarVistaEnObjeto(objeto) {
    const canvas = AppState.canvas;
    if (!canvas || !objeto) return;

    const zoom = canvas.getZoom();
    const objCenter = objeto.getCenterPoint();

    // Calcular el desplazamiento necesario para centrar el objeto
    const vpw = canvas.width / zoom;
    const vph = canvas.height / zoom;

    const newVptX = -(objCenter.x - vpw / 2) * zoom;
    const newVptY = -(objCenter.y - vph / 2) * zoom;

    canvas.setViewportTransform([zoom, 0, 0, zoom, newVptX, newVptY]);
    canvas.renderAll();
}

/**
 * Deselecciona el lote actual
 */
function deseleccionarLote() {
    AppState.loteSeleccionado = null;

    // Actualizar lista
    document.querySelectorAll('.lote-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Ocultar panel de propiedades
    document.getElementById('propiedades-vacio')?.classList.remove('hidden');
    document.getElementById('form-propiedades')?.classList.add('hidden');

    // Quitar resaltado del canvas
    quitarResaltadoCanvas();
}

/**
 * Actualiza el lote seleccionado con los datos del formulario
 */
function actualizarLoteSeleccionado() {
    const loteId = AppState.loteSeleccionado;
    if (!loteId) return;

    const datos = {
        nombre_propietario: document.getElementById('prop-nombre').value.trim(),
        rol_propiedad: document.getElementById('prop-rol').value.trim() || null,
        telefono: document.getElementById('prop-telefono').value.trim() || null,
        es_oficial: parseInt(document.querySelector('input[name="prop-tipo"]:checked').value),
        notas: document.getElementById('prop-notas').value.trim() || null
    };

    if (!datos.nombre_propietario) {
        mostrarNotificacion('El nombre es requerido', 'error');
        return;
    }

    // Actualizar en BD
    actualizarLote(loteId, datos);

    // Actualizar textos en canvas
    actualizarTextosLoteEnCanvas(loteId, datos);

    // Actualizar lista
    renderizarListaLotes();

    AppState.cambiosSinGuardar = true;
    mostrarNotificacion('Lote actualizado', 'success');
}

/**
 * Elimina el lote actualmente seleccionado
 */
function eliminarLoteActual() {
    const loteId = AppState.loteSeleccionado;
    if (!loteId) return;

    if (!confirm('¿Estas seguro de eliminar este lote? Se eliminaran tambien sus textos y poligonos.')) {
        return;
    }

    // Eliminar del canvas
    eliminarLoteDelCanvas(loteId);

    // Eliminar de BD (las FK con ON DELETE CASCADE eliminan textos y poligonos)
    eliminarLote(loteId);

    // Deseleccionar
    deseleccionarLote();

    // Actualizar lista
    renderizarListaLotes();
    actualizarBarraEstado();

    AppState.cambiosSinGuardar = true;
    mostrarNotificacion('Lote eliminado', 'success');
}

/**
 * Centra la vista del canvas en un lote especifico
 */
function centrarEnLote(loteId) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    // Buscar objetos del lote
    const objetos = canvas.getObjects().filter(o => o.loteId === loteId);
    if (objetos.length === 0) return;

    // Calcular centro de los objetos
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objetos.forEach(obj => {
        const bounds = obj.getBoundingRect();
        minX = Math.min(minX, bounds.left);
        minY = Math.min(minY, bounds.top);
        maxX = Math.max(maxX, bounds.left + bounds.width);
        maxY = Math.max(maxY, bounds.top + bounds.height);
    });

    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;

    // Centrar viewport (simplificado, sin animacion)
    // TODO: Implementar paneo suave
    console.log(`Centrar en: ${centroX}, ${centroY}`);
}

/**
 * Resalta los objetos de un lote en el canvas
 */
function resaltarLoteEnCanvas(loteId) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    canvas.getObjects().forEach(obj => {
        if (obj.loteId === loteId) {
            if (obj.type === 'i-text') {
                obj.set({
                    backgroundColor: 'rgba(255, 255, 0, 0.3)',
                    padding: 5
                });
            }
        }
    });

    canvas.renderAll();
}

/**
 * Quita el resaltado de todos los objetos
 */
function quitarResaltadoCanvas() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    canvas.getObjects().forEach(obj => {
        if (obj.type === 'i-text') {
            obj.set({
                backgroundColor: 'transparent',
                padding: 0
            });
        }
    });

    canvas.renderAll();
}

/**
 * Actualiza los textos de un lote en el canvas
 */
function actualizarTextosLoteEnCanvas(loteId, datos) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    const color = datos.es_oficial === 1 ? '#0000FF' : '#FF6600';

    canvas.getObjects().forEach(obj => {
        if (obj.loteId === loteId && obj.type === 'i-text') {
            obj.set({
                text: datos.nombre_propietario,
                fill: color
            });
        }
    });

    // Actualizar poligonos
    canvas.getObjects().forEach(obj => {
        if (obj.loteId === loteId && obj.type === 'polygon') {
            const colorRelleno = datos.es_oficial === 1
                ? 'rgba(0, 100, 255, 0.15)'
                : 'rgba(255, 100, 0, 0.25)';
            const colorBorde = datos.es_oficial === 1 ? '#0064FF' : '#FF6400';

            obj.set({
                fill: colorRelleno,
                stroke: colorBorde
            });
            obj.esOficial = datos.es_oficial === 1;
        }
    });

    canvas.renderAll();
}

/**
 * Elimina todos los objetos de un lote del canvas
 */
function eliminarLoteDelCanvas(loteId) {
    const canvas = AppState.canvas;
    if (!canvas) return;

    const objetosAEliminar = canvas.getObjects().filter(o => o.loteId === loteId);
    objetosAEliminar.forEach(obj => canvas.remove(obj));

    canvas.renderAll();
}
