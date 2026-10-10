# Mi Patrimonio

Aplicación de gestión de patrimonio personal: cuentas, transacciones, inversiones, gráficas e importación desde MoneyMatter.

## Despliegue con Docker en Proxmox

### Opción A: Docker Compose (recomendada)

1. Crea un contenedor LXC en Proxmox con Ubuntu/Debian y instala Docker dentro:
   ```bash
   apt update && apt install -y docker.io docker-compose
   ```

2. Copia el proyecto al contenedor y constrúyelo:
   ```bash
   docker compose up -d --build
   ```

3. La app estará disponible en `http://<IP-DEL-CONTENEDOR>:3000`

Los datos se guardan en un volumen Docker persistente (`mi-patrimonio-data`) montado en `/data` dentro del contenedor.

### Opción B: VM con Docker

Si prefieres una VM en lugar de LXC, crea una VM con Ubuntu Server, instala Docker y sigue los mismos pasos.

### Variables de entorno

| Variable  | Default       | Descripción                          |
|-----------|---------------|--------------------------------------|
| `PORT`    | `3000`        | Puerto del servidor                  |
| `DB_PATH` | `/data/app.db`| Ruta de la base de datos SQLite      |
| `TZ`      | `Europe/Madrid` | Zona horaria                       |

### Copias de seguridad

La app incluye copias de seguridad automáticas en `/data/backups/`. Con el volumen Docker, estas se persisten junto con la base de datos.

Para hacer una copia manual externa:
```bash
docker cp mi-patrimonio:/data/app.db ./backup-$(date +%Y%m%d).db
```

### Actualizar

```bash
git pull
docker compose up -d --build
```

### Reverse proxy (opcional)

Para servir la app sobre HTTPS con un dominio, usa Caddy o Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name patrimonio.tudominio.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
