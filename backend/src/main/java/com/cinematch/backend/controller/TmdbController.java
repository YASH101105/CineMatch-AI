package com.cinematch.backend.controller;

import com.cinematch.backend.service.TmdbService;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tmdb")
public class TmdbController {

    private final TmdbService tmdbService;

    public TmdbController(TmdbService tmdbService) {
        this.tmdbService = tmdbService;
    }

    @GetMapping("/search")
    public ResponseEntity<String> searchMovies(@RequestParam String query) {
        if (query.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Search query must not be blank");
        }
        return runTmdb(() -> tmdbService.searchMovies(query), "Unable to retrieve movies from TMDB");
    }

    @GetMapping("/movie/{id}")
    public ResponseEntity<String> getMovieDetails(@PathVariable long id) {
        if (id <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid movie ID");
        }
        return runTmdb(() -> tmdbService.getMovieDetails(id), "Unable to retrieve movie details");
    }

    @GetMapping("/movie/{id}/recommendations")
    public ResponseEntity<String> getRecommendations(@PathVariable long id) {
        if (id <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid movie ID");
        }
        return runTmdb(() -> tmdbService.getRecommendations(id), "Unable to retrieve recommendations");
    }

    @GetMapping("/movie/{id}/images")
    public ResponseEntity<String> getMovieImages(@PathVariable long id) {
        if (id <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid movie ID");
        }
        return runTmdb(() -> tmdbService.getMovieImages(id), "Unable to retrieve movie images");
    }

    @GetMapping("/genres")
    public ResponseEntity<String> getGenres() {
        return runTmdb(tmdbService::getGenres, "Unable to retrieve movie genres");
    }

    @GetMapping("/discover")
    public ResponseEntity<String> discoverMovies(@RequestParam long genreId) {
        if (genreId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid genre ID");
        }
        return runTmdb(() -> tmdbService.discoverByGenre(genreId), "Unable to retrieve movies for this genre");
    }

    @GetMapping("/trending")
    public ResponseEntity<String> getTrendingMovies(
            @RequestParam(defaultValue = "1") int page) {
        if (page < 1 || page > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid trending page.");
        }
        return runTmdb(() -> tmdbService.getTrendingMovies(page), "Unable to retrieve trending movies");
    }

    private ResponseEntity<String> runTmdb(TmdbOperation operation, String message) {
        try {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(operation.run());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "TMDB request interrupted");
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
        }
    }

    @FunctionalInterface
    private interface TmdbOperation {
        String run() throws IOException, InterruptedException;
    }
}
