#!/usr/bin/env python3
"""
Servidor HTTP con API REST para gestion de proyectos.
Ejecutar: python serve.py
Abrir: http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import json
import uuid
import shutil
from urllib.parse import urlparse, parse_qs
from io import BytesIO

PORT = 8000
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'projects')

# Asegurar que existe el directorio de datos
os.makedirs(DATA_DIR, exist_ok=True)

# Cambiar al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class APIHandler(http.server.SimpleHTTPRequestHandler):
    """Handler que combina archivos estaticos con API REST"""

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/projects':
            self._listar_proyectos()
        elif path.startswith('/api/projects/') and path.endswith('/image'):
            project_id = path.split('/')[3]
            self._obtener_imagen(project_id)
        elif path.startswith('/api/projects/') and path.endswith('/thumbnail'):
            project_id = path.split('/')[3]
            self._obtener_thumbnail(project_id)
        elif path.startswith('/api/projects/') and path.endswith('/database'):
            project_id = path.split('/')[3]
            self._obtener_database(project_id)
        elif path.startswith('/api/shared/') and path.endswith('/metadata'):
            token = path.split('/')[3]
            self._obtener_shared_metadata(token)
        elif path.startswith('/api/shared/') and path.endswith('/image'):
            token = path.split('/')[3]
            self._obtener_shared_image(token)
        elif path.startswith('/api/shared/') and path.endswith('/database'):
            token = path.split('/')[3]
            self._obtener_shared_database(token)
        else:
            # Servir archivos estaticos
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/projects':
            self._crear_proyecto()
        elif path.startswith('/api/projects/') and path.endswith('/share'):
            project_id = path.split('/')[3]
            self._generar_share_token(project_id)
        else:
            self.send_error(404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/projects/') and path.endswith('/database'):
            project_id = path.split('/')[3]
            self._guardar_database(project_id)
        elif path.startswith('/api/projects/') and path.endswith('/metadata'):
            project_id = path.split('/')[3]
            self._actualizar_metadata(project_id)
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/projects/') and len(path.split('/')) == 4:
            project_id = path.split('/')[3]
            self._eliminar_proyecto(project_id)
        else:
            self.send_error(404)

    def do_HEAD(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/shared/') and path.endswith('/database'):
            token = path.split('/')[3]
            project_id = self._resolver_token(token)
            if not project_id:
                self.send_error(404)
                return

            db_path = os.path.join(DATA_DIR, project_id, 'database.sqlite')
            if not os.path.isfile(db_path):
                self.send_response(204)
                self.end_headers()
                return

            stat = os.stat(db_path)
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(stat.st_size))
            self.send_header('X-DB-Size', str(stat.st_size))
            self.send_header('X-DB-Modified', str(stat.st_mtime))
            self.send_header('Access-Control-Expose-Headers', 'X-DB-Size, X-DB-Modified')
            self.end_headers()
        else:
            super().do_HEAD()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # --- API Endpoints ---

    def _listar_proyectos(self):
        """GET /api/projects - Lista todos los proyectos"""
        proyectos = []

        if os.path.exists(DATA_DIR):
            for proj_id in os.listdir(DATA_DIR):
                meta_path = os.path.join(DATA_DIR, proj_id, 'metadata.json')
                if os.path.isfile(meta_path):
                    with open(meta_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                        proyectos.append(meta)

        # Ordenar por fecha de modificacion (mas reciente primero)
        proyectos.sort(key=lambda p: p.get('fecha_modificacion', ''), reverse=True)

        self._enviar_json(proyectos)

    def _crear_proyecto(self):
        """POST /api/projects - Crea un nuevo proyecto (multipart/form-data)"""
        content_type = self.headers.get('Content-Type', '')

        if 'multipart/form-data' in content_type:
            # Parsear multipart manualmente
            boundary = content_type.split('boundary=')[1].strip()
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            parts = self._parse_multipart(body, boundary)

            nombre = parts.get('nombre', {}).get('data', b'').decode('utf-8')
            imagen_data = parts.get('imagen', {}).get('data', b'')
            imagen_filename = parts.get('imagen', {}).get('filename', 'imagen.png')

            if not nombre or not imagen_data:
                self._enviar_json({'error': 'Faltan datos'}, 400)
                return

            # Generar ID unico
            project_id = 'proj_' + str(uuid.uuid4().hex[:12])
            project_dir = os.path.join(DATA_DIR, project_id)
            os.makedirs(project_dir, exist_ok=True)

            # Guardar imagen
            ext = os.path.splitext(imagen_filename)[1] or '.png'
            imagen_path = os.path.join(project_dir, f'image{ext}')
            with open(imagen_path, 'wb') as f:
                f.write(imagen_data)

            # Crear metadata
            from datetime import datetime
            ahora = datetime.now().isoformat()
            metadata = {
                'id': project_id,
                'nombre': nombre,
                'fecha_creacion': ahora,
                'fecha_modificacion': ahora,
                'total_lotes': 0,
                'imagen_nombre': imagen_filename,
                'imagen_ext': ext
            }

            meta_path = os.path.join(project_dir, 'metadata.json')
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # Generar thumbnail (guardar copia reducida - se hara en el frontend)
            thumb_path = os.path.join(project_dir, 'thumbnail.jpg')
            # Por ahora copiar la imagen como thumbnail (el frontend genera el real)
            shutil.copy2(imagen_path, thumb_path)

            self._enviar_json(metadata, 201)

        elif 'application/json' in content_type:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            self._enviar_json({'error': 'Usar multipart/form-data'}, 400)
        else:
            self._enviar_json({'error': 'Content-Type no soportado'}, 400)

    def _obtener_imagen(self, project_id):
        """GET /api/projects/<id>/image - Obtiene la imagen del proyecto"""
        project_dir = os.path.join(DATA_DIR, project_id)
        meta_path = os.path.join(project_dir, 'metadata.json')

        if not os.path.isfile(meta_path):
            self.send_error(404)
            return

        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        ext = meta.get('imagen_ext', '.png')
        imagen_path = os.path.join(project_dir, f'image{ext}')

        if not os.path.isfile(imagen_path):
            self.send_error(404)
            return

        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        }

        mime = mime_types.get(ext.lower(), 'application/octet-stream')

        with open(imagen_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def _obtener_thumbnail(self, project_id):
        """GET /api/projects/<id>/thumbnail - Obtiene el thumbnail"""
        project_dir = os.path.join(DATA_DIR, project_id)
        thumb_path = os.path.join(project_dir, 'thumbnail.jpg')

        if not os.path.isfile(thumb_path):
            # Fallback: servir la imagen original
            self._obtener_imagen(project_id)
            return

        with open(thumb_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def _obtener_database(self, project_id):
        """GET /api/projects/<id>/database - Obtiene la BD SQLite"""
        project_dir = os.path.join(DATA_DIR, project_id)
        db_path = os.path.join(project_dir, 'database.sqlite')

        if not os.path.isfile(db_path):
            self.send_response(204)
            self.end_headers()
            return

        with open(db_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def _guardar_database(self, project_id):
        """PUT /api/projects/<id>/database - Guarda la BD SQLite"""
        project_dir = os.path.join(DATA_DIR, project_id)

        if not os.path.isdir(project_dir):
            self.send_error(404)
            return

        content_length = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(content_length)

        db_path = os.path.join(project_dir, 'database.sqlite')
        with open(db_path, 'wb') as f:
            f.write(data)

        self._enviar_json({'ok': True})

    def _actualizar_metadata(self, project_id):
        """PUT /api/projects/<id>/metadata - Actualiza metadata del proyecto"""
        project_dir = os.path.join(DATA_DIR, project_id)
        meta_path = os.path.join(project_dir, 'metadata.json')

        if not os.path.isfile(meta_path):
            self.send_error(404)
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        updates = json.loads(body)

        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        # Actualizar campos permitidos
        for key in ['fecha_modificacion', 'total_lotes', 'nombre']:
            if key in updates:
                meta[key] = updates[key]

        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        self._enviar_json(meta)

    def _eliminar_proyecto(self, project_id):
        """DELETE /api/projects/<id> - Elimina un proyecto"""
        project_dir = os.path.join(DATA_DIR, project_id)

        if os.path.isdir(project_dir):
            shutil.rmtree(project_dir)

        self._enviar_json({'ok': True})

    # --- Compartir Proyecto ---

    def _generar_share_token(self, project_id):
        """POST /api/projects/<id>/share - Genera token de compartir"""
        import secrets

        project_dir = os.path.join(DATA_DIR, project_id)
        meta_path = os.path.join(project_dir, 'metadata.json')

        if not os.path.isfile(meta_path):
            self.send_error(404)
            return

        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        # Reusar token existente o crear uno nuevo
        if 'share_token' not in meta:
            meta['share_token'] = secrets.token_hex(4)
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

        self._enviar_json({'token': meta['share_token']})

    def _resolver_token(self, token):
        """Busca el proyecto que tiene el token dado"""
        if not os.path.exists(DATA_DIR):
            return None

        for proj_id in os.listdir(DATA_DIR):
            meta_path = os.path.join(DATA_DIR, proj_id, 'metadata.json')
            if os.path.isfile(meta_path):
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                if meta.get('share_token') == token:
                    return proj_id

        return None

    def _obtener_shared_metadata(self, token):
        """GET /api/shared/<token>/metadata - Metadata publica"""
        project_id = self._resolver_token(token)
        if not project_id:
            self.send_error(404)
            return

        meta_path = os.path.join(DATA_DIR, project_id, 'metadata.json')
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        self._enviar_json({
            'nombre': meta['nombre'],
            'imagen_ext': meta.get('imagen_ext', '.png'),
            'total_lotes': meta.get('total_lotes', 0),
            'fecha_modificacion': meta.get('fecha_modificacion', '')
        })

    def _obtener_shared_image(self, token):
        """GET /api/shared/<token>/image - Imagen por token"""
        project_id = self._resolver_token(token)
        if not project_id:
            self.send_error(404)
            return
        self._obtener_imagen(project_id)

    def _obtener_shared_database(self, token):
        """GET /api/shared/<token>/database - BD por token"""
        project_id = self._resolver_token(token)
        if not project_id:
            self.send_error(404)
            return

        project_dir = os.path.join(DATA_DIR, project_id)
        db_path = os.path.join(project_dir, 'database.sqlite')

        if not os.path.isfile(db_path):
            self.send_response(204)
            self.end_headers()
            return

        stat = os.stat(db_path)

        with open(db_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', len(data))
        self.send_header('X-DB-Size', str(stat.st_size))
        self.send_header('X-DB-Modified', str(stat.st_mtime))
        self.send_header('Access-Control-Expose-Headers', 'X-DB-Size, X-DB-Modified')
        self.end_headers()
        self.wfile.write(data)

    # --- Utilidades ---

    def _enviar_json(self, data, status=200):
        """Envia una respuesta JSON"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _parse_multipart(self, body, boundary):
        """Parsea un cuerpo multipart/form-data"""
        parts = {}
        boundary_bytes = ('--' + boundary).encode()
        end_boundary = (boundary + '--').encode()

        sections = body.split(boundary_bytes)

        for section in sections:
            if not section or section.strip() == b'' or section.strip() == b'--':
                continue
            if section.strip() == end_boundary:
                continue

            # Separar headers del contenido
            if b'\r\n\r\n' in section:
                header_part, data = section.split(b'\r\n\r\n', 1)
            elif b'\n\n' in section:
                header_part, data = section.split(b'\n\n', 1)
            else:
                continue

            # Remover trailing \r\n del data
            if data.endswith(b'\r\n'):
                data = data[:-2]
            elif data.endswith(b'\n'):
                data = data[:-1]

            headers_str = header_part.decode('utf-8', errors='replace')

            # Extraer nombre del campo
            name = None
            filename = None
            for line in headers_str.split('\n'):
                line = line.strip()
                if 'Content-Disposition' in line:
                    if 'name="' in line:
                        name = line.split('name="')[1].split('"')[0]
                    if 'filename="' in line:
                        filename = line.split('filename="')[1].split('"')[0]

            if name:
                parts[name] = {'data': data, 'filename': filename}

        return parts

    def log_message(self, format, *args):
        """Reducir logs innecesarios"""
        pass


# Agregar MIME types
APIHandler.extensions_map['.wasm'] = 'application/wasm'

print(f"Servidor iniciado en http://localhost:{PORT}")
print(f"Datos guardados en: {DATA_DIR}")
print("Presiona Ctrl+C para detener")

# Abrir navegador automaticamente (no en Docker)
if not os.environ.get('DOCKER'):
    webbrowser.open(f'http://localhost:{PORT}')

# Usar SO_REUSEADDR para evitar error de puerto en uso
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")
