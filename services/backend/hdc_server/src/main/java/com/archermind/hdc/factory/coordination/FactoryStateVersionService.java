package com.archermind.hdc.factory.coordination;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class FactoryStateVersionService {
    public static final String LINE_ID = "LINE-01";

    @Value("${factory.persistence.enabled:false}")
    private boolean persistenceEnabled;

    private final JdbcTemplate jdbcTemplate;
    private final AtomicLong version = new AtomicLong(1L);

    public FactoryStateVersionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void restore() {
        if (!persistenceEnabled) return;
        Long stored = jdbcTemplate.queryForObject(
                "select state_version from factory_line_state where line_id=?",
                new Object[]{LINE_ID}, Long.class);
        if (stored != null) version.set(Math.max(1L, stored));
    }

    public long current() {
        return version.get();
    }

    public synchronized long next() {
        long next = version.incrementAndGet();
        if (persistenceEnabled) {
            jdbcTemplate.update(
                    "insert into factory_line_state(line_id,state_version,updated_at) values(?,?,now(6)) "
                            + "on duplicate key update state_version=values(state_version),updated_at=now(6)",
                    LINE_ID, next);
        }
        return next;
    }
}
