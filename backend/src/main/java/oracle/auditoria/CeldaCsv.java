package oracle.auditoria;

/** Escapado de celdas CSV (RFC 4180) con proteccion contra inyeccion de formulas. */
final class CeldaCsv {

    /**
     * Entrecomilla siempre y antepone ' si el valor empieza por = + - @ TAB o CR,
     * para que Excel/LibreOffice lo traten como texto (p. ej. "@admin" sale como
     * "'@admin").
     */
    static String de(Object valor) {
        if (valor == null) {
            return "";
        }
        String s = String.valueOf(valor);
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) {
            s = "'" + s;
        }
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }

    private CeldaCsv() {
    }
}
