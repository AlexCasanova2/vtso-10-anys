# Cumplimos 10 años, regalamos 10.000 €

Plataforma para gestionar las tres jornadas independientes del sorteo de aniversario de Viladecans The Style Outlets.

## Funcionalidades

- Inscripción configurable por jornada: por defecto, el personal completa todos los datos y recoge la aceptación legal desde administración. Al desmarcar «Omple totes les dades des de l'administració», introduce solo referencia, importe, nombre y correo; el participante recibe un enlace para completar el resto. Se asignan 1 número desde 60 €, 2 desde 80 € o 3 desde 100 €, hasta 1.000 números únicos por jornada, únicamente al confirmar la inscripción.
- Asignación y extracciones deterministas a partir de semillas criptográficas secretas.
- Un solo correo transaccional mediante Brevo con todos los números acumulados por persona y jornada (también al reenviar).
- Pantalla pública en tiempo real con contador, cuenta atrás, indicaciones de inscripción presencial y número extraído.
- Administración optimizada para tablet: búsqueda, corrección de correo y reenvío.
- Secuencia de números inscritos preparada al inicio, revelada uno a uno y repetición de ronda si el ganador no está presente, con histórico por jornada.
- CRM con histórico separado por jornada y exportación CSV.
- Auditoría de cambios y publicación de semillas al finalizar la jornada.

## Puesta en marcha

1. Crea un proyecto de Supabase en una región europea.
2. Ejecuta las migraciones de `supabase/migrations/` en orden de nombre, incluida `202610060002_two_draw_attempts.sql`, desde el editor SQL. En instalaciones existentes aplica solo las migraciones pendientes antes de desplegar el código que las utiliza.
3. Copia `.env.example` a `.env.local` y completa las variables.
4. Ejecuta `npm install` y `npm run dev`.
5. Desactiva el alta pública de usuarios en Supabase Authentication.
6. Crea el usuario inicial desde Supabase Authentication y asígnale un perfil ejecutando `insert into public.profiles (id, full_name, role) values ('ID_DEL_USUARIO', 'Nombre', 'admin');` en el editor SQL. Para personal de incidencias utiliza el rol `operator`.
7. Configura en Brevo el webhook `https://tu-dominio/api/webhooks/brevo` y añade la cabecera `x-webhook-secret` con el valor de `BREVO_WEBHOOK_SECRET`.

Para comprobar la preparación atómica del sorteo tras instalar su migración, ejecuta `supabase/tests/prepare_draw_sequence.sql` desde el editor SQL. La prueba verifica el orden completo y la idempotencia, y termina con `ROLLBACK` para no conservar datos de prueba. No sustituye un simulacro de peticiones simultáneas antes del sorteo real.

Para comprobar el registro en dos pasos tras instalar su migración, ejecuta `supabase/tests/pending_ticket_registration.sql`. Crea una jornada de prueba dentro de una transacción, verifica que el enlace se invalida al reenviar o confirmar y termina con `ROLLBACK`.

El formulario completo está marcado por defecto en las jornadas nuevas. La migración conserva el modo de las jornadas existentes; puedes cambiarlo en su configuración. Los enlaces enviados siguen siendo válidos al cambiar el modo; para reenviarlos, vuelve al modo de enlace. Ejecuta `supabase/tests/staff_registration_mode.sql` para comprobar el modo por defecto, la aceptación obligatoria, la asignación y la finalización de enlaces anteriores; termina con `ROLLBACK`.

### Correo transaccional

El envío utiliza el relay SMTP de Brevo por el puerto 587 con STARTTLS. Configura `BREVO_SMTP_LOGIN` (usuario SMTP de Brevo), `BREVO_SMTP_KEY` (clave SMTP, no la clave API), `BREVO_SENDER_EMAIL` (remitente verificado) y `BREVO_SENDER_NAME` como secretos del servidor en Vercel para el entorno de producción. No publiques las claves en el repositorio ni las compartas por chat. El bloqueo de IP para claves API puede seguir activado si las conexiones SMTP están permitidas en Brevo.

Después de desplegar, comprueba que `/api/health` muestra `configured.brevo: true` y prueba un reenvío controlado a un buzón autorizado. Verifica la recepción y que el webhook actualiza el estado a `delivered`; la aceptación SMTP solo indica que Brevo recibió el mensaje. Si el webhook no incluye `X-Mailin-custom`, el estado de los nuevos envíos no podrá asociarse automáticamente y habrá que revisar su configuración en Brevo.

