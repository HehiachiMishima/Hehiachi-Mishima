package oracle.common.exception;

/** 400: parametros de consulta con formato o valor no admitido. */
public class PeticionInvalidaException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public PeticionInvalidaException(String mensaje) {
        super(mensaje);
    }
}
