/**
 * export-manager.js - Exportacion de imagen y base de datos
 * Editor Plano San Rafael
 */

/**
 * Exporta el canvas a imagen PNG
 */
function exportarPNG() {
    const canvas = AppState.canvas;
    if (!canvas) {
        mostrarNotificacion('No hay nada que exportar', 'error');
        return;
    }

    // Deseleccionar objetos para limpiar handles de seleccion
    canvas.discardActiveObject();
    canvas.renderAll();

    // Exportar con mayor calidad
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // 2x resolucion
    });

    // Crear enlace de descarga
    const fecha = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `plano_san_rafael_${fecha}.png`;
    link.href = dataURL;
    link.click();

    mostrarNotificacion('Imagen exportada', 'success');
}

/**
 * Exporta solo la imagen sin elementos interactivos
 */
function exportarPNGLimpio() {
    const canvas = AppState.canvas;
    if (!canvas || !canvas.backgroundImage) {
        mostrarNotificacion('No hay imagen cargada', 'error');
        return;
    }

    // Crear canvas temporal solo con imagen de fondo y textos
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    const img = canvas.backgroundImage;
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    // Dibujar imagen de fondo
    ctx.drawImage(img._element, 0, 0);

    // Dibujar textos escalados
    const escalaX = img.width / (canvas.width * canvas.getZoom());
    const escalaY = img.height / (canvas.height * canvas.getZoom());

    canvas.getObjects().forEach(obj => {
        if (obj.type === 'i-text') {
            ctx.font = `bold ${obj.fontSize * escalaX}px Arial`;
            ctx.fillStyle = obj.fill;
            ctx.fillText(obj.text, obj.left * escalaX, obj.top * escalaY + obj.fontSize * escalaX);
        }
    });

    // Exportar
    const dataURL = tempCanvas.toDataURL('image/png');
    const fecha = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `plano_san_rafael_limpio_${fecha}.png`;
    link.href = dataURL;
    link.click();

    mostrarNotificacion('Imagen limpia exportada', 'success');
}

/**
 * Imprime el canvas
 */
function imprimirCanvas() {
    const canvas = AppState.canvas;
    if (!canvas) {
        mostrarNotificacion('No hay nada que imprimir', 'error');
        return;
    }

    // Deseleccionar objetos
    canvas.discardActiveObject();
    canvas.renderAll();

    // Crear ventana de impresion
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2
    });

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plano San Rafael - Imprimir</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                @media print {
                    body { padding: 0; }
                    img { max-width: 100%; }
                }
            </style>
        </head>
        <body>
            <img src="${dataURL}" onload="window.print(); window.close();">
        </body>
        </html>
    `);
    ventana.document.close();
}

/**
 * Genera reporte de lotes en formato texto
 */
function generarReporteLotes() {
    const lotes = obtenerLotes();

    let reporte = 'REPORTE DE LOTES - PLANO SAN RAFAEL\n';
    reporte += '=' .repeat(50) + '\n\n';
    reporte += `Fecha: ${new Date().toLocaleDateString()}\n`;
    reporte += `Total de lotes: ${lotes.length}\n\n`;

    const oficiales = lotes.filter(l => l.es_oficial === 1);
    const agregados = lotes.filter(l => l.es_oficial === 0);

    reporte += `Lotes oficiales: ${oficiales.length}\n`;
    reporte += `Lotes agregados manualmente: ${agregados.length}\n\n`;

    reporte += '-'.repeat(50) + '\n';
    reporte += 'DETALLE DE LOTES\n';
    reporte += '-'.repeat(50) + '\n\n';

    lotes.forEach((lote, index) => {
        reporte += `${index + 1}. ${lote.nombre_propietario}\n`;
        reporte += `   Rol: ${lote.rol_propiedad || 'Sin asignar'}\n`;
        reporte += `   Tipo: ${lote.es_oficial ? 'Oficial' : 'Agregado manualmente'}\n`;
        if (lote.notas) {
            reporte += `   Notas: ${lote.notas}\n`;
        }
        reporte += '\n';
    });

    // Descargar como archivo de texto
    const blob = new Blob([reporte], { type: 'text/plain;charset=utf-8' });
    const fecha = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `reporte_lotes_${fecha}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();

    mostrarNotificacion('Reporte generado', 'success');
}

/**
 * Exporta datos a formato CSV
 */
function exportarCSV() {
    const lotes = obtenerLotes();

    let csv = 'ID,Nombre Propietario,Rol,Tipo,Notas\n';

    lotes.forEach(lote => {
        const tipo = lote.es_oficial ? 'Oficial' : 'Agregado';
        const notas = (lote.notas || '').replace(/"/g, '""');
        csv += `${lote.id},"${lote.nombre_propietario}","${lote.rol_propiedad || ''}","${tipo}","${notas}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fecha = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `lotes_san_rafael_${fecha}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();

    mostrarNotificacion('CSV exportado', 'success');
}
