# Modo táctico — beta

El modo clásico mantiene sus 13 casillas y reglas. Las partidas previas sin campo `mode` se reanudan como clásicas. Las bases de datos no se reescriben al iniciar partidas.

## Campo y posiciones

11 casillas: dos líneas de tiro y 9 casillas de duelo, tres por zona. Cada jugador tiene un rol principal `DEF`, `MED` o `DEL`. El bonus es +1 al atributo actual en su zona natural, invirtiendo las zonas para el rival. También se aplica a los delanteros al disparar; los porteros no reciben bonus. Se permiten jugadores fuera de su zona, sin penalización.

Formación común obligatoria: 4 DEF / 3 MED / 3 DEL. Los roles se editan en el editor y se proponen a partir de la posición principal PES, nunca de las estadísticas. Las bases sin rol reciben asignación provisional por orden (4/3/3), anunciada en el menú y el registro, solo en la copia del partido.

## Mano y robo

Cada equipo empieza con cuatro jugadores: uno de cada rol más uno aleatorio. Al jugar un jugador pasa al descarte y se roba otro. Al agotar el mazo se baraja el descarte, sin duplicar los jugadores de la mano. En un disparo solo consume jugador el atacante. El portero siempre está disponible.

Cada equipo tiene un mazo táctico idéntico de seis cartas únicas, dos en mano al inicio. Se roba una cada tres duelos/disparos resueltos, hasta tres en mano. El descarte táctico se baraja al agotar su mazo. El descanso conserva manos, mazos y descartes.

## Orden y efectos

El atacante revela jugador y táctica opcional; el defensor responde después. Se permite revisar elecciones antes de tirar; la respuesta CPU a una revisión de ataque también se revisa. El ataque CPU queda fijado antes de que el humano elija su defensa. Una táctica por equipo y duelo; todas las seleccionadas se descartan al resolver, aunque no se active su efecto.

- Pared: +2 Pase, solo atacante en duelo de campo.
- Desborde: +2 Ritmo o Regate, solo atacante en campo.
- Presión alta: +2 atributo actual, solo defensor en campo.
- Cobertura: si el defensor pierde, reduce el avance rival en 2, mínimo 1.
- Fuera de juego: si el defensor pierde y el rival alcanza su línea de tiro, el balón retrocede dos casillas desde esa línea. El ganador conserva el ataque, sin disparo inmediato. No cancela goles ni dispara un nuevo dado.
- Disparo colocado: +2 Tiro, solo quien dispara.

Totales: valor original + bonus de zona + bonus táctico + d6. Los originales permanecen invariables. Empates y porteros conservan las reglas clásicas.

## IA y guardado

La CPU solo elige entre sus cuatro jugadores y sus propias tácticas. Usa probabilidades exactas de d6, una planificación corta y una penalización por gastar tácticas. Al atacar primero modela respuestas a partir de la plantilla pública, no de la mano ni el mazo ocultos del humano. La plantilla rival completa es consultable sin revelar su mano. Al defender conoce el ataque y su táctica.

Mazos, manos, roles, tácticas, elecciones y resultados se incluyen en el mismo guardado de partida existente. Recargar no vuelve a robar ni a tirar un duelo resuelto.

## Validación y límites del equilibrio

Pruebas locales: 10.000 ciclos de robo, integridad de mazos, tres casillas de bonus por posición/lado, elegibilidad de las seis tácticas, sumas exactas, efectos de movimiento, orden CPU, recuperación al recargar, partido completo, retorno al clásico y regresiones del editor.

Experimento simplificado de 5.000 partidos por formación: estadísticas idénticas (7), sin tácticas y elección codiciosa por bonus. Cambiar de 4/3/3 a 3/4/3 mejoró los resultados; por eso esta beta exige la misma composición. Este experimento no valida el equilibrio completo de la IA ni de las tácticas.

Frente a un portero de valor 7, un tiro de base 7 pasa de 41,7 % a 58,3 % de gol con el +1 posicional. Sigue siendo una ventaja relevante a monitorizar con partidas reales; no se afirma que todas las posiciones estén perfectamente equilibradas.
