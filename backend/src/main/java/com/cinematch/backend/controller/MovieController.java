
package com.cinematch.backend.controller;


import com.cinematch.backend.entity.Movie;
import com.cinematch.backend.service.MovieService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.*;


import java.util.List;

@RestController
@RequestMapping("/api/movies")
public class MovieController {

    private final MovieService movieService;

    public MovieController(MovieService movieService) {
        this.movieService = movieService;
    }

    @GetMapping
    public List<Movie> getAllMovies() {
        return movieService.getAllMovies();
    }

   @PostMapping
public Movie saveMovie(@Valid @RequestBody Movie movie) {
    return movieService.saveMovie(movie);
}

    @GetMapping("/{id}")
public Movie getMovieById(@PathVariable Long id) {
    return movieService.getMovieById(id);
}
@PutMapping("/{id}")
public Movie updateMovie(
        @PathVariable Long id,
        @Valid @RequestBody Movie movie) {
    return movieService.updateMovie(id, movie);
}
}
