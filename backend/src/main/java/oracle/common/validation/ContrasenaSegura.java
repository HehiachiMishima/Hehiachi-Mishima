package oracle.common.validation;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.RECORD_COMPONENT;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

/**
 * Politica de contrasenas: minimo 12 caracteres, maximo 72 bytes UTF-8 (limite
 * de BCrypt: por encima Spring Security lanza IllegalArgumentException y daria
 * un 500), con letras y numeros y fuera de una lista de contrasenas triviales.
 * Un valor null es valido: la obligatoriedad la decide @NotBlank.
 */
@Documented
@Constraint(validatedBy = ContrasenaSegura.Validador.class)
@Target({FIELD, PARAMETER, RECORD_COMPONENT})
@Retention(RUNTIME)
public @interface ContrasenaSegura {

    int MIN_CARACTERES = 12;
    int MAX_BYTES = 72;

    String message() default "La contraseña debe tener al menos 12 caracteres (máximo 72 bytes) e incluir letras y números.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    /** Implementacion de la regla. */
    class Validador implements ConstraintValidator<ContrasenaSegura, String> {

        private static final Set<String> TRIVIALES = Set.of(
                "123456789012", "1234567890ab", "contrasena123", "contraseña123", "password1234",
                "qwerty123456", "administrador1", "admin1234567", "passw0rd1234");

        @Override
        public boolean isValid(String valor, ConstraintValidatorContext contexto) {
            if (valor == null) {
                return true;
            }
            int bytes = valor.getBytes(StandardCharsets.UTF_8).length;
            return valor.length() >= MIN_CARACTERES
                    && bytes <= MAX_BYTES
                    && valor.chars().anyMatch(Character::isLetter)
                    && valor.chars().anyMatch(Character::isDigit)
                    && !TRIVIALES.contains(valor.toLowerCase(Locale.ROOT));
        }
    }
}
