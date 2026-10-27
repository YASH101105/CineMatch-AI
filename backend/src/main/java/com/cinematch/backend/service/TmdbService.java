package com.cinematch.backend.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TmdbService {

    private static final int MAX_ATTEMPTS = 3;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${tmdb.api.base-url}")
    private String baseUrl;

    @Value("${tmdb.api.token}")
    private String token;

    private String getFromTmdb(String path)
            throws IOException, InterruptedException {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(12))
                .header("Authorization", "Bearer " + token)
                .header("accept", "application/json")
                .GET()
                .build();

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            HttpResponse<String> response;
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (IOException exception) {
                if (attempt == MAX_ATTEMPTS) {
                    throw exception;
                }
                pauseBeforeRetry(attempt, null);
                continue;
            }

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return response.body();
            }

            if (isTransient(response.statusCode()) && attempt < MAX_ATTEMPTS) {
                pauseBeforeRetry(attempt, response.headers().firstValue("Retry-After").orElse(null));
                continue;
            }

            throw new IOException("TMDB API returned HTTP " + response.statusCode());
        }

        throw new IOException("TMDB request failed after retries");
    }

    private boolean isTransient(int statusCode) {
        return statusCode == 408 || statusCode == 429 || statusCode >= 500;
    }

    private void pauseBeforeRetry(int attempt, String retryAfter)
            throws InterruptedException {
        long delayMillis = 300L * (1L << (attempt - 1));
        if (retryAfter != null) {
            try {
                delayMillis = Math.max(0L, Math.min(3000L, Long.parseLong(retryAfter) * 1000L));
            } catch (NumberFormatException ignored) {
                // Retry-After can also be an HTTP date; use the short backoff in that case.
            }
        }
        Thread.sleep(delayMillis);
    }

    public String searchMovies(String query)
            throws IOException, InterruptedException {
        String encodedQuery = URLEncoder.encode(
                query, StandardCharsets.UTF_8);
        return getFromTmdb("/search/movie?query=" + encodedQuery);
    }

    public String getMovieDetails(long id)
            throws IOException, InterruptedException {
        return getFromTmdb("/movie/" + id);
    }

    public String getRecommendations(long id)
            throws IOException, InterruptedException {
        return getFromTmdb("/movie/" + id + "/recommendations");
    }

    public String getMovieImages(long id)
            throws IOException, InterruptedException {
        return getFromTmdb("/movie/" + id + "/images?include_image_language=en,null");
    }

    public String getGenres()
            throws IOException, InterruptedException {
        return getFromTmdb("/genre/movie/list?language=en-US");
    }

    public String discoverByGenre(long genreId)
            throws IOException, InterruptedException {
        return getFromTmdb("/discover/movie?with_genres=" + genreId + "&sort_by=popularity.desc");
    }

    public String getTrendingMovies(int page)
            throws IOException, InterruptedException {
        return getFromTmdb("/trending/movie/week?page=" + page);
    }
}
