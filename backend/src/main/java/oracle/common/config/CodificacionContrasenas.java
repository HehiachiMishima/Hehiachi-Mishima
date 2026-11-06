package oracle.common.config;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Un unico PasswordEncoder (BCrypt) compartido por la autenticacion, el alta de
 * usuarios y el seeding. El coste es configurable (app.seguridad.bcrypt-coste,
 * por defecto 10): cada +1 duplica el tiempo de cada login. Los hashes
 * existentes siguen siendo validos al cambiarlo (el coste va dentro del hash).
 *
 * BCrypt corre en un pool ACOTADO de hilos de plataforma (uno por CPU), no en
 * el hilo virtual de la peticion. Un hilo virtual no se desaloja mientras usa
 * CPU: con todos los carriers ocupados en BCrypt, las peticiones que ya tenian
 * una conexion JDBC no podian reanudarse para devolverla y Hikari se agotaba
 * (medido: 57/200 logins concurrentes con 500 por timeout de conexion). Aqui
 * el hilo virtual solo espera (se desmonta) y los carriers quedan libres para I/O.
 */
@Configuration
public class CodificacionContrasenas {

    @Bean(destroyMethod = "shutdown")
    ExecutorService ejecutorBcrypt() {
        int hilos = Math.max(1, Runtime.getRuntime().availableProcessors());
        return Executors.newFixedThreadPool(hilos, Thread.ofPlatform().name("bcrypt-", 0).daemon(true).factory());
    }

    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.seguridad.bcrypt-coste:10}") int coste,
            ExecutorService ejecutorBcrypt) {
        return new BcryptAcotado(new BCryptPasswordEncoder(coste), ejecutorBcrypt);
    }

    /** Delegado que ejecuta cada operacion BCrypt en el pool de plataforma. */
    record BcryptAcotado(PasswordEncoder delegado, ExecutorService pool) implements PasswordEncoder {

        @Override
        public String encode(CharSequence contrasena) {
            return enPool(() -> delegado.encode(contrasena));
        }

        @Override
        public boolean matches(CharSequence contrasena, String hash) {
            return enPool(() -> delegado.matches(contrasena, hash));
        }

        @Override
        public boolean upgradeEncoding(String hash) {
            return delegado.upgradeEncoding(hash);
        }

        private <T> T enPool(Callable<T> trabajo) {
            try {
                return pool.submit(trabajo).get();
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Operacion BCrypt interrumpida.", ex);
            } catch (ExecutionException ex) {
                if (ex.getCause() instanceof RuntimeException r) {
                    throw r;
                }
                throw new IllegalStateException(ex.getCause());
            }
        }
    }
}
