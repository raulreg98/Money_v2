# Normas de Desarrollo para Jules - Proyecto Mi Patrimonio

1. **Entorno y Datos:**
   - La aplicación maneja datos reales del usuario que NO se pueden perder.
   - Cualquier migración de base de datos debe ser **estrictamente aditiva**.

2. **Arquitectura y Stack:**
   - Frontend: React 18 + Vite + TypeScript + Tailwind + Recharts + lucide-react (directorio `src/`).
   - Sin `react-router` (la navegación se maneja por estado/hash).
   - Backend: Express 5 + Zod 4 + helmet + SQLite (vía `sql.js` en `/data/app.db`).

3. **Buenas Prácticas de Código:**
   - Realizar cambios mínimos y enfocados en el requerimiento. No añadir dependencias pesadas innecesarias.
   - Interfaz totalmente en castellano, formato de localización `es-ES`, diseño *mobile-first* y compatibilidad con tema claro/oscuro.

4. **Verificación Obligatoria:**
   - Antes de dar por finalizada cualquier tarea, ejecuta y verifica que pasen exitosamente:
     - `npm run build`
     - `npm test`

5. **Privacidad y Seguridad:**
   - No subir ni incluir en repositorios bases de datos, archivos `.env` o copias de seguridad.
