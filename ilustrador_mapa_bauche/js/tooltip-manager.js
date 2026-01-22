/**
 * tooltip-manager.js - Sistema de tooltips
 * Editor Plano San Rafael
 */

let tooltipTimeout = null;

/**
 * Muestra el tooltip para un lote
 */
function mostrarTooltipLote(loteId) {
    const lote = obtenerLotePorId(loteId);
    if (!lote) return;

    const tooltip = document.getElementById('tooltip');
    const contenido = tooltip.querySelector('.tooltip-content');

    contenido.innerHTML = `
        <strong>${lote.nombre_propietario}</strong>
        <span class="rol">Rol: ${lote.rol_propiedad || 'Sin asignar'}</span>
        <span class="tipo ${lote.es_oficial ? 'oficial' : 'agregado'}">
            ${lote.es_oficial ? 'Lote Oficial' : 'Agregado Manualmente'}
        </span>
        ${lote.notas ? `<em>${lote.notas}</em>` : ''}
    `;

    tooltip.classList.add('visible');

    // Seguir el mouse
    document.addEventListener('mousemove', posicionarTooltip);
}

/**
 * Posiciona el tooltip cerca del cursor
 */
function posicionarTooltip(e) {
    const tooltip = document.getElementById('tooltip');

    let x = e.clientX + 15;
    let y = e.clientY + 15;

    // Evitar que se salga de la pantalla
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        x = e.clientX - rect.width - 15;
    }
    if (y + rect.height > window.innerHeight) {
        y = e.clientY - rect.height - 15;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

/**
 * Oculta el tooltip
 */
function ocultarTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');

    document.removeEventListener('mousemove', posicionarTooltip);
}

/**
 * Muestra tooltip temporal con mensaje
 */
function mostrarTooltipMensaje(mensaje, x, y) {
    const tooltip = document.getElementById('tooltip');
    const contenido = tooltip.querySelector('.tooltip-content');

    contenido.innerHTML = mensaje;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.classList.add('visible');

    // Ocultar despues de 2 segundos
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
        tooltip.classList.remove('visible');
    }, 2000);
}
