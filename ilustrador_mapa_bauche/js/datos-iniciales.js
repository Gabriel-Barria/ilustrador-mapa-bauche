/**
 * datos-iniciales.js - Datos pre-cargados del plano
 * Estos son los nombres que estaban en PLANO CASAS.png
 */

const DATOS_INICIALES = [
    // Fila superior
    { nombre: "MANUEL CORREA", x: 480, y: 280, oficial: true },
    { nombre: "ROSA PEREZ", x: 620, y: 280, oficial: true },
    { nombre: "ROSA BURGOS", x: 760, y: 280, oficial: true },
    { nombre: "HECTOR SEBASTIAN", x: 900, y: 260, oficial: true },
    { nombre: "HUGO BRICEÑO", x: 1050, y: 280, oficial: true },

    // Segunda fila
    { nombre: "BARRIGA CASTRO", x: 450, y: 380, oficial: true },
    { nombre: "CRISTIAN CORTES", x: 580, y: 380, oficial: true },
    { nombre: "JULIO SOTO", x: 700, y: 380, oficial: true },
    { nombre: "JERIA BARRIA", x: 820, y: 380, oficial: true },
    { nombre: "JAVIER PORTUGUEZ", x: 960, y: 360, oficial: true },
    { nombre: "YURI MELLADEZ", x: 1120, y: 380, oficial: true },

    // Tercera fila
    { nombre: "CARLOS GARRIDO", x: 520, y: 460, oficial: true },
    { nombre: "GABRIEL GARRIDO", x: 700, y: 460, oficial: true },
    { nombre: "MARCELO MELLADEZ", x: 880, y: 460, oficial: true },

    // Cuarta fila
    { nombre: "GONZALO NAVARRETE", x: 420, y: 540, oficial: true },
    { nombre: "JEISSON KLAUDIÑO", x: 560, y: 540, oficial: true },
    { nombre: "MAURICIO PAREDES", x: 700, y: 540, oficial: true },
    { nombre: "MAURICIO MUÑOZ TALLER", x: 860, y: 520, oficial: true },
    { nombre: "MARIELA BARRIA", x: 1000, y: 520, oficial: true },
    { nombre: "GABRIEL YAÑEZ", x: 1140, y: 540, oficial: true },

    // Quinta fila
    { nombre: "PATRICIA ESPINOZA", x: 560, y: 620, oficial: true },
    { nombre: "DANIEL SANTOS", x: 720, y: 640, oficial: true },
    { nombre: "ELIAS NAVARRETE", x: 900, y: 660, oficial: true },
    { nombre: "GLORIA VELASQUEZ", x: 1080, y: 620, oficial: true },

    // Sexta fila
    { nombre: "MIGUEL BLANCO", x: 620, y: 720, oficial: true },
    { nombre: "SONIA CORONEL", x: 820, y: 760, oficial: true },

    // Séptima fila
    { nombre: "LEONARDO SOTO", x: 580, y: 860, oficial: true },
    { nombre: "BALTAZAR SOTO", x: 680, y: 920, oficial: true },
];

/**
 * Carga los datos iniciales en la base de datos y el canvas
 */
async function cargarDatosIniciales() {
    // Solo cargar si la BD está vacía
    const lotesExistentes = obtenerLotes();
    if (lotesExistentes.length > 0) {
        console.log('Ya hay datos cargados, saltando datos iniciales');
        return;
    }

    console.log('Cargando datos iniciales...');

    const canvas = AppState.canvas;
    if (!canvas) {
        console.error('Canvas no inicializado');
        return;
    }

    // Escala para ajustar posiciones a la imagen real
    // Las posiciones están basadas en una imagen de aprox 1200x1000
    // La imagen real es más grande, así que escalamos
    const escalaX = dimensionesOriginales.width / 1200;
    const escalaY = dimensionesOriginales.height / 1000;

    for (const dato of DATOS_INICIALES) {
        // Crear lote en BD
        const loteId = await crearLote({
            nombre_propietario: dato.nombre,
            rol_propiedad: null,
            es_oficial: dato.oficial ? 1 : 0
        });

        // Calcular posición escalada
        const posX = dato.x * escalaX;
        const posY = dato.y * escalaY;

        // Crear texto en BD
        const color = dato.oficial ? '#0000FF' : '#FF6600';
        const fontSize = Math.max(16, Math.round(dimensionesOriginales.width / 120));

        const textoId = crearTexto({
            lote_id: loteId,
            contenido: dato.nombre,
            pos_x: posX,
            pos_y: posY,
            font_size: fontSize,
            color: color
        });

        // Crear texto en canvas
        const texto = new fabric.IText(dato.nombre, {
            left: posX,
            top: posY,
            fontSize: fontSize,
            fill: color,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            editable: true,
            textoId: textoId,
            loteId: loteId,
            esOficial: dato.oficial
        });

        canvas.add(texto);
    }

    canvas.renderAll();
    await renderizarListaLotes();
    actualizarBarraEstado();

    mostrarNotificacion(`${DATOS_INICIALES.length} lotes cargados. Arrastra los textos para ajustar posiciones.`, 'success');
}
