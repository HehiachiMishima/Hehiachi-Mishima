package oracle.common.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.ZoneOffset;
import oracle.common.exception.PeticionInvalidaException;
import org.junit.jupiter.api.Test;

/** Reglas de fechas de los filtros (sin BD). */
class FechasIsoTest {

    @Test
    void sinZonaSeInterpretaComoUtc() {
        // Formato que envia el frontend (isoUtc): UTC sin la Z.
        assertThat(FechasIso.leer("2026-11-10T14:00:00", "desde", false))
                .isEqualTo(Instant.parse("2026-11-10T14:00:00Z"));
    }

    @Test
    void conZOOffsetEsElInstanteExacto() {
        assertThat(FechasIso.leer("2026-11-10T14:00:00Z", "desde", false))
                .isEqualTo(Instant.parse("2026-11-10T14:00:00Z"));
        assertThat(FechasIso.leer("2026-11-10T09:00:00-05:00", "desde", false))
                .isEqualTo(Instant.parse("2026-11-10T14:00:00Z"));
    }

    @Test
    void hastaEsInclusivo() {
        assertThat(FechasIso.leer("2026-11-10T14:00:00Z", "hasta", true))
                .isEqualTo(Instant.parse("2026-11-10T14:00:00.000001Z"));
        assertThat(FechasIso.leer("2026-11-10", "hasta", true))
                .isEqualTo(Instant.parse("2026-11-11T00:00:00Z"));
        assertThat(FechasIso.leer("2026-11-10", "desde", false))
                .isEqualTo(Instant.parse("2026-11-10T00:00:00Z"));
    }

    @Test
    void vacioEsNull() {
        assertThat(FechasIso.leer(null, "desde", false)).isNull();
        assertThat(FechasIso.leer("  ", "desde", false)).isNull();
    }

    @Test
    void formatosInvalidosYFueraDeRangoSon400() {
        for (String malo : new String[] {"ayer", "2026-13-01", "2026-02-30", "10/11/2026", "2026-11-10T25:00:00"}) {
            assertThatThrownBy(() -> FechasIso.leer(malo, "desde", false))
                    .as(malo).isInstanceOf(PeticionInvalidaException.class);
        }
        assertThatThrownBy(() -> FechasIso.leer("+999999999-12-31T23:59:59Z", "hasta", true))
                .isInstanceOf(PeticionInvalidaException.class);
        assertThatThrownBy(() -> FechasIso.leer("1900-01-01", "desde", false))
                .isInstanceOf(PeticionInvalidaException.class);
    }

    @Test
    void zonaIanaValidada() {
        assertThat(FechasIso.zona(null)).isEqualTo(ZoneOffset.UTC);
        assertThat(FechasIso.zona("America/Lima").getId()).isEqualTo("America/Lima");
        assertThatThrownBy(() -> FechasIso.zona("Marte/Base")).isInstanceOf(PeticionInvalidaException.class);
        assertThatThrownBy(() -> FechasIso.zona("'; DROP TABLE x;--")).isInstanceOf(PeticionInvalidaException.class);
    }
}
