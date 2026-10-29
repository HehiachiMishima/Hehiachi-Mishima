package oracle.auditoria;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Constructores del campo detalle: {antes, despues} en cambios de datos o
 * {motivo} en rechazos. Quien construye las instantaneas es responsable de
 * NO incluir contrasenas, hashes ni tokens.
 */
public final class Detalle {

    public static Map<String, Object> cambio(Map<String, ?> antes, Map<String, ?> despues) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("antes", antes);
        d.put("despues", despues);
        return d;
    }

    public static Map<String, Object> alta(Map<String, ?> despues) {
        return cambio(null, despues);
    }

    public static Map<String, Object> baja(Map<String, ?> antes) {
        return cambio(antes, null);
    }

    public static Map<String, Object> motivo(String motivo) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("motivo", motivo);
        return d;
    }

    /** Anade una clave opcional (se omite si el valor es null o vacio). */
    public static Map<String, Object> con(Map<String, Object> detalle, String clave, Object valor) {
        if (valor != null && !(valor instanceof String s && s.isBlank())) {
            detalle.put(clave, valor);
        }
        return detalle;
    }

    /** Mapa ordenado a partir de pares clave/valor (admite null, a diferencia de Map.of). */
    public static Map<String, Object> de(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pares.length; i += 2) {
            m.put(String.valueOf(pares[i]), pares[i + 1]);
        }
        return m;
    }

    private Detalle() {
    }
}
