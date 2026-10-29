package oracle.common.security;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import oracle.common.exception.LimiteExcedidoException;
import org.springframework.stereotype.Component;

/**
 * Limita los intentos de login (ventana deslizante en memoria, por nodo).
 *
 * El intento se RESERVA de forma atomica antes de verificar la contrasena
 * (consumir): asi no hay carrera entre peticiones concurrentes. Tras un login
 * correcto se limpia el cubo IP+usuario y se devuelve el cupo consumido del
 * cubo por IP. El bloqueo por cuenta (independiente de la IP y persistido en la
 * BD) lo aplica AuthService; este limitador solo frena rafagas por origen.
 */
@Component
public class LoginRateLimiter {

    /** Intentos por IP+usuario en la ventana. */
    public static final int MAX_INTENTOS_USUARIO = 10;
    /** Intentos por IP en la ventana (mas holgado para NAT compartidos). */
    public static final int MAX_INTENTOS_IP = 30;
    private static final long VENTANA_MS = 60_000L;
    private static final int MAX_CLAVES = 10_000;

    private final ConcurrentHashMap<String, Deque<Long>> intentos = new ConcurrentHashMap<>();

    /** Reserva atomicamente un intento; lanza 429 si la clave ya agoto su cupo. */
    public void consumir(String clave, int maxIntentos) {
        Deque<Long> cola = intentos.computeIfAbsent(clave, k -> new ArrayDeque<>());
        synchronized (cola) {
            podar(cola);
            if (cola.size() >= maxIntentos) {
                throw new LimiteExcedidoException("Demasiados intentos de acceso. Inténtalo de nuevo en un minuto.");
            }
            cola.addLast(System.currentTimeMillis());
        }
        acotarTamano();
    }

    /** Devuelve el ultimo intento reservado (login correcto: no cuenta contra la IP). */
    public void liberar(String clave) {
        Deque<Long> cola = intentos.get(clave);
        if (cola != null) {
            synchronized (cola) {
                cola.pollLast();
            }
        }
    }

    /** Limpia los intentos de la clave tras un login exitoso. */
    public void limpiar(String clave) {
        intentos.remove(clave);
    }

    /** Clave de cubo por usuario (IP + usuario, para no bloquear a todos desde una IP). */
    public static String claveUsuario(String ip, String usuario) {
        return ip + "|" + usuario.trim().toLowerCase(Locale.ROOT);
    }

    /** Clave de cubo por IP. */
    public static String claveIp(String ip) {
        return "ip:" + ip;
    }

    /**
     * Cota el numero de claves sin borrar TODOS los contadores (un clear() global
     * regalaria intentos nuevos al atacante). Primero descarta las colas ya
     * vencidas; si aun sobran, elimina las sobrantes de forma acotada.
     */
    private void acotarTamano() {
        if (intentos.size() <= MAX_CLAVES) {
            return;
        }
        var it = intentos.entrySet().iterator();
        while (it.hasNext() && intentos.size() > MAX_CLAVES) {
            Deque<Long> cola = it.next().getValue();
            synchronized (cola) {
                podar(cola);
                if (cola.isEmpty()) {
                    it.remove();
                }
            }
        }
    }

    private void podar(Deque<Long> cola) {
        long limite = System.currentTimeMillis() - VENTANA_MS;
        while (!cola.isEmpty() && cola.peekFirst() < limite) {
            cola.pollFirst();
        }
    }
}
