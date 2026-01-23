/**
 * database.js - Gestion de SQLite con sql.js
 * Editor Plano San Rafael
 */

/**
 * Inicializa la base de datos SQLite
 * @param {ArrayBuffer|null} datosGuardados - BD guardada previamente (opcional)
 */
async function initDatabase(datosGuardados) {
    // Cargar sql.js
    const SQL = await initSqlJs({
        locateFile: file => `lib/${file}`
    });

    if (datosGuardados) {
        // Restaurar BD desde datos guardados
        AppState.db = new SQL.Database(new Uint8Array(datosGuardados));
        console.log('Base de datos restaurada desde proyecto');

        // Asegurar que las tablas nuevas existan (por si la BD es de version anterior)
        crearEsquema();
    } else {
        // Crear nueva base de datos
        AppState.db = new SQL.Database();
        crearEsquema();
        console.log('Nueva base de datos creada');
    }
}

/**
 * Crea el esquema de la base de datos
 */
function crearEsquema() {
    const db = AppState.db;

    // Tabla de lotes
    db.run(`
        CREATE TABLE IF NOT EXISTS lotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_propietario TEXT NOT NULL,
            rol_propiedad TEXT,
            telefono TEXT,
            es_oficial INTEGER DEFAULT 1,
            notas TEXT,
            fecha_creacion TEXT DEFAULT (datetime('now')),
            fecha_modificacion TEXT DEFAULT (datetime('now'))
        )
    `);

    // Tabla de textos
    db.run(`
        CREATE TABLE IF NOT EXISTS textos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER,
            contenido TEXT NOT NULL,
            pos_x REAL NOT NULL,
            pos_y REAL NOT NULL,
            font_size INTEGER DEFAULT 14,
            color TEXT DEFAULT '#0000FF',
            angulo REAL DEFAULT 0,
            visible INTEGER DEFAULT 1,
            FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE SET NULL
        )
    `);

    // Tabla de poligonos
    db.run(`
        CREATE TABLE IF NOT EXISTS poligonos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER NOT NULL,
            puntos TEXT NOT NULL,
            color_borde TEXT DEFAULT '#000000',
            color_relleno TEXT DEFAULT 'rgba(0,0,255,0.1)',
            FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE
        )
    `);

    // Tabla de configuracion
    db.run(`
        CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT
        )
    `);

    // Tabla de lineas divisorias
    db.run(`
        CREATE TABLE IF NOT EXISTS lineas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            punto_inicio_x REAL NOT NULL,
            punto_inicio_y REAL NOT NULL,
            punto_fin_x REAL NOT NULL,
            punto_fin_y REAL NOT NULL,
            color TEXT DEFAULT '#8B0000',
            grosor REAL DEFAULT 2,
            fecha_creacion TEXT DEFAULT (datetime('now'))
        )
    `);
}

/**
 * CRUD para lotes
 */
