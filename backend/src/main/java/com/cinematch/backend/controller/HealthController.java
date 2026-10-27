package com.cinematch.backend.controller;
//an API that tells us whether the CineMatch AI backend is running
//will handle health-check HTTP requests
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public String health() {
        return "CineMatch AI backend is running!";
    }
}
