package oracle.common.config;

import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Ejecuta bloques de trabajo dentro de una transaccion.
 *
 * Delimita con precision la transaccion DENTRO del metodo de servicio: la
 * validacion de entrada, la serializacion de la respuesta y el registro de
 * trazas quedan fuera, de modo que la conexion JDBC se retiene solo lo
 * imprescindible. Las lecturas + escritura de una operacion comparten la
 * misma transaccion (evita ventanas TOCTOU inconsistentes).
 *
 * Las lecturas puramente de solo consulta usan consultar() (readOnly=true).
 */
@Component
public class Transacciones {

    private final TransactionTemplate escritura;
    private final TransactionTemplate lectura;

    public Transacciones(PlatformTransactionManager gestor) {
        this.escritura = new TransactionTemplate(gestor);
        this.lectura = new TransactionTemplate(gestor);
        this.lectura.setReadOnly(true);
    }

    public <T> T ejecutar(Supplier<T> trabajo) {
        return escritura.execute(estado -> trabajo.get());
    }

    public <T> T consultar(Supplier<T> trabajo) {
        return lectura.execute(estado -> trabajo.get());
    }
}
