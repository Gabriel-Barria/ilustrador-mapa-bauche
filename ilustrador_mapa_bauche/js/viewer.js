/**
 * viewer.js - Visor de proyecto compartido (solo lectura)
 */

const ViewerState = {
    canvas: null,
    db: null,
    token: null,
    imagenFondo: null,
    lastDbModified: null,
    pollingInterval: null
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    ViewerState.token = params.get('token');

    if (!ViewerState.token) {
        mostrarError();
        return;
    }

    try {
        // Load metadata
        const metaResponse = await fetch(`/api/shared/${ViewerState.token}/metadata`);
        if (!metaResponse.ok) {
            mostrarError();
            return;
        }

        const metadata = await metaResponse.json();
        document.getElementById('viewer-titulo').textContent = metadata.nombre;
        document.getElementById('viewer-lotes').textContent = `${metadata.total_lotes} lotes`;
        document.title = `${metadata.nombre} - Visor`;

        // Initialize canvas
        initViewerCanvas();

        // Load image
        const imageUrl = `/api/shared/${ViewerState.token}/image`;
        await cargarImagenViewer(imageUrl);

        // Load database
        await cargarDatabaseViewer();

        // Render elements
        renderizarElementos();

        // Setup controls and interactions
        setupZoomControls();
        setupInteracciones();
        setupExportButtons();

        // Start polling for changes
        iniciarPolling();

    } catch (error) {
        console.error('Error al inicializar visor:', error);
        mostrarError();
    }
});

// ==================== CANVAS ====================

function initViewerCanvas() {
    const container = document.getElementById('viewer-canvas-container');

    ViewerState.canvas = new fabric.Canvas('viewer-canvas', {
        width: container.clientWidth,
        height: container.clientHeight,
        selection: false,
        preserveObjectStacking: true,
        backgroundColor: '#d0d0d0',
        defaultCursor: 'grab',
        hoverCursor: 'grab'
    });

    const canvas = ViewerState.canvas;

    // Mouse wheel zoom
    canvas.on('mouse:wheel', (opt) => {
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** opt.e.deltaY;
        zoom = Math.min(Math.max(zoom, 0.05), 5);
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
        actualizarZoomUI(zoom);
    });

    // Pan with drag (mouse + touch)
    let isPanning = false;
    let lastPosX, lastPosY;

    function getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    canvas.on('mouse:down', (opt) => {
        // No pan if pinching (2 fingers)
        if (opt.e.touches && opt.e.touches.length > 1) return;
        isPanning = true;
        const pos = getEventPos(opt.e);
        lastPosX = pos.x;
        lastPosY = pos.y;
        canvas.defaultCursor = 'grabbing';
    });

    canvas.on('mouse:move', (opt) => {
        if (!isPanning) return;
        if (opt.e.touches && opt.e.touches.length > 1) return;
        const pos = getEventPos(opt.e);
        const vpt = canvas.viewportTransform;
        vpt[4] += pos.x - lastPosX;
        vpt[5] += pos.y - lastPosY;
        canvas.requestRenderAll();
        lastPosX = pos.x;
        lastPosY = pos.y;
    });

    canvas.on('mouse:up', () => {
        isPanning = false;
        canvas.defaultCursor = 'grab';
    });

    canvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support: pinch-to-zoom + drag
    let lastTouchDistance = 0;
    let lastTouchCenter = null;

    canvas.upperCanvasEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            lastTouchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        }
    }, { passive: false });

    canvas.upperCanvasEl.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (lastTouchDistance > 0) {
                const scale = distance / lastTouchDistance;
                let zoom = canvas.getZoom() * scale;
                zoom = Math.min(Math.max(zoom, 0.05), 5);

                const center = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };

                const rect = canvas.upperCanvasEl.getBoundingClientRect();
                canvas.zoomToPoint({
                    x: center.x - rect.left,
                    y: center.y - rect.top
                }, zoom);

                // Pan while pinching
                if (lastTouchCenter) {
                    const vpt = canvas.viewportTransform;
                    vpt[4] += center.x - lastTouchCenter.x;
                    vpt[5] += center.y - lastTouchCenter.y;
                }

                canvas.requestRenderAll();
                actualizarZoomUI(zoom);
                lastTouchCenter = center;
            }

            lastTouchDistance = distance;
        }
    }, { passive: false });

    canvas.upperCanvasEl.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            lastTouchDistance = 0;
            lastTouchCenter = null;
        }
    });

    // Responsive resize
    window.addEventListener('resize', () => {
        canvas.setWidth(container.clientWidth);
        canvas.setHeight(container.clientHeight);
        canvas.renderAll();
    });
}

