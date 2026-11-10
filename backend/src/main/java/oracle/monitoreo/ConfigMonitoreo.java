package oracle.monitoreo;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registra el interceptor que captura el actor y habilita las tareas programadas (purga). */
@Configuration
@EnableScheduling
public class ConfigMonitoreo implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registro) {
        registro.addInterceptor(new InterceptorActor()).addPathPatterns("/api/**");
    }
}