async function crearLote(datos) {
    const db = AppState.db;
    db.run(`
        INSERT INTO lotes (nombre_propietario, rol_propiedad, telefono, es_oficial, notas)
        VALUES (?, ?, ?, ?, ?)
    `, [datos.nombre_propietario, datos.rol_propiedad, datos.telefono || null, datos.es_oficial, datos.notas || null]);

    // Obtener ID del ultimo registro insertado
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function obtenerLotes(filtro = 'all') {
    const db = AppState.db;
    let sql = 'SELECT * FROM lotes';

    if (filtro === 'oficial') {
        sql += ' WHERE es_oficial = 1';
    } else if (filtro === 'agregado') {
        sql += ' WHERE es_oficial = 0';
    }

    sql += ' ORDER BY nombre_propietario';

    const result = db.exec(sql);
    if (!result[0]) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

function obtenerLotePorId(id) {
    const db = AppState.db;
    const result = db.exec('SELECT * FROM lotes WHERE id = ?', [id]);

    if (!result[0] || !result[0].values[0]) return null;

    const columns = result[0].columns;
    const obj = {};
    columns.forEach((col, i) => obj[col] = result[0].values[0][i]);
    return obj;
}

function actualizarLote(id, datos) {
    const db = AppState.db;
    db.run(`
        UPDATE lotes SET
            nombre_propietario = ?,
            rol_propiedad = ?,
            telefono = ?,
            es_oficial = ?,
            notas = ?,
            fecha_modificacion = datetime('now')
        WHERE id = ?
    `, [datos.nombre_propietario, datos.rol_propiedad, datos.telefono, datos.es_oficial, datos.notas, id]);
}

function eliminarLote(id) {
    const db = AppState.db;
    db.run('DELETE FROM lotes WHERE id = ?', [id]);
}

/**
 * CRUD para textos
 */
function crearTexto(datos) {
    const db = AppState.db;
    db.run(`
        INSERT INTO textos (lote_id, contenido, pos_x, pos_y, font_size, color, angulo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        datos.lote_id,
        datos.contenido,
        datos.pos_x,
        datos.pos_y,
        datos.font_size || 14,
        datos.color || '#0000FF',
        datos.angulo || 0
    ]);

    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function obtenerTextos() {
    const db = AppState.db;
    const result = db.exec(`
        SELECT t.*, l.nombre_propietario, l.es_oficial
        FROM textos t
        LEFT JOIN lotes l ON t.lote_id = l.id
        WHERE t.visible = 1
    `);

    if (!result[0]) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

function actualizarTexto(id, datos) {
    const db = AppState.db;
    db.run(`
        UPDATE textos SET
            contenido = ?,
            pos_x = ?,
            pos_y = ?,
            font_size = ?,
            color = ?,
            angulo = ?
        WHERE id = ?
    `, [datos.contenido, datos.pos_x, datos.pos_y, datos.font_size, datos.color, datos.angulo, id]);
}

function eliminarTexto(id) {
    const db = AppState.db;
    db.run('DELETE FROM textos WHERE id = ?', [id]);
}

/**
 * CRUD para poligonos
 */
function crearPoligono(datos) {
    const db = AppState.db;
    db.run(`
        INSERT INTO poligonos (lote_id, puntos, color_borde, color_relleno)
        VALUES (?, ?, ?, ?)
    `, [
        datos.lote_id,
        JSON.stringify(datos.puntos),
        datos.color_borde || '#000000',
        datos.color_relleno || 'rgba(0,0,255,0.1)'
    ]);

    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function obtenerPoligonos() {
    const db = AppState.db;
    const result = db.exec(`
        SELECT p.*, l.nombre_propietario, l.es_oficial
        FROM poligonos p
        JOIN lotes l ON p.lote_id = l.id
    `);

    if (!result[0]) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        obj.puntos = JSON.parse(obj.puntos);
        return obj;
    });
}

function eliminarPoligono(id) {
    const db = AppState.db;
    db.run('DELETE FROM poligonos WHERE id = ?', [id]);
}

/**
 * CRUD para lineas divisorias
 */
function crearLinea(datos) {
    const db = AppState.db;
    db.run(`
        INSERT INTO lineas (punto_inicio_x, punto_inicio_y, punto_fin_x, punto_fin_y, color, grosor)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        datos.punto_inicio_x,
        datos.punto_inicio_y,
        datos.punto_fin_x,
        datos.punto_fin_y,
        datos.color || '#8B0000',
        datos.grosor || 2
    ]);

    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function obtenerLineas() {
    const db = AppState.db;
    const result = db.exec('SELECT * FROM lineas');

    if (!result[0]) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

function actualizarLinea(id, datos) {
    const db = AppState.db;
    db.run(`
        UPDATE lineas SET
            punto_inicio_x = ?,
            punto_inicio_y = ?,
            punto_fin_x = ?,
            punto_fin_y = ?
        WHERE id = ?
    `, [datos.punto_inicio_x, datos.punto_inicio_y, datos.punto_fin_x, datos.punto_fin_y, id]);
}

function eliminarLinea(id) {
    const db = AppState.db;
    db.run('DELETE FROM lineas WHERE id = ?', [id]);
}

/**
 * Configuracion
 */
function guardarConfiguracion(clave, valor) {
    const db = AppState.db;
    db.run(`
        INSERT OR REPLACE INTO configuracion (clave, valor)
        VALUES (?, ?)
    `, [clave, valor]);
}

function obtenerConfiguracion(clave) {
    const db = AppState.db;
    const result = db.exec('SELECT valor FROM configuracion WHERE clave = ?', [clave]);
    return result[0]?.values[0]?.[0] || null;
}

/**
 * Exportar base de datos
 */
function exportarBaseDatos() {
    const db = AppState.db;
    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });

    const fecha = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `plano_san_rafael_${fecha}.sqlite`;
    link.href = URL.createObjectURL(blob);
    link.click();

    mostrarNotificacion('Base de datos exportada', 'success');
}

/**
 * Importar base de datos
 */
async function importarBaseDatos(archivo) {
    try {
        const buffer = await archivo.arrayBuffer();
        const uintArray = new Uint8Array(buffer);

        const SQL = await initSqlJs({
            locateFile: file => `lib/${file}`
        });

        // Cerrar BD actual y abrir la importada
        if (AppState.db) {
            AppState.db.close();
        }
        AppState.db = new SQL.Database(uintArray);

        // Recargar todo
        await cargarTodosLosElementos();
        await cargarLotesEnLista();
        actualizarBarraEstado();

        mostrarNotificacion('Base de datos importada correctamente', 'success');
    } catch (error) {
        console.error('Error al importar BD:', error);
        mostrarNotificacion('Error al importar la base de datos', 'error');
    }
}
