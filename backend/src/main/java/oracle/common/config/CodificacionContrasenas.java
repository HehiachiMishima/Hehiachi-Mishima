package oracle.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Un unico PasswordEncoder (BCrypt) compartido por la autenticacion, el alta de
 * usuarios y el seeding. El coste es configurable (app.seguridad.bcrypt-coste,
 * por defecto 10): cada +1 duplica el tiempo de cada login; en un plan de 0,1
 * CPU un coste 12 tarda ~1 s por intento. Los hashes existentes siguen siendo
 * validos al cambiarlo (el coste va dentro del hash).
 */
@Configuration
public class CodificacionContrasenas {

    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.seguridad.bcrypt-coste:10}") int coste) {
        return new BCryptPasswordEncoder(coste);
    }
}
