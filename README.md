# Cumplimos 10 años, regalamos 10.000 €

Plataforma para gestionar las tres jornadas independientes del sorteo de aniversario de Viladecans The Style Outlets.

## Funcionalidades

- Inscripción presencial desde administración: el personal verifica el ticket físico (referencia e importe) y asigna 1 número desde 60 €, 2 desde 80 € o 3 desde 100 €, hasta 1.000 números únicos por jornada.
- Asignación y extracciones deterministas a partir de semillas criptográficas secretas.
- Un solo correo transaccional mediante Brevo con todos los números acumulados por persona y jornada (también al reenviar).
- Pantalla pública en tiempo real con contador, cuenta atrás, indicaciones de inscripción presencial y número extraído.
- Administración optimizada para tablet: búsqueda, corrección de correo y reenvío.
- Secuencia de números inscritos preparada al inicio, revelada uno a uno y repetición de ronda si el ganador no está presente, con histórico por jornada.
- CRM con histórico separado por jornada y exportación CSV.
- Auditoría de cambios y publicación de semillas al finalizar la jornada.

## Puesta en marcha

1. Crea un proyecto de Supabase en una región europea.
2. Ejecuta `supabase/migrations/202609230001_initial.sql` y después `supabase/migrations/202610010001_staff_tickets.sql` desde el editor SQL (en instalaciones existentes, solo la segunda migración, antes de desplegar esta versión).
3. Copia `.env.example` a `.env.local` y completa las variables.
4. Ejecuta `npm install` y `npm run dev`.
5. Desactiva el alta pública de usuarios en Supabase Authentication.
6. Crea el usuario inicial desde Supabase Authentication y asígnale un perfil ejecutando `insert into public.profiles (id, full_name, role) values ('ID_DEL_USUARIO', 'Nombre', 'admin');` en el editor SQL. Para personal de incidencias utiliza el rol `operator`.
7. Configura en Brevo el webhook `https://tu-dominio/api/webhooks/brevo` y añade la cabecera `x-webhook-secret` con el valor de `BREVO_WEBHOOK_SECRET`.

## Aleatoriedad verificable

Al crear una jornada, el servidor genera dos semillas independientes de 256 bits: una para asignaciones y otra para extracciones. Antes de empezar se publica en la configuración el SHA-256 de la semilla de extracciones.

La asignación calcula `HMAC-SHA256(semilla, tipo_documento:documento:país)`, obtiene un índice mediante rejection sampling sin sesgo modular y recorre circularmente el pool hasta encontrar un número libre. Al comenzar el sorteo se genera, con la semilla independiente de extracciones, una secuencia sin repeticiones entre los números inscritos. La secuencia queda registrada en el servidor y cada revelación posterior se audita por separado.

Al marcar una jornada como finalizada se revelan las semillas. Con ellas, el listado ordenado de participaciones y el histórico de extracciones se puede reproducir y contrastar con los compromisos publicados. La explicación definitiva debe incorporarse a las bases legales y ser revisada jurídicamente.

## Operación del evento

- El cierre se configura por jornada; se recomienda fijarlo diez minutos antes del inicio.
- El personal comprueba físicamente el ticket y registra su referencia única, el importe y los datos de la persona en el panel. No se asignan participaciones desde el enlace público; la referencia no puede utilizarse dos veces en una misma jornada.
- A la hora programada se selecciona una secuencia única entre los números asignados a participantes. Si no hay inscripciones, no se extrae ningún número.
- El primer número se revela automáticamente y los siguientes permanecen ocultos.
- Cada número posterior se revela desde el panel con el botón `Extreure un nou número`.
- Si la persona no está presente, `Tornar a sortejar aquesta ronda` registra el intento como ausente y extrae otro participante para el mismo premio; el histórico de la jornada conserva ambos números.
- El administrador puede finalizar el sorteo con confirmación desde la operativa, incluso si quedan premios sin extraer. El formulario presencial desaparece al cerrar la inscripción y la pantalla pública pasa automáticamente a la cuenta atrás de la siguiente jornada o a «Próximamente» si no existe otra.
- Al entregar todos los premios, marca la jornada como `Finalizada` para revelar las semillas de verificación.