function cargarImagenViewer(url) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(url, (img) => {
            if (!img || img.width === 0) {
                reject(new Error('No se pudo cargar la imagen'));
                return;
            }

            const canvas = ViewerState.canvas;

            img.set({
                left: 0, top: 0,
                selectable: false,
                evented: false,
                hoverCursor: 'default'
            });

            canvas.add(img);
            canvas.sendToBack(img);
            ViewerState.imagenFondo = img;

            // Fit to view
            const escalaX = canvas.width / img.width;
            const escalaY = canvas.height / img.height;
            const escala = Math.min(escalaX, escalaY) * 0.95;

            canvas.setZoom(escala);

            const vpw = canvas.width / escala;
            const vph = canvas.height / escala;
            const offsetX = (vpw - img.width) / 2;
            const offsetY = (vph - img.height) / 2;
            canvas.absolutePan({ x: -offsetX * escala, y: -offsetY * escala });

            actualizarZoomUI(escala);
            canvas.renderAll();
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}

// ==================== DATABASE ====================

async function cargarDatabaseViewer() {
    const response = await fetch(`/api/shared/${ViewerState.token}/database`);

    if (response.status === 204) {
        return;
    }

    if (!response.ok) throw new Error('Error al obtener base de datos');

    ViewerState.lastDbModified = response.headers.get('X-DB-Modified');

    const buffer = await response.arrayBuffer();

    const SQL = await initSqlJs({ locateFile: file => `lib/${file}` });

    if (ViewerState.db) ViewerState.db.close();
    ViewerState.db = new SQL.Database(new Uint8Array(buffer));
}

function queryDB(sql) {
    const db = ViewerState.db;
    if (!db) return [];

    try {
        const result = db.exec(sql);
        if (!result[0]) return [];

        const columns = result[0].columns;
        return result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
    } catch (e) {
        console.warn('Query error:', e);
        return [];
    }
}

// ==================== RENDERING ====================

function renderizarElementos() {
    const canvas = ViewerState.canvas;
    if (!canvas || !ViewerState.db) return;

    // Remove all except background image
    canvas.getObjects().filter(o => o !== ViewerState.imagenFondo).forEach(o => canvas.remove(o));

    // Load polygons
    try {
        const poligonos = queryDB(`
            SELECT p.*, l.nombre_propietario, l.es_oficial
            FROM poligonos p JOIN lotes l ON p.lote_id = l.id
        `);

        poligonos.forEach(p => {
            const puntos = JSON.parse(p.puntos).map(pt => ({ x: pt[0], y: pt[1] }));
            const esOficial = p.es_oficial === 1;
            const colorRelleno = esOficial ? 'rgba(0, 100, 255, 0.15)' : 'rgba(255, 100, 0, 0.25)';

            const poligono = new fabric.Polygon(puntos, {
                fill: colorRelleno,
                stroke: p.color_borde || (esOficial ? '#0000FF' : '#FF6600'),
                strokeWidth: 2,
                selectable: false,
                evented: true,
                hoverCursor: 'pointer',
                loteId: p.lote_id
            });

            canvas.add(poligono);
        });
    } catch (e) { console.warn('Error cargando poligonos:', e); }

    // Load texts
    try {
        const textos = queryDB(`
            SELECT t.*, l.nombre_propietario, l.es_oficial
            FROM textos t LEFT JOIN lotes l ON t.lote_id = l.id
            WHERE t.visible = 1
        `);

        textos.forEach(t => {
            const color = t.es_oficial === 1 ? '#0000FF' : '#FF6600';
            const texto = new fabric.Text(t.contenido, {
                left: t.pos_x,
                top: t.pos_y,
                fontSize: t.font_size || 14,
                fill: t.color || color,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                angle: t.angulo || 0,
                selectable: false,
                evented: true,
                hoverCursor: 'pointer',
                loteId: t.lote_id,
                textoId: t.id
            });
            canvas.add(texto);
        });
    } catch (e) { console.warn('Error cargando textos:', e); }

    // Load lines
    try {
        const lineas = queryDB('SELECT * FROM lineas');
        lineas.forEach(l => {
            const linea = new fabric.Line(
                [l.punto_inicio_x, l.punto_inicio_y, l.punto_fin_x, l.punto_fin_y],
                {
                    stroke: l.color || '#8B0000',
                    strokeWidth: l.grosor || 2,
                    selectable: false,
                    evented: false
                }
            );
            canvas.add(linea);
        });
    } catch (e) { console.warn('Error cargando lineas:', e); }

    canvas.renderAll();
}

// ==================== POLLING ====================

function iniciarPolling() {
    ViewerState.pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/shared/${ViewerState.token}/database`, {
                method: 'HEAD'
            });

            if (!response.ok) return;

            const newModified = response.headers.get('X-DB-Modified');

            if (newModified && newModified !== ViewerState.lastDbModified) {
                document.getElementById('viewer-sync').textContent = '\u21BB Actualizando...';
                document.getElementById('viewer-sync').style.color = '#fbbf24';

                await cargarDatabaseViewer();
                renderizarElementos();

                document.getElementById('viewer-sync').textContent = '\u25CF Sincronizado';
                document.getElementById('viewer-sync').style.color = '#4ade80';

                const lotes = queryDB('SELECT COUNT(*) as total FROM lotes');
                if (lotes.length > 0) {
                    document.getElementById('viewer-lotes').textContent = `${lotes[0].total} lotes`;
                }
            }
        } catch (error) {
            document.getElementById('viewer-sync').textContent = '\u25CF Desconectado';
            document.getElementById('viewer-sync').style.color = '#ef4444';
        }
    }, 5000);
}

// ==================== INTERACTIONS ====================

function setupInteracciones() {
    const canvas = ViewerState.canvas;

    // Tooltip on hover
    canvas.on('mouse:over', (opt) => {
        if (opt.target && opt.target.loteId) {
            mostrarTooltipViewer(opt.target.loteId, opt.e);
        }
    });

    canvas.on('mouse:out', (opt) => {
        if (opt.target && opt.target.loteId) {
            ocultarTooltipViewer();
        }
    });

    canvas.on('mouse:move', (opt) => {
        const tooltip = document.getElementById('viewer-tooltip');
        if (tooltip.classList.contains('visible')) {
            posicionarTooltipViewer(opt.e);
        }
    });

    // Detail modal on click
    canvas.on('mouse:down', (opt) => {
        if (opt.target && opt.target.loteId && opt.e.button === 0) {
            mostrarDetalleLote(opt.target.loteId);
        }
    });

    // Close modal
    document.getElementById('btn-cerrar-detalle')?.addEventListener('click', () => {
        document.getElementById('modal-detalle-lote').classList.add('hidden');
    });
    document.getElementById('modal-detalle-lote')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-detalle-lote') {
            document.getElementById('modal-detalle-lote').classList.add('hidden');
        }
    });
}

function mostrarTooltipViewer(loteId, event) {
    const lote = queryDB(`SELECT * FROM lotes WHERE id = ${loteId}`);
    if (lote.length === 0) return;

    const l = lote[0];
    const tooltip = document.getElementById('viewer-tooltip');
    const contenido = tooltip.querySelector('.tooltip-content');

    contenido.innerHTML = `
        <strong>${l.nombre_propietario}</strong>
        ${l.telefono ? `<span class="tooltip-phone">Tel: ${l.telefono}</span>` : ''}
        <span class="tooltip-rol">Rol: ${l.rol_propiedad || 'Sin asignar'}</span>
    `;

    tooltip.classList.add('visible');
    posicionarTooltipViewer(event);
}

function posicionarTooltipViewer(e) {
    const tooltip = document.getElementById('viewer-tooltip');
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 15;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 15;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function ocultarTooltipViewer() {
    document.getElementById('viewer-tooltip').classList.remove('visible');
}

function mostrarDetalleLote(loteId) {
    const lotes = queryDB(`SELECT * FROM lotes WHERE id = ${loteId}`);
    if (lotes.length === 0) return;

    const lote = lotes[0];

    document.getElementById('detalle-titulo').textContent = lote.nombre_propietario;
    document.getElementById('detalle-contenido').innerHTML = `
        <div class="detalle-grid">
            <div class="detalle-campo">
                <label>Propietario</label>
                <span>${lote.nombre_propietario}</span>
            </div>
            <div class="detalle-campo">
                <label>Numero de Rol</label>
                <span>${lote.rol_propiedad || 'Sin asignar'}</span>
            </div>
            <div class="detalle-campo">
                <label>Telefono</label>
                <span>${lote.telefono || 'Sin telefono'}</span>
            </div>
            <div class="detalle-campo">
                <label>Tipo</label>
                <span class="tipo-badge ${lote.es_oficial ? 'oficial' : 'agregado'}">
                    ${lote.es_oficial ? 'Lote Oficial' : 'Agregado Manualmente'}
                </span>
            </div>
            <div class="detalle-campo">
                <label>Notas</label>
                <span>${lote.notas || 'Sin notas'}</span>
            </div>
            <div class="detalle-campo">
                <label>Fecha Creacion</label>
                <span>${lote.fecha_creacion || 'N/A'}</span>
            </div>
        </div>
    `;

    document.getElementById('modal-detalle-lote').classList.remove('hidden');
}

// ==================== ZOOM CONTROLS ====================

function setupZoomControls() {
    document.getElementById('viewer-zoom-in')?.addEventListener('click', () => {
        const canvas = ViewerState.canvas;
        let zoom = canvas.getZoom() * 1.1;
        zoom = Math.min(zoom, 5);
        canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        actualizarZoomUI(zoom);
    });

    document.getElementById('viewer-zoom-out')?.addEventListener('click', () => {
        const canvas = ViewerState.canvas;
        let zoom = canvas.getZoom() * 0.9;
        zoom = Math.max(zoom, 0.05);
        canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        actualizarZoomUI(zoom);
    });

    document.getElementById('viewer-zoom-fit')?.addEventListener('click', () => {
        const canvas = ViewerState.canvas;
        const img = ViewerState.imagenFondo;
        if (!img) return;

        const escala = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.95;
        canvas.setZoom(escala);

        const vpw = canvas.width / escala;
        const vph = canvas.height / escala;
        const offsetX = (vpw - img.width) / 2;
        const offsetY = (vph - img.height) / 2;
        canvas.absolutePan({ x: -offsetX * escala, y: -offsetY * escala });

        actualizarZoomUI(escala);
        canvas.renderAll();
    });
}

function actualizarZoomUI(zoom) {
    document.getElementById('viewer-zoom-level').textContent = Math.round(zoom * 100) + '%';
}

// ==================== EXPORT ====================

function setupExportButtons() {
    document.getElementById('btn-exportar-png-viewer')?.addEventListener('click', exportarPNGViewer);
    document.getElementById('btn-exportar-excel-viewer')?.addEventListener('click', exportarExcelViewer);
}

function exportarPNGViewer() {
    const canvas = ViewerState.canvas;
    if (!canvas) return;

    canvas.discardActiveObject();
    canvas.renderAll();

    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2
    });

    const fecha = new Date().toISOString().split('T')[0];
    const nombre = document.getElementById('viewer-titulo').textContent || 'proyecto';
    const link = document.createElement('a');
    link.download = `${nombre.replace(/\s+/g, '_')}_${fecha}.png`;
    link.href = dataURL;
    link.click();
}

function exportarExcelViewer() {
    if (typeof XLSX === 'undefined') {
        alert('Libreria Excel no disponible');
        return;
    }

    const lotes = queryDB('SELECT * FROM lotes ORDER BY nombre_propietario');

    if (lotes.length === 0) {
        alert('No hay lotes para exportar');
        return;
    }

    const datos = lotes.map(lote => ({
        'Nombre Propietario': lote.nombre_propietario,
        'Telefono': lote.telefono || '',
        'Numero de Rol': lote.rol_propiedad || '',
        'Tipo': lote.es_oficial === 1 ? 'Oficial' : 'Agregado',
        'Notas': lote.notas || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);

    ws['!cols'] = [
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Lotes');

    const fecha = new Date().toISOString().split('T')[0];
    const nombre = document.getElementById('viewer-titulo').textContent || 'proyecto';
    XLSX.writeFile(wb, `lotes_${nombre.replace(/\s+/g, '_')}_${fecha}.xlsx`);
}

// ==================== UTILITIES ====================

function mostrarError() {
    document.getElementById('viewer-header').classList.add('hidden');
    document.getElementById('viewer-canvas-container').classList.add('hidden');
    document.getElementById('viewer-zoom-controls').classList.add('hidden');
    document.getElementById('viewer-error').classList.remove('hidden');
}
