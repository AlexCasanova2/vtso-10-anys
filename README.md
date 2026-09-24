# Cumplimos 10 años, regalamos 10.000 €

Plataforma para gestionar las tres jornadas independientes del sorteo de aniversario de Viladecans The Style Outlets.

## Funcionalidades

- Inscripción pública con DNI, NIE o pasaporte y un máximo de 1.000 números únicos por jornada.
- Asignación y extracciones deterministas a partir de semillas criptográficas secretas.
- Tarjeta por correo transaccional mediante Brevo.
- Pantalla pública en tiempo real con QR, contador, cuenta atrás y número extraído.
- Administración optimizada para tablet: búsqueda, corrección de correo y reenvío.
- Secuencia de números ganadores preparada al inicio y revelada uno a uno desde administración.
- CRM con histórico separado por jornada y exportación CSV.
- Auditoría de cambios y publicación de semillas al finalizar la jornada.

## Puesta en marcha

1. Crea un proyecto de Supabase en una región europea.
2. Ejecuta `supabase/migrations/202609230001_initial.sql` desde el editor SQL.
3. Copia `.env.example` a `.env.local` y completa las variables.
4. Ejecuta `npm install` y `npm run dev`.
5. Desactiva el alta pública de usuarios en Supabase Authentication.
6. Crea el usuario inicial desde Supabase Authentication y asígnale un perfil ejecutando `insert into public.profiles (id, full_name, role) values ('ID_DEL_USUARIO', 'Nombre', 'admin');` en el editor SQL. Para personal de incidencias utiliza el rol `operator`.
7. Configura en Brevo el webhook `https://tu-dominio/api/webhooks/brevo` y añade la cabecera `x-webhook-secret` con el valor de `BREVO_WEBHOOK_SECRET`.

## Aleatoriedad verificable

Al crear una jornada, el servidor genera dos semillas independientes de 256 bits: una para asignaciones y otra para extracciones. Antes de empezar se publica en la configuración el SHA-256 de la semilla de extracciones.

La asignación calcula `HMAC-SHA256(semilla, tipo_documento:documento:país)`, obtiene un índice mediante rejection sampling sin sesgo modular y recorre circularmente el pool hasta encontrar un número libre. Al comenzar el sorteo se genera, con la semilla independiente de extracciones, una secuencia sin repeticiones sobre el rango completo `000-999`; no depende de los números que se hayan asignado a participantes. La secuencia queda registrada en el servidor y cada revelación posterior se audita por separado.

Al marcar una jornada como finalizada se revelan las semillas. Con ellas, el listado ordenado de participaciones y el histórico de extracciones se puede reproducir y contrastar con los compromisos publicados. La explicación definitiva debe incorporarse a las bases legales y ser revisada jurídicamente.

## Operación del evento

- El cierre se configura por jornada; se recomienda fijarlo diez minutos antes del inicio.
- A la hora programada se selecciona una secuencia única de números entre `000` y `999`, independientemente de los números asignados a participantes.
- El primer número se revela automáticamente y los siguientes permanecen ocultos.
- Cada número posterior se revela desde el panel con el botón `Extreure un nou número`.
- Al entregar todos los premios, marca la jornada como `Finalizada` para revelar las semillas de verificación.