Configura también `REGISTRATION_BASE_URL=https://vtso10anys.tandemprojects.cat` en Vercel antes de desplegar el formulario en dos pasos. No construyas el enlace desde la cabecera `Host` de la petición: una URL configurada evita enviar invitaciones hacia un dominio ajeno. El enlace caduca a las 24 horas o al cierre de la inscripción, lo que ocurra primero; reenviarlo desde el panel invalida el anterior. Una invitación pendiente no asigna números ni participa en el sorteo. Si el correo inicial falla, el personal puede reenviar desde la lista de invitaciones pendientes.

## Aleatoriedad verificable

Al crear una jornada, el servidor genera dos semillas independientes de 256 bits: una para asignaciones y otra para extracciones. Antes de empezar se publica en la configuración el SHA-256 de la semilla de extracciones.

La asignación calcula `HMAC-SHA256(semilla, tipo_documento:documento:país)`, obtiene un índice mediante rejection sampling sin sesgo modular y recorre circularmente el pool hasta encontrar un número libre. Al comenzar el sorteo se genera, con la semilla independiente de extracciones, una secuencia sin repeticiones entre todos los números inscritos. Una función transaccional registra la secuencia y la primera revelación una sola vez, incluso ante peticiones simultáneas. Cada revelación posterior se audita por separado.

Al marcar una jornada como finalizada se revelan las semillas. Con ellas, el listado ordenado de participaciones y el histórico de extracciones se puede reproducir y contrastar con los compromisos publicados. La explicación definitiva debe incorporarse a las bases legales y ser revisada jurídicamente.

## Operación del evento

- El cierre se configura por jornada; se recomienda fijarlo diez minutos antes del inicio.
- El personal comprueba físicamente el ticket (referencia, importe y fecha) y la pertenencia al Club. En el modo completo registra también apellidos y documento, y confirma que el participante ha aceptado las bases y leído la política de privacidad. La fecha del ticket no se almacena en la aplicación.
- En el modo de enlace, el personal registra solo referencia, importe, nombre y correo; la persona completa el resto mediante el enlace recibido. Antes de confirmar no tiene números asignados. La referencia no puede confirmarse dos veces en la misma jornada. En ambos modos se envía un correo final con todos los números acumulados.
- Al terminar la cuenta atrás, la pantalla espera con el mensaje «El sorteig començarà en breus». No se inicia ninguna extracción por horario, por recargar ni por el cron.
- Desde la operativa, un administrador u operador pulsa `Inicia el sorteig` y confirma. Solo se permite a partir de la hora prevista, con inscripción cerrada y números confirmados. El inicio, la secuencia y el primer número se guardan en una única transacción; repetir la petición no vuelve a extraer. Los siguientes permanecen ocultos.
- Cada número posterior se revela desde el panel con el botón `Extreure un nou número`.
- Cada premio admite como máximo dos intentos. `No present: segon intent` registra la primera ausencia y revela otro número para el mismo premio. Si tampoco está presente, `No present: deixar el premi sense adjudicar` requiere confirmación, registra la segunda ausencia y deja el premio definitivamente sin adjudicar; revela el primer número del siguiente premio, si existe y quedan números. En el último premio no extrae otro número. El administrador sigue siendo quien finaliza la jornada.
- `Passar al següent premi` se usa cuando la persona está presente y se ha resuelto el premio; no registra una ausencia. Cada petición lleva el número actual esperado: solicitudes repetidas o de otro operador con un número anterior se rechazan sin avanzar. Las ausencias, el cierre sin adjudicar y la extracción siguiente se guardan en una única transacción.
- El administrador puede finalizar el sorteo con confirmación desde la operativa, incluso si quedan premios sin extraer. El formulario presencial desaparece al cerrar la inscripción y la pantalla pública pasa automáticamente a la cuenta atrás de la siguiente jornada o a «Próximamente» si no existe otra.
- Al entregar todos los premios, marca la jornada como `Finalizada` para revelar las semillas de verificación.
- Solo un administrador puede borrar una jornada con datos si está finalizada. Tras la confirmación, se eliminan en una transacción sus tickets, participaciones, extracciones, correos y auditorías asociadas; las personas compartidas con otras jornadas se conservan. Solo queda una constancia mínima de la eliminación. No se puede deshacer.

Después de instalar la migración de inicio manual, ejecuta `supabase/tests/manual_draw_start.sql` en un entorno de prueba. Verifica permisos, horario, ausencia de inscritos, rollback de una secuencia inválida, primera extracción única y protección de jornadas finalizadas. Termina con `ROLLBACK`. No sustituye un ensayo de concurrencia ni autoriza pruebas en la jornada real.

Para la regla de dos intentos, aplica también `202610060002_two_draw_attempts.sql` y ejecuta `supabase/tests/two_draw_attempts.sql` en pruebas. Comprueba el límite, las dos ausencias, premios sin adjudicar, avance normal, peticiones repetidas y cierre del último premio sin otra extracción. La prueba termina con `ROLLBACK`.
