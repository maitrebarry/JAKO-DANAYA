package com.smboutique.api.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Simple in-memory job tracker for recompute jobs.
 */
@Service
public class RecomputeJobService {

    public enum Status {PENDING, RUNNING, DONE, FAILED}

    public static class Job {
        public final String id;
        public final Long boutiqueId;
        public volatile Status status;
        public volatile int updatedCount;
        public volatile String errorMessage;
        public final Instant createdAt;
        public volatile Instant finishedAt;

        public Job(Long boutiqueId) {
            this.id = UUID.randomUUID().toString();
            this.boutiqueId = boutiqueId;
            this.status = Status.PENDING;
            this.updatedCount = 0;
            this.errorMessage = null;
            this.createdAt = Instant.now();
            this.finishedAt = null;
        }
    }

    private final Map<String, Job> jobs = new ConcurrentHashMap<>();

    @Autowired
    private com.smboutique.api.service.impl.MarginRecomputeService marginRecomputeService; // dedicated recompute service

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public Job createJob(Long boutiqueId) {
        Job j = new Job(boutiqueId);
        jobs.put(j.id, j);
        return j;
    }

    public Job getJob(String jobId) {
        return jobs.get(jobId);
    }

    public java.util.List<Job> listJobs() {
        return java.util.List.copyOf(jobs.values());
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        return emitter;
    }

    private void publishEvent(Job job) {
        for (SseEmitter e : emitters) {
            try {
                e.send(org.springframework.http.MediaType.APPLICATION_JSON);
                e.send(java.util.Map.of("jobId", job.id, "status", job.status.name(), "updatedCount", job.updatedCount, "error", job.errorMessage));
            } catch (Exception ex) {
                emitters.remove(e);
            }
        }
    }

    public String startJobAsync(Long boutiqueId) {
        Job job = createJob(boutiqueId);
        job.status = Status.RUNNING;
        publishEvent(job);
        CompletableFuture<Integer> fut = marginRecomputeService.recomputeForBoutiqueAsync(boutiqueId);
        fut.whenComplete((count, ex) -> {
            if (ex != null) {
                job.status = Status.FAILED;
                job.errorMessage = ex.getMessage();
            } else {
                job.status = Status.DONE;
                job.updatedCount = count != null ? count : 0;
            }
            job.finishedAt = Instant.now();
            publishEvent(job);
        });
        return job.id;
    }
}
